# @acme/api

Express + Prisma backend for ACME Salary Management.

## Layout

```
src/
  index.ts          entry — loads env, creates app, binds port
  app.ts            createApp() factory — returns Express app, no listen
  config/
    env.ts          env vars parsed and validated once via zod
  routes/
    health.ts       GET /health
test/
  health.test.ts    supertest against createApp()
```

The split between `index.ts` (server) and `app.ts` (app factory) exists so tests can spin up the full middleware stack and hit it with supertest without binding a port. Every route file exports its own `Router`; `app.ts` is the only place that knows the full set.

## Local dev

```bash
cp apps/api/.env.example apps/api/.env
# edit DATABASE_URL, SUPABASE_URL, SUPABASE_JWT_SECRET when those features land
pnpm --filter @acme/api dev
```

## Tests

```bash
pnpm --filter @acme/api test
```

Test strategy:

- **Unit** (Vitest) — pure domain functions in `src/domain/*`. Money math, FX conversion, analytics aggregations. Fast, no I/O.
- **Integration** (Vitest + supertest) — route handlers tested by calling `createApp()` and hitting it. DB-touching tests use a dedicated test database (configured per-test via `DATABASE_URL`).
- **No mocks of the database.** Integration tests run against a real Postgres so behaviour matches production.
