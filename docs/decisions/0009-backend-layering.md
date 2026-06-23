# ADR 0009: Backend layering — routes / controllers / services / repos / domain

## Status

accepted — 2026-06-23

## Context

Express imposes no structure beyond "middleware in, response out". Left to themselves, handlers tend to grow into large functions that validate input, query the database, format the response, and map errors all in one place. Two related failure modes:

- **Routes that import Prisma.** A controller-level Prisma query is the path of least resistance, but it puts data-access logic next to HTTP concerns. Tests have to mock or boot the DB; refactoring the storage layer (or swapping it) means rewriting controllers.
- **No transactional boundary.** When a single request needs two writes (give-raise = close current + insert new), there's no obvious place for the `$transaction` to live. Putting it in the controller couples HTTP semantics to atomicity; putting it in the repo means repos know about other repos.

We need a layered organisation that's:

- explicit about what each layer can import,
- testable layer by layer (the pure domain layer especially), and
- light enough not to feel like ceremony at the current scale.

## Decision

Five layers, top to bottom. Each can import only from layers strictly below it.

```
routes/         HTTP route registration. One Router per resource. Thin.
controllers/    Request -> service call -> response. Validates input via
                zod schemas from @acme/shared. Knows about HTTP; doesn't
                know about Prisma or transactions.
services/       Business logic. Composes repository calls. OWNS the
                transactional boundary (prisma.$transaction(...)).
repos/          Database access only. One file per aggregate. Returns
                domain-typed values, not raw Prisma rows.
domain/         Pure functions. Money math, FX, analytics aggregations,
                validators. No I/O. Easy to test.
```

Cross-cutting:

- **`middleware/`** for auth, error handling, and request augmentation. Mounted from `app.ts`, not from any layer.
- **`config/`** for env parsing and shared instances (Prisma client singleton, logger). Importable by anything.
- **`types/`** for cross-cutting type augmentation (e.g. `Express.Request.user`).

Hard rules:

- **Routes don't import Prisma.** If a route needs data, it calls a service.
- **Repos don't import other repos.** They share a Prisma client; orchestration is the service layer's job.
- **Domain doesn't import anything from above.** Pure. The same domain functions are usable in tests and in services without any wiring.
- **Controllers don't catch errors and shape responses.** They `try { ... } catch (err) { next(err) }`. The single error-handler middleware (`error-handler.ts`) maps to the wire envelope.

Worked example — the GET /api/employees list that lands in this commit:

- **`routes/employees.ts`** — `router.get('/', listEmployees)`. One line per endpoint.
- **`controllers/employees.ts`** — `EmployeeListQuerySchema.parse(req.query)` → `listEmployeesService(query)` → `res.json(result)`. No Prisma import.
- **`services/employees.ts`** — calls the repo, maps each row through `toWire` (from `domain/money.ts`), wraps in the paginated envelope.
- **`repos/employees.ts`** — one `$queryRaw` CTE that joins current salary + latest FX rate per pair and computes the display amount. Returns `EmployeeListRow[]`, not Prisma rows.
- **`domain/money.ts`** — `toWire(bigint) -> string` is the only domain touch.

## Consequences

**Easier:**
- The five layers have one job each. New endpoints follow the same shape.
- Domain tests need no DB and no Express — `money.test.ts` and `fx.test.ts` already demonstrate this.
- Service tests can mock the repo for fast unit testing, OR hit a real DB for integration testing — the choice is local to the service.
- Swapping the database engine touches only the repo layer.
- The transactional boundary always lives in the service layer, never in a route or repo.

**Harder:**
- Five files for one endpoint can feel ceremonial at the smallest scale (a single read with no business logic). Tolerated because the consistency is worth more than the saved keystrokes.
- The discipline has to be enforced — there's no compile-time check that a controller doesn't import Prisma. A lint rule (`no-restricted-imports`) is a future addition if drift becomes a real issue.

**Not chosen — and why:**
- **Controller-direct-to-Prisma.** Faster for tiny apps; pays compound interest in larger ones. Even at this scale, the give-raise transaction (commit 10) and the analytics aggregations (commit 12) want the service boundary already.
- **NestJS-style decorators + DI.** Strong, opinionated, but the runtime cost (decorators, reflect-metadata) and the cognitive cost (when does the DI container fire?) aren't worth it at this scope. Express + explicit imports are simpler.
- **Functional core / imperative shell as separate packages.** Right idea for much larger projects; the same separation is achieved here via the domain layer's purity, without the package boundary overhead.
