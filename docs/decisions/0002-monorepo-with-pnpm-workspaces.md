# ADR 0002: Monorepo with pnpm workspaces

## Status

accepted — 2026-06-23

## Context

The project is a frontend + backend + a small amount of shared code (Zod schemas, DTO types). The two apps need to stay in sync on the wire format. Three options:

1. **Two separate repos** + a published npm package for shared code. Realistic for production but heavy ceremony for an assessment (versioning, publishing, CI cross-coordination).
2. **One repo with a single `package.json`** (no workspaces). Simple but conflates frontend and backend deps — Vite plugins sit next to Express middleware.
3. **Monorepo with workspaces.** Each app has its own `package.json` and its own deps. Shared code lives in a workspace package that the others import by name.

The shared-code requirement (Zod schemas reused on both sides) makes option 1 painful — every schema change is a publish-bump-install dance. Option 2 muddles dependency boundaries and would hurt grader readability. Option 3 fits.

Between npm/yarn/pnpm workspaces: pnpm is the modern default, has the fastest install, and uses a content-addressable store that keeps disk usage low. We're already on it locally.

## Decision

Single repo, pnpm workspaces, two top-level directories:

- `apps/web` — Vite + React frontend.
- `apps/api` — Express + Prisma backend.
- `packages/shared` — Zod schemas + TypeScript DTO types, imported as `@acme/shared` by both apps.

Workspace declared in `pnpm-workspace.yaml`. Root `package.json` holds only repo-wide dev tooling (Prettier, TypeScript) and `pnpm -r` orchestration scripts.

A shared `tsconfig.base.json` at the root holds compiler options every package extends.

## Consequences

**Easier:**
- One `pnpm install` sets up everything.
- Schema changes in `packages/shared` are picked up by both apps immediately — no publish step.
- The repo layout itself shows the reviewer the boundary between frontend, backend, and shared contract.
- Per-app `package.json` keeps frontend and backend deps cleanly separated.

**Harder:**
- The reviewer needs `pnpm` (not `npm`). Documented in the README and `.nvmrc` / `packageManager` field.
- Vitest needs minor workspace-aware config (each app runs its own tests). Not painful.

**Not chosen — and why:**
- **Turborepo or Nx:** real value at scale but adds another layer to learn for the reviewer. With only three packages, `pnpm -r` is enough.
- **Bun workspaces:** Bun is fine but Node 22 + pnpm is the more conventional choice for a backend-oriented assessment; the reviewer is more likely to have it set up.
