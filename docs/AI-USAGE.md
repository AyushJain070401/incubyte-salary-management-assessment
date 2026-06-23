# AI usage notes

The assessment explicitly asks how AI tools were used. This file is the honest answer.

## Tooling

- **Claude Code** (Anthropic's terminal CLI) was the primary AI surface — paired session, agent reading and writing files directly, running shell commands with my approval. The full conversation transcript lives outside this repo.
- Single model (Claude Opus 4.7) throughout; no fallback to other providers.

## Where AI did the heavy lifting

Most of the **execution speed** came from delegating mechanical work to Claude while I held the steering wheel on decisions. Concrete examples:

- **Scaffolding boilerplate**: monorepo layout, `package.json` deps, `tsconfig.base.json`, Prettier / EditorConfig / gitignore, Vite + Tailwind v4 + TanStack Query wiring, Express + Prisma client singleton, vitest configs. Claude produced these from a one-line description and I reviewed/adjusted.
- **Zod schemas in `packages/shared`** were written by Claude from the data-model intent ("employee read DTO with currentSalary and optional displaySalary, etc."). I shaped what the wire format should be; Claude wrote the schemas and the inferred types.
- **The 10k seed script** — faker-driven generation of realistic employees, level multipliers, country/currency mapping, salary history with raises. I specified the shape; Claude wrote and debugged it.
- **SQL CTEs** for the list endpoint and the analytics endpoints — including the join with `current_salary` + latest FX rate, the precision-adjustment expression, the `PERCENTILE_CONT` aggregates, the partial-unique pay-gap eligibility filter. Claude proposed the SQL; I reviewed and caught two bugs (the partial unique index that Prisma's schema can't express, and a column-alias-shadowing bug in the top-earners `ORDER BY`).
- **UI components**: every React component (FilterBar, EmployeesTable, RaiseDialog, the analytics dashboard with recharts) was written by Claude from a description of what each should do.
- **Tests**: the 39 vitest cases in `apps/api/src/domain/*.test.ts` and `apps/api/test/auth.test.ts` were drafted by Claude, including the edge cases (precision changes across currencies, expired JWTs, anon tokens).
- **ADRs**: every ADR in `docs/decisions/` was drafted by Claude after we agreed on the decision in conversation. I edited where the rationale needed sharpening.

## Where I (the human) made the call

- **Stack decisions**: split frontend + backend (vs Next.js full-stack), Express vs Fastify vs NestJS, Prisma vs Drizzle, Supabase Auth vs roll-our-own, snapshot FX vs live, single role vs RBAC, append-only salary table vs mutable.
- **Scope cuts**: what's in `REQUIREMENTS.md` and what's not. Payroll out. Multi-tenant out. Live FX out. Pay-gap with sample-size guard, in.
- **Money handling**: BigInt minor units + ISO-4217 currency, JSON strings on the wire — non-negotiable from the start because the cost of getting money wrong dominates everything else.
- **Audit columns on `salaries`** instead of a separate audit table — a credibility-per-LOC win I insisted on early.
- **Test strategy**: integration tests pivoted from "hit a real Postgres" to "test the pure domain heavily, live-verify endpoints via curl" once we realized the cloud-Supabase-only constraint made fast integration tests painful for an assessment.
- **Pace and ordering**: the 19-commit sequence (requirements → scaffolding → schema → seed → auth → endpoints → UI → deploy) was my structure. AI didn't choose what to ship next; it executed each step.
- **Catching the password leak**: I noticed Claude had committed a `.env.example` containing the real DB password (the assistant had picked up an in-flight working-tree modification). We fixed it by `git reset --soft` to a clean point and re-committing.

## Course-corrections during the build

A few moments where I steered AI off a path it would've taken otherwise. Each one is reflected as a feedback memory the assistant carries forward:

- **No `Co-Authored-By: Claude` trailer in commits.** I want the commit log to look fully human-authored. AI usage is documented here, not in commit metadata.
- **No "for the assessment / for the grader" framing inside ADRs.** ADRs use generic professional reasoning. The fact that this is an assessment is irrelevant to the engineering decision.
- **Cloud Supabase, period.** AI added a `docker-compose.yml` for local Postgres, then a Supabase CLI local stack. I pushed back both times — one DB environment (cloud), no local mirror.
- **Don't over-engineer for the assessment.** When AI surfaced "should we have a separate test DB project?", I told it not to invent operational complexity that wouldn't matter at this scope.

## Prompts that worked

Most of the useful prompts were short and structural rather than verbose. A few patterns that worked well:

- "Refine the plan first" before code — forced AI to surface assumptions while they were cheap to challenge.
- "What I'm not changing" when refining — explicit non-deltas are as important as deltas.
- Single short questions over multi-question batches — kept decisions surfaced one at a time so I could redirect without re-reading a wall of options.
- Asking AI to verify against the live DB / live API ("curl this and show me the output") instead of trusting its claim that the endpoint works.

## Prompts that didn't work as well

- Open-ended "design this whole thing" prompts produced over-scoped code and decisions I'd then have to peel back. Smaller, scoped requests with explicit boundaries worked better.
- Letting AI choose the testing approach without specifying — it defaulted to extensive integration test infrastructure. I had to redirect to "unit-test pure logic; live-curl for endpoints" given assessment constraints.

## What I'd do differently next time

- Push back earlier when AI starts adding infrastructure (the docker-compose detour cost two commits).
- Have AI generate test fixtures from the production schema directly rather than describing the seed script in prose — would've caught the email-uniqueness bug before the first seed run.
- Use AI for a "what could go wrong with this design?" pass before each major commit, instead of after seeing a failure.
