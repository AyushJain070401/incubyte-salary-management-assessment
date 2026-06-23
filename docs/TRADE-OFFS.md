# Trade-offs

This document is the thematic digest of decisions across the project. For per-decision histories, see [`docs/decisions/`](decisions/) — each ADR captures one decision with context, alternatives, and consequences. This file groups those decisions by theme and adds the cross-cutting choices that aren't single-decision-sized.

If a section here links to an ADR, that ADR is the authoritative record. If a section here has no ADR link, it's either a small enough call to live only here, or it's an ADR-to-be-written that will land alongside the code that implements it.

---

## Money

**Decision: amounts are stored as `bigint` minor units + an ISO-4217 currency string. Display conversion happens at the read layer.**

| Option | Why not |
|---|---|
| Postgres `numeric(20, 4)` | Solves precision but invites locale-confused reads. Easy to write `12.5` in one place and `12.50` in another. |
| `double precision` | Money + floats is the canonical wrong answer. |
| `bigint` cents only (no currency) | Works for single-currency systems. We are explicitly multi-currency. |
| Library-driven (`dinero.js`, `money.js`) at the storage layer | The library is excellent for *operations* on money, not a substitute for storage. We do plan to use a small helper module at the application boundary. |

Consequences:

- All arithmetic on amounts is integer arithmetic. No rounding bugs from floating-point.
- The database is currency-agnostic; the application owns conversion and display.
- `bigint` doesn't serialize to JSON without help. The API encodes amounts as **strings** in JSON to avoid silent precision loss in older JS clients (`Number.MAX_SAFE_INTEGER` is ~9e15, which is fine for cents but a tripwire we'd rather not depend on). The shared Zod schema accepts both `string` and `number` on input and emits `string` on output.

ADR for this lands in commit 6 (money + FX domain).

---

## Currency conversion

**Decision: a snapshot `fx_rates` table seeded with fixed rates. No live FX provider.**

| Option | Why not |
|---|---|
| Live FX via a provider (Open Exchange Rates, ECB, fixer) | Adds a third-party dependency, a failure mode, and a cost. Most importantly: makes tests non-deterministic — a query that returns "$60k" today might return "$61k" tomorrow. |
| Round-trip via base currency at query time, with rates re-fetched daily | Better than per-query live FX but still adds operational surface (job scheduler, retries, alerting on stale rates) for marginal product value. |

Consequences:

- The same query returns the same number every time. Tests assert exact values without flakes.
- Conversion is one indexed join. Cheap.
- We can't show rates moving in real time (we don't claim to).
- Adding live FX later is a matter of replacing the seed with a periodic refresh; the schema and read path don't change.

---

## Auth

**Decision: Supabase Auth issues the JWT, the API verifies it.** Documented in [ADR 0004](decisions/0004-backend-express-prisma-supabase.md).

Single role: `hr_manager`. Authorization is "is the JWT valid and not expired?" — there are no per-action checks beyond that, because there is only one role.

| Option | Why not |
|---|---|
| Roll our own (bcrypt + JWT + sessions) | Real engineering surface (password storage, reset, lockout, refresh rotation) for no business reason. |
| NextAuth / Auth.js / Clerk / Lucia | Reasonable. Supabase wins because we are already operating one Supabase project for the database — one provider instead of two. |
| Session cookies instead of JWTs | Adds CSRF surface to a JSON API. JWTs in `Authorization` headers avoid that. |

Consequences:

- No password hashing code in our codebase.
- The API is stateless w.r.t. auth — no session table to invalidate, no Redis to add.
- We don't own the password-reset flow; Supabase does (link-based, sent via Supabase's email service).
- Rotating the JWT secret is a Supabase dashboard operation + a re-deploy of the API with the new env var.

---

## Database

**Decision: Postgres (Supabase) for both dev and prod. Not SQLite.**

| Option | Why not |
|---|---|
| SQLite | Simpler local setup, single file. Loses real `bigint` semantics (numeric), real `date` types, `PERCENTILE_CONT` for the analytics queries, and parity-with-prod. The price of "simpler local" is "the test suite passes but the prod migration doesn't behave the same way." Not worth it. |
| MySQL | Fine but no advantage over Postgres for this domain, and weaker analytics SQL. |
| Per-environment differences (SQLite locally, Postgres in prod) | We've made this mistake before. Mocked or simplified-DB tests pass while production behaviour diverges. Documented as a feedback memory: integration tests must hit the real DB engine. |

