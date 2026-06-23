# ADR 0008: JWT verification middleware + typed error envelope

## Status

accepted — 2026-06-23

## Context

The application needs to authenticate every request to its protected routes. The identity provider (Supabase Auth) issues short-lived JWTs to the SPA after login; the API verifies those JWTs on every request and attaches the user identity to the request context. Two related decisions live in this commit:

1. **How to verify the JWT.**
2. **How errors propagate from middleware and handlers back to the client.**

### JWT verification

Supabase Auth issues HS256 JWTs signed with each project's `JWT_SECRET`. Verification options:

- **jsonwebtoken** — the de-facto Node JWT library. CJS-first, has historical CVEs around algorithm confusion, requires `algorithms: ['HS256']` to be passed explicitly (omit it and the library accepts unsigned tokens).
- **jose** — modern, ESM-first, smaller bundle, opinionated about algorithm specification (you must declare it). Used by `next-auth`, `@auth/core`, and most newer projects.
- **Manually decode + verify** — risk-of-getting-it-wrong is too high; never the right call for new code.

### Error propagation

A typical Express handler that calls a service can throw or `next(err)` for: a Zod validation failure, a not-found, a duplicate-row conflict, an unhandled exception. Without a central pattern, each handler ends up shaping its own response, which:

- drifts in shape (some handlers `res.status(404).json({...})`, others `res.json({error: ...})`),
- leaks internal details (stack traces, ORM error codes), and
- forces every handler to reason about error mapping inline.

A centralised error-handling middleware fixes this — every thrown error maps to the same wire envelope by type.

## Decision

### JWT verification

- **`jose`** for verification. `jwtVerify(token, secret, { algorithms: ['HS256'] })` — algorithm is locked, signature + `exp` checked automatically.
- The verifier is mounted as Express middleware (`requireAuth`) and applied to the `/api` router only. Public routes (`/health`) sit outside this gate.
- On success, the middleware attaches `req.user: AuthenticatedUser` to the request. `AuthenticatedUser` is a discriminated record (`{ id, email, role }`) declared in `src/types/auth.ts`, which also augments `Express.Request` so downstream handlers get the type without casts.
- `anon`-role tokens are explicitly rejected — Supabase issues those for public access, and they're not valid identities for protected endpoints.
- The verifier validates a Zod schema over the JWT payload (`sub`, `email`, `role`, `exp`). A token missing `sub` or with an unexpected role is 401, not a runtime error 50 lines deep into a controller.

### Error envelope

- **Single, typed envelope.** All non-2xx responses use the shape defined by `ApiErrorBodySchema` in `@acme/shared`:
  ```json
  { "error": "<code>", "message": "<human>", "issues"?: [...] }
  ```
- **`ApiError` class** in `src/middleware/errors.ts` carries an `ApiErrorCode` + HTTP status + message. Services and middleware throw it; the global error handler maps it to the wire envelope. Static helpers (`ApiError.unauthorized()`, `ApiError.notFound()`, …) keep call sites short.
- **`errorHandler` middleware** (mounted last in `app.ts`) is the only place that writes error responses. It dispatches by type:
  - `ApiError` → its declared status + envelope
  - `ZodError` → 400 with `issues` array
  - anything else → 500 with a generic message (stack logged via pino, never returned to the client)
- Request-scoped logger (`req.log`) attached by `pino-http` is used for the 500-case log so the request id ties the stack trace to the failed response.

### Test surface

`test/auth.test.ts` covers 8 cases against a freshly-built `createApp()`:

- missing Authorization header → 401
- non-Bearer scheme → 401
- malformed JWT → 401
- JWT signed with a different secret → 401 (validates the signature check, not just decoding)
- expired JWT → 401 (validates `exp` is enforced)
- `anon`-role JWT → 401
- JWT missing required claims (`sub`) → 401
- valid Supabase-shaped JWT → 200, `req.user` populated

Test JWTs are signed with the same `TEST_SECRET` set in `vitest.config.ts`, so the same verification path runs in tests as in production.

## Consequences

**Easier:**
- Every protected handler can assume `req.user` is set — no per-route auth checks.
- Adding a new public route is one line in `app.ts`; the default is "protected".
- The single error envelope means the SPA's error handling is one parser, one switch on `error` code.
- The 8 auth tests run in ~15ms total; no network, no Supabase round-trip.

**Harder:**
- The API now hard-fails to start if `SUPABASE_URL` or `SUPABASE_JWT_SECRET` are missing from the env. Intentional — silent fall-through to "auth disabled" is a worse failure mode than a startup error.
- Two-place coordination: rotating the JWT secret in Supabase requires updating the API's env var. Documented in the README's env section.

**Not chosen — and why:**
- **jsonwebtoken**. Older API, CJS interop, the algorithm-confusion footgun. `jose` is the better default for new code.
- **JWKS-based verification** (Supabase exposes a JWKS endpoint via `/auth/v1/.well-known/jwks.json` for RS256 in newer projects). HS256 + shared secret is what Supabase issues by default and is sufficient — moving to JWKS would be a future-decision when needed (multi-issuer / key rotation without redeploy).
- **Auth as a service decorator pattern** (e.g. `@authenticated` on each route). Decorator wrappers obscure the request pipeline; explicit middleware on the router boundary is easier to reason about and matches the rest of the Express ecosystem.
- **Distributed error mapping** (each route shapes its own error response). Drift is the failure mode. Centralised handler is the standard pattern for a reason.
