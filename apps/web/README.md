# @acme/web

Vite + React + TypeScript frontend for ACME Salary Management.

## Layout

```
src/
  main.tsx                entry — mounts <App /> inside QueryClientProvider
  App.tsx                 top-level shell
  styles.css              tailwind v4 entry (@import "tailwindcss")
  api/
    client.ts             typed fetch wrapper with shared base URL + ApiError
  components/
    ApiHealth.tsx         tiny status pill that polls GET /health
```

Schemas and DTO types come from `@acme/shared` (workspace package). The web app never declares its own request/response shapes — all of that lives in the shared package and the api validates against the same source.

## Local dev

```bash
cp apps/web/.env.example apps/web/.env.local
# defaults work for local; edit VITE_SUPABASE_* when auth lands
pnpm --filter @acme/web dev
```

Visit http://localhost:5173.

## Tests

```bash
pnpm --filter @acme/web test
```

Vitest + Testing Library + jsdom. Unit tests for components; integration with MSW (when wired) for API-touching components.