Consequences:

- Local dev needs Postgres. We use Supabase's local CLI (`supabase start`) which runs Postgres in Docker; the setup is one command and documented in the README.
- The Prisma schema can use Postgres-native types (`Decimal`, `Bigint`, JSON columns if needed) without translation.
- Analytics queries use `PERCENTILE_CONT` and `FILTER` clauses directly — no in-JS fallback path.

---

## Salary history

**Decision: append-only `salaries` table. A raise closes the current row (`effective_to`) and inserts a new one in a single transaction. Audit columns (`changed_by`, `changed_at`, `reason`) live on the salary row itself.**

| Option | Why not |
|---|---|
| Mutable "current salary" field on `employees` + a separate `salary_history` table | More tables, more joins, easier to get out of sync. The append-only model collapses both into one. |
| Separate `salary_audit` table | Real audit logs go beyond salaries. If we add one, it's for *all* writes, not just compensation. For v1 the per-row audit columns are honest and sufficient. |
| ORM-level temporal tables (Prisma extension) | Overhead for marginal value. The append-only convention is simpler and tool-agnostic. |

Consequences:

- The history is just `SELECT * FROM salaries WHERE employee_id = $1 ORDER BY effective_from DESC` — no special API.
- "Who gave this raise" and "why" are visible in the same query as the amount.
- A raise is non-trivial: two statements wrapped in a transaction. Lives in a service method, not in a controller or repo.
- Time-travel queries ("what did this employee earn on date X?") are a `WHERE effective_from <= X AND (effective_to IS NULL OR effective_to >= X)` away.

---

## API surface

**Decision: REST under `/api/*`. JSON in / JSON out. Zod-validated at the edge. No versioning header — there's one client (so far) and a single deployment.**

| Option | Why not |
|---|---|
| tRPC | Tighter end-to-end types but couples every consumer to a Node client. A REST surface is consumable by anything (a mobile app, a Python BI script, curl). |
| GraphQL | The query patterns here are CRUD-shaped. GraphQL's value (avoiding over-fetching, composing queries) is small at this scope and the operational complexity (schema, resolvers, N+1, persisted queries) is real. |
| OpenAPI-first (write spec, generate handlers) | We get most of the value by sharing Zod schemas between web and api via `@acme/shared`. OpenAPI generation is a stretch goal — a Zod-to-OpenAPI adapter (`zod-to-openapi`) can render a spec from the same schemas later. |

Consequences:

- The api never trusts an incoming payload — every handler validates with a Zod schema from `@acme/shared`.
- The web app benefits from the same schemas for form validation; a schema change breaks both sides at compile time.
- No version negotiation. When/if a v2 is needed, that becomes a new ADR.

---

## Pagination

**Decision: offset + limit, defaults `limit=50`, max `limit=200`. Cursor-based pagination is on the "if we needed it" list and isn't justified at 10k rows.**

| Option | Why not |
|---|---|
| Cursor pagination (keyset) | Strictly better at scale, but adds a stable-sort requirement to every query that's paginated. At 10k rows offset + limit is fine and ergonomic for "jump to page 47". |
| Infinite scroll on the client | An HR Manager looking for an employee uses filter + page jump, not scroll. Pagination matches the persona. |

Consequences:

- `OFFSET 9950 LIMIT 50` is a real query at the tail. Acceptable at 10k. Would be unacceptable at 10M.
- A documented migration path to cursors if scale changes.

---

## Bulk import

**Decision: CSV (not Excel). Dry-run mode is the default; commit mode requires a separate explicit POST. Imports run in chunks of 1,000 rows per transaction.**

| Option | Why not |
|---|---|
| .xlsx parsing | Adds a heavy parsing dep (`exceljs`, `xlsx`) and a more complex error surface. The HR Manager exports CSV from Excel as a one-time step; the migration value is the same. |
| Single transaction over the whole 10k import | Long-running transactions hold locks on `employees` for the full duration. Chunks of 1k let other reads proceed and let us report progress. |
| No dry-run | Letting an HR Manager commit a malformed CSV and then needing to undo is much worse than asking them to click "preview" first. |

