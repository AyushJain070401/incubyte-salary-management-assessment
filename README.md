# ACME Salary Management

End-to-end web app that replaces ACME HR's spreadsheet-based salary management for ~10,000 employees across multiple countries. Built as the Incubyte assessment.

## Links

- 🌐 **Live demo**: <https://incubyte-salary-management-assessme.vercel.app>
- 🎬 **Demo video**: [`acme-salary-demo.mp4`](./acme-salary-demo.mp4) — ~90-second end-to-end walkthrough (silent screen-capture, scripted in [docs/DEMO.md](docs/DEMO.md))
- 🔑 **HR Manager credentials** (for the live demo):
  - email: `hr@acme.test`
  - password: `AcmeHR-2026!`

## Docs

| | |
|---|---|
| [**REQUIREMENTS.md**](docs/REQUIREMENTS.md) | One-page scope, persona, deliberate non-goals + reasoning. Written before any code. |
| [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | System diagram, ERD, sequence diagrams, layering, request lifecycle, testing seams. |
| [**TRADE-OFFS.md**](docs/TRADE-OFFS.md) | Thematic digest — money handling, FX, auth, DB, salary history, API surface, pagination, security, observability. |
| [**decisions/**](docs/decisions/) | 9 ADRs, one per architectural decision. |
| [**AI-USAGE.md**](docs/AI-USAGE.md) | Honest account of where AI did the lifting and where the human made the call. |
| [**DEMO.md**](docs/DEMO.md) | ~3-minute demo script. |
| [**DEPLOY.md**](docs/DEPLOY.md) | Step-by-step Vercel + Render + Supabase deploy. |

## What's in this v1

- 🔐 Supabase email-password sign-in, JWT-verified server-side (single role: HR Manager).
- 👥 Paginated employee list — 10k seeded — with country/department/status filters, full-text search across name/email/code, sortable columns including FX-aware salary sort, and a display-currency switcher (USD/EUR/GBP/INR/JPY).
- 📄 Employee detail with profile, current salary, and the full append-only **salary history timeline** including audit info (who, when, why).
- 💰 Transactional **give-raise** that closes the current row and inserts a new one in one DB transaction, with a partial unique index enforcing "one current salary per employee" at the database level.
- 📥 CSV **bulk import** with dry-run preview (per-row validation report + intra-file dup detection) before any database write.
- 📊 Analytics dashboard: headcount by country/department, salary distribution (avg + median + quartiles), pay-band histogram, top-10 earners, and an indicative pay-gap view with an n≥5 sample-size guard.
- 🌐 Multi-currency money handled as BigInt minor units + ISO-4217, with snapshot FX rates.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 18 + TypeScript + Tailwind v4 + TanStack Query + React Router + Recharts |
| Backend | Express + TypeScript + Prisma + jose (JWT) + papaparse |
| Database | Supabase Postgres (cloud, free tier) |
| Auth | Supabase Auth (email/password), JWT verified by the API |
| Validation | Zod (shared between web and api via `packages/shared`) |
| Tests | Vitest (unit + supertest integration on the api) |
| Deploy | Vercel (web) + Render (api) + Supabase (db) |

Each choice is documented as a short ADR in [`docs/decisions/`](docs/decisions/).

## Repo layout

```
apps/
  web/                  Vite + React frontend (port 5173 in dev)
  api/                  Express + Prisma backend  (port 4000 in dev)
packages/
  shared/               Zod schemas + DTO types shared by web and api
docs/
  decisions/            ADRs (one short file per decision)
  REQUIREMENTS.md       Goal, scope, non-goals + reasoning
  ARCHITECTURE.md       System diagrams + layering rules
  TRADE-OFFS.md         Cross-cutting decisions
  AI-USAGE.md           How AI was used in this project
  DEMO.md               Demo video script
  DEPLOY.md             Deploy step-by-step
render.yaml             Render blueprint for the api
apps/web/vercel.json    Vercel config for the SPA
```

## Local development

Prerequisites: **Node 22+**, **pnpm 11+**, a free **Supabase** project.

```bash
# 1. install deps
pnpm install

# 2. set up env files (one for each app)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
#   apps/api/.env:
#     DATABASE_URL          Supabase -> Settings -> Database -> Direct connection string
#     SUPABASE_URL          Supabase -> Settings -> API -> Project URL
#     SUPABASE_JWT_SECRET   Supabase -> Settings -> API -> JWT secret
#   apps/web/.env.local:
#     VITE_API_URL          http://localhost:4000  (default)
#     VITE_SUPABASE_URL     same as SUPABASE_URL
#     VITE_SUPABASE_ANON_KEY  Supabase -> Settings -> API -> anon public key

# 3. apply database migrations to your Supabase project
pnpm --filter @acme/api db:migrate

# 4. seed 10k employees (deterministic; ~7 seconds against Supabase free tier)
pnpm --filter @acme/api seed

# 5. start both apps in parallel
pnpm dev
# -> api on http://localhost:4000
# -> web on http://localhost:5173
```

Create an HR Manager account in **Supabase Studio → Authentication → Users → Add user**, then sign in at http://localhost:5173.

## Useful commands

| Command | Effect |
|---|---|
| `pnpm dev` | Start both apps in parallel |
| `pnpm test` | Run all workspace tests |
| `pnpm -r typecheck` | Type-check every workspace package |
| `pnpm --filter @acme/api db:migrate` | Apply outstanding migrations |
| `pnpm --filter @acme/api db:reset` | Drop, re-migrate, re-seed |
| `pnpm --filter @acme/api db:studio` | Open Prisma Studio against your DB |
| `pnpm --filter @acme/api seed` | Re-seed (idempotent — truncates first) |
| `pnpm --filter @acme/web build` | Production build for the SPA |
| `pnpm --filter @acme/api build` | Compile the api to `dist/` for production |

## Tests

39 tests, all running against the api workspace:

- **Domain** (`apps/api/src/domain/*.test.ts`) — 30 cases on money + FX math (BigInt + minor-unit precision, FX directional asymmetry, half-up rounding at large amounts).
- **Auth** (`apps/api/test/auth.test.ts`) — 8 cases on the JWT-verify middleware (missing/malformed/expired/anon/wrong-secret/valid).
- **Health** (`apps/api/test/health.test.ts`) — 1 supertest sanity check.

```bash
pnpm test
# Test Files  4 passed (4)
# Tests       39 passed (39)
```

Endpoint behaviour beyond the domain layer is verified live (curl against the running api with seeded data) — see commit messages for the captured outputs. Playwright E2E is intentionally deferred (noted in [REQUIREMENTS.md](docs/REQUIREMENTS.md)).

## Why this is structured the way it is

If you're reviewing the code, the most useful entry points are:

- The **commit log** — each commit is small, self-contained, and runnable. The story moves from requirements → schema → domain → seed → auth → endpoints → UI → deploy.
- [**TRADE-OFFS.md**](docs/TRADE-OFFS.md) — the digest of cross-cutting choices.
- [`docs/decisions/`](docs/decisions/) — for the why behind any specific decision, in chronological order.
- [`AI-USAGE.md`](docs/AI-USAGE.md) — for how AI was used.

## License

MIT — see [`LICENSE`](LICENSE).
