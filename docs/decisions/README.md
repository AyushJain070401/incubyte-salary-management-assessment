# Architecture Decision Records (ADRs)

Each non-trivial technical decision in this project gets its own short file here. The point is that future-me (and the reviewer) can read the *why* alongside the *what*, in the order the decisions were made.

## Format

One ADR per file, named `NNNN-kebab-title.md`. Numbering is monotonically increasing — never reused, never reordered. Each ADR has the same four sections:

- **Status** — `accepted`, `superseded by NNNN`, `deprecated`, or `proposed`.
- **Context** — what's true at the moment of deciding; what forces are at play.
- **Decision** — what we're doing, stated affirmatively.
- **Consequences** — what becomes easier and what becomes harder. Honest, not aspirational.

Each ADR should be readable in under a minute. If it's longer, it's probably trying to be two ADRs.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions in ADRs | accepted |
| [0002](0002-monorepo-with-pnpm-workspaces.md) | Monorepo with pnpm workspaces | accepted |
| [0003](0003-split-frontend-and-backend.md) | Split frontend (Vite) and backend (Express), with a shared contracts package | accepted |
| [0004](0004-backend-express-prisma-supabase.md) | Backend = Express + Prisma + Supabase (Postgres + Auth) | accepted |
