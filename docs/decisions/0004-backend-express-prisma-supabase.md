# ADR 0004: Backend = Express + Prisma + Supabase (Postgres + Auth)

## Status

accepted — 2026-06-23

## Context

Given the split established in [ADR 0003](0003-split-frontend-and-backend.md), the backend is a standalone Node.js + TypeScript service. Three sub-decisions to make: HTTP framework, database access layer, and identity provider.

### HTTP framework

- **Express** — ubiquitous, simple, broadest ecosystem of middleware and examples. The "default" Node server framework. No opinions about layering, which means we have to bring our own conventions but also means nothing fights us when our conventions are good.
- **Fastify** — faster, schema-first, modern TS support. Real wins at high-throughput services. For an HR app at 10k employees the perf delta is invisible; the win is mostly about schema integration, which we get differently via Zod at the route edge.
- **NestJS** — opinionated framework with decorators, DI containers, modules. Strong layered-architecture conventions out of the box. Heavy for the current scope: lots of structure to maintain before any business logic is written, and the decorator/DI surface is a learning cost for anyone joining who hasn't used it.

### Database access layer

- **Prisma** — typed query builder, schema-first migrations (`prisma migrate`), generated client, mature DX, Prisma Studio for inspecting data locally. Slightly heavier runtime than alternatives but worth it for the iteration speed on a schema that's going to change as features land.
- **Drizzle** — TS-native, closer to raw SQL, lighter footprint. Good choice for teams that want SQL fluency front-and-center. Migration tooling is improving but less mature.
- **Raw `pg` / `postgres`** — most control, most code. Writing migrations and result-row types by hand pays off only when the schema is small and stable, neither of which applies here.

### Identity / auth

- **Supabase Auth** — managed email/password, password reset, JWT issuance, JWKS endpoint, dashboards. The backend verifies the JWT on every protected route; the backend remains the source of truth for *authorization* (what the user can do) while delegating *identity* (who they are) to a well-tested service.
- **Roll our own** (bcrypt + JWT + sessions). Real engineering surface — password hashing parameters, refresh tokens, reset flows, rate-limiting, lockouts. Each piece is a known opportunity to get something wrong. Building it from scratch is justifiable when there's a product reason; there isn't one here.
- **Auth.js (NextAuth) / Lucia / Clerk**. Each is reasonable; Supabase has the advantage that we're already using Supabase for the database, so the operational surface is one provider, not two.

## Decision

- **Express** for the HTTP layer. Plain middleware pipeline, routers organized by resource, no framework-imposed structure beyond what we choose.
- **Prisma** for the ORM. Schema in `apps/api/prisma/schema.prisma`, migrations under `apps/api/prisma/migrations/`, generated client imported as `@prisma/client`.
- **Supabase Auth** for identity. The SPA logs in via the Supabase JS SDK and obtains a JWT; the API verifies the JWT in a middleware (HS256 via the project's JWT secret) and attaches a typed `req.user` to downstream handlers.

The api never talks to Supabase Auth from the server side beyond verifying the JWT. Database access is via `DATABASE_URL` pointing at the same Supabase Postgres instance — i.e. Supabase is "Postgres as a service plus an auth service we happen to also use", not a coupling point.

## Consequences

**Easier:**
- Express + Prisma is the most-documented Node stack on the planet. Onboarding cost is near-zero.
- Schema changes are a one-line CLI command (`prisma migrate dev`), with the generated client typed automatically.
- Auth flows we'd otherwise spend a week on (password reset, JWT rotation) are managed.
- Local dev works without a Supabase account if the developer points `DATABASE_URL` at a local Postgres — Prisma is provider-agnostic.

**Harder:**
- Express has no enforced conventions, so the project owns the layering discipline (routes → controllers → services → repos). Documented in [ADR 0006 — backend layering](0006-backend-layering.md) when it lands.
- Prisma's `bigint` handling needs an explicit `JSON.stringify` reviver/replacer at the API edge (money is stored as `bigint` minor units; JSON doesn't speak `bigint`). Cross-referenced in the money handling ADR when it lands.
- Two failure modes for auth: invalid JWT (handle in middleware) and valid JWT but missing/stale user record. Both are middleware concerns and unit-testable.

**Not chosen — and why:**
- **Fastify.** Reasonable alternative; Express won on familiarity and ecosystem breadth at this scope.
- **NestJS.** Right answer for larger teams or much larger surface areas. Overkill here.
- **Drizzle.** Right answer if the team wants SQL-first. Prisma's migration ergonomics won at this scope.
- **Rolling our own auth.** No business reason to take on the risk surface when a hosted option is reliable and cheap.