Consequences:

- Round-trip is "upload → preview report → confirm → commit" — two requests but a much safer flow.
- A failing chunk rolls back only that chunk; the import returns a per-chunk status. The whole-import semantic ("nothing was committed unless everything was valid") is preserved by running dry-run first; commit only runs after preview is clean.

---

## Analytics

**Decision: SQL aggregates (`AVG`, `PERCENTILE_CONT(0.5)`, `COUNT(*) FILTER (WHERE ...)`) in the API, not in-memory JS. The dashboard endpoints accept the same filter set as the list endpoint.**

| Option | Why not |
|---|---|
| Pull rows into JS and aggregate | Works at 10k, but every additional filter or breakdown means another in-JS reducer. SQL is the right tool. |
| A separate analytics service | Premature. 10k rows on the operational DB is fine for the dashboards we ship. |
| Materialized views | Would matter at scale. At 10k rows the queries are <100ms. |

Consequences:

- The repository layer for analytics is mostly raw SQL via Prisma's `$queryRaw`. Each query is a function returning a domain object.
- Pay-gap analytics is gated by sample size (`n >= 5` per group). Below the threshold the API returns `{ suppressed: true, reason: 'sample_too_small' }` rather than a noisy figure.
- The dashboard ships only the MVP set (headcount, avg + median, top-10, pay bands). Pay-gap is stretch. YoY trends are stretch.

---

## Security posture (v1)

What's in:

- Helmet for security headers.
- CORS with an explicit allowlist (no wildcard).
- JWT verification on every protected route.
- HTTPS in production via Vercel and Render (managed).
- Zod validation at every request edge.
- TLS-encrypted Postgres connection (Supabase default).
- At-rest disk encryption on the Postgres instance (Supabase default).

What's deliberately out of v1:

- **Field-level encryption of salary amounts.** Real production HR systems do this. We don't, and we say so. The data is encrypted in transit and at rest; column-level encryption is a separate piece of work with its own ADR when we add it.
- **Rate limiting.** Single user, single tenant, behind auth. Not the right place to spend a week.
- **WAF / DDoS protection.** Managed by the host (Vercel, Render). We don't add app-level.
- **Audit log of reads.** Writes are audited via row-level columns; read auditing is not a v1 requirement.
- **Per-action authorization.** One role, one capability set.

---

## Observability (v1)

`pino` writes JSON logs to stdout. The host (Render) captures them. No structured shipping, no traces, no metrics.

Production upgrade path: Sentry on both web and api; ship logs to Datadog or Logflare; Prometheus middleware on the api `/metrics` endpoint.

---

## Testing

What's in:

- **Vitest** for unit tests on pure domain code. Money math, FX, percentile calculations, validators.
- **Vitest + supertest** for API integration tests. Every protected route has at least one "200 happy path" and one "401 without JWT" test.
- **Real Postgres** for repository and route tests. Documented in `apps/api/README.md`. No `pg-mem`, no mocked Prisma.
- **Playwright** for one smoke E2E: login → filter → open employee → give raise.

Coverage target: ≥80% on `apps/api/src/domain/*` (the pure stuff). Lower elsewhere is fine — the demo video + Playwright cover the UI happy path.

What's deliberately out:

- Property-based tests on money arithmetic (would be nice; not the right time investment for v1).
- Visual regression tests on the dashboard (charts on snapshot, not snapshot-tested).
- Load tests (not a v1 concern at 10k).

---

## Things we'd add if this were going to production

In rough priority order (also listed in [`REQUIREMENTS.md`](REQUIREMENTS.md)):

1. Approval workflows for raises above a threshold (maker-checker).
2. Field-level encryption of salary amounts.
3. A real audit log (every read, not just writes).
4. Employee self-service portal.
5. Org chart + manager hierarchy + manager-level reporting.
6. Live FX with cached fallback.
7. Compensation planning workflows (cycles, budgets, modeling).
8. Sentry + Datadog + Prometheus.
9. Rate limiting at the edge.
10. Read replicas if reporting load grows.
