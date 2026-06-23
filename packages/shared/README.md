# @acme/shared

Zod schemas and TypeScript DTO types shared between the web frontend and the API backend. The single source of truth for the wire format.

Consumed by:

- `apps/web` — form validation (via `zod` + `react-hook-form` resolver) and parsing API responses.
- `apps/api` — request validation at the edge of every route handler.

No build step. The package is imported by source — `apps/web` (Vite) and `apps/api` (tsx/esbuild) both handle TypeScript natively.

## Conventions

- One file per resource (e.g. `employee.ts`, `salary.ts`, `pagination.ts`).
- Each file exports the Zod schema **and** the inferred TypeScript type with the same name pattern: `EmployeeCreateSchema` + `EmployeeCreate`.
- No domain logic here. This package is contracts only.
