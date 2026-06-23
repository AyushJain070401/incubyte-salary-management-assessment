# ADR 0003: Split frontend (Vite) and backend (Express), with a shared contracts package

## Status

accepted — 2026-06-23

## Context

The product is a single web app today, but the salary data and the operations on it (give raise, bulk import, analytics aggregations) are valuable on their own — they're the kind of thing other clients are likely to consume eventually: a mobile app for managers, a payroll integration, an internal BI tool, a scheduled job that emits compensation reports. We want the data layer to be addressable as a service from day one, not retrofitted later when the second client appears.

We considered two shapes:

1. **Full-stack framework** (e.g. Next.js App Router with Route Handlers). One repo, one deploy, server components fetch data directly. Fast to ship.
2. **Split: SPA frontend + standalone HTTP API + shared contracts package.** Two deployables, a clear contract between them.

The full-stack shape is faster to ship but **collapses the boundary** between the UI and the data layer. Business logic lives next to JSX files; "the API" exists only as an implementation detail of the web app. Adding a second client means either lifting that logic out later (an expensive migration) or duplicating it.

The split shape pays an upfront cost — CORS, two `.env` files, two deploys, JWT crossing the wire — in exchange for a backend that is independently deployable, independently scalable, independently versionable, and consumable by any client that can speak HTTP.

## Decision

Split. Three workspace packages:

- `apps/web` — Vite + React SPA. Calls the API over HTTPS. No server-side rendering.
- `apps/api` — Express + Prisma backend. Owns all database access and business logic. Exposes a REST surface under `/api/*`.
- `packages/shared` — Zod schemas + inferred TypeScript types. The wire format lives here and only here.

Schemas in `@acme/shared` are imported by both apps: the web app uses them for form validation (`react-hook-form` resolver) and for narrowing API responses; the api uses them at the edge of every route handler. A change to a schema breaks both sides at compile time — exactly the property we want.

## Consequences

**Easier:**
- The backend is a self-contained service. Any future client (mobile, BI, integrations) talks to it the same way the SPA does.
- The boundary between domain logic and presentation is a network hop, not a convention. Logic cannot accidentally leak into a React component.
- Schema drift between web and api is impossible — both import the same source. A breaking change is a compile error, not a runtime surprise.
- Deploys are independent: the api can ship a fix without re-building the SPA, and vice versa.
- The backend can be load-tested, monitored, and scaled on its own dimensions.

**Harder:**
- More boilerplate: CORS config, env vars maintained in two places, two deploy targets.
- Auth is more involved than a full-stack shape would be — a JWT verification step on every API call. Mitigated by ADR 0004 (Supabase Auth issues the JWT, the api verifies it in a middleware).
- Local dev needs both apps running. The root `pnpm dev` runs them in parallel.
- No "free" server-side rendering or end-to-end type inference of the full-stack shape. We recover most of the type-safety via the shared Zod package.

**Not chosen — and why:**
- **Full-stack framework (Next.js App Router).** The boundary collapse is the deal-breaker. Adding a second client later would require extracting the logic, which is more expensive than building it on the right side of the wire from the start.
- **NestJS for the backend.** Strong layered-architecture conventions but heavyweight for the current scope. Decision documented in [0004-backend-express-prisma-supabase.md](0004-backend-express-prisma-supabase.md).
- **tRPC instead of REST.** Tighter end-to-end type-safety but couples every client to a Node backend and obscures the REST surface. A REST API is consumable by anything — including clients we don't write. We get most of the type-safety benefit via the shared Zod package without the coupling.
