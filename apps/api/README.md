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
# 1. start Postgres (docker-compose.yml at repo root)
docker compose up -d

# 2. configure env
cp apps/api/.env.example apps/api/.env
# defaults work against the docker-compose Postgres

# 3. run migrations + generate prisma client
pnpm --filter @acme/api db:migrate

# 4. start the api
pnpm --filter @acme/api dev
```

## Database

Prisma schema lives in `prisma/schema.prisma`; migrations live in
`prisma/migrations/`. The migration history is committed to the repo —
production deploys run `prisma migrate deploy` (no schema diffing) to
apply only what's checked in.

Local commands:

| Command | Use |
|---|---|
| `pnpm db:migrate` | Apply outstanding migrations, generate client |
| `pnpm db:deploy` | Apply migrations only (used in CI / prod) |
| `pnpm db:reset` | Drop the database, re-run all migrations, re-seed |
| `pnpm db:studio` | Open Prisma Studio to inspect data |
| `pnpm db:generate` | Regenerate the Prisma client after schema edits |

## Tests

```bash
pnpm --filter @acme/api test
```

Test strategy:

- **Unit** (Vitest) — pure domain functions in `src/domain/*`. Money math, FX conversion, analytics aggregations. Fast, no I/O.
- **Integration** (Vitest + supertest) — route handlers tested by calling `createApp()` and hitting it. DB-touching tests use a dedicated test database (configured per-test via `DATABASE_URL`).
- **No mocks of the database.** Integration tests run against a real Postgres so behaviour matches production.
