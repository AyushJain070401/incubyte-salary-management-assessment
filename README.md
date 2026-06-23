# ACME Salary Management

Web app that replaces ACME HR's spreadsheet-based salary management for ~10,000 employees across multiple countries. Built as an Incubyte assessment.

> **Status:** in active development. Live URL and demo video will be added in the final commit.

## Quick links

- [Requirements (one page)](docs/REQUIREMENTS.md)
- [Architecture decisions (ADRs)](docs/decisions/)
- [Architecture overview](docs/ARCHITECTURE.md)
- [Trade-offs](docs/TRADE-OFFS.md)
- [AI usage notes](docs/AI-USAGE.md) — _coming in final commit_
- [Demo script](docs/DEMO.md) — _coming in final commit_

## Stack at a glance

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query |
| Backend | Express + TypeScript + Prisma |
| Database | Postgres (Supabase) |
| Auth | Supabase Auth (email/password), JWT verified by the API |
| Validation | Zod (shared between web and api via `packages/shared`) |
| Tests | Vitest (unit + integration) + Supertest (API) + Playwright (one smoke E2E) |
| Deploy | Vercel (web) + Render (api) + Supabase (db) |

Each choice is documented as an ADR in [`docs/decisions/`](docs/decisions/).

## Repo layout

```
apps/
  web/        Vite + React frontend
  api/        Express + Prisma backend
packages/
  shared/     Zod schemas and DTO types shared between web and api
docs/
  decisions/  Architecture Decision Records (one short file per decision)
  REQUIREMENTS.md
  ARCHITECTURE.md
  TRADE-OFFS.md
  AI-USAGE.md
  DEMO.md
```

## Local development

> Full setup instructions land alongside the scaffolding commits. This section will be filled in as the apps come online.

Prerequisites: Node 22+, pnpm 9+, a Supabase project (free tier).

```bash
pnpm install
# ... env setup, db reset, seed, dev — to be documented
```
