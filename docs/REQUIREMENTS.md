# Requirements — ACME Salary Management

**Status:** v1, written before any code. Will be updated only if scope materially changes; changes recorded in commit history.

## Goal

Replace ACME HR's spreadsheet-based salary management with a web app that lets a single HR Manager **manage** salary data for ~10,000 employees across multiple countries and **answer questions** about how the org pays people.

## Persona

**HR Manager.** Single user role for v1. Comfortable with spreadsheets, not technical. Cares about: finding any employee quickly, recording raises with a reason, importing what they already have in Excel, and getting straight answers to questions like *"what's the median salary for engineers in India?"* without writing a formula.

## Problem context

Today: salary data for 10,000 employees lives in spreadsheets, edited by hand, across multiple countries (hence multiple currencies). Errors are easy, history is lost on overwrite, and cross-country questions require manual pivoting. The HR Manager wants the same data but with structure, history, and one place to ask questions.

## In scope (v1)

| # | Capability | Why it's in |
|---|---|---|
| 1 | **HR Manager login** (email/password) | Auth is non-negotiable for salary data; one role is enough to demonstrate it. |
| 2 | **Employee directory** — paginated list with search (name/code/email), filter (country, department, role, status), sort (salary in display currency) | The "find anyone in 10 seconds" job. The 10k scale matters here — server-side pagination + indexed filters, not client-side. |
| 3 | **Employee detail + immutable salary history** | The history is the *thing* spreadsheets lose. Showing it is the headline differentiator vs. Excel. |
| 4 | **Give raise** — transactional close-current + insert-new, with `reason` + `changed_by` audit | HR's most frequent write. Audit columns (who/when/why) reframe this from a toy mutation into something an HR team would actually trust. |
| 5 | **Create / edit employee** — basic form with validation | Needed to add new hires without a re-import. |
| 6 | **CSV bulk import with dry-run preview** | This *is* the migration-from-Excel story. Dry-run-then-commit shows engineering rigor — validate before mutating. |
| 7 | **Analytics dashboard** (MVP): headcount by country/department, avg + median + p25/p75 salary (overall and grouped), top-10 earners, pay-band histogram. All filterable. | The "answer questions" half of the goal. SQL aggregates, not in-memory JS — must work at 10k. |
| 8 | **Display-currency switcher** (USD/EUR/GBP/INR) backed by a snapshot FX table | Multi-country is hollow without this. Snapshot (not live FX) keeps the system deterministic and testable. |
| 9 | **Seed script** — 10,000 deterministic employees with 1–4 historical salary rows each, idempotent (truncate-and-reinsert) | The grader can re-run `pnpm seed` and get the same DB. No flaky demos. |

## Out of scope (v1) — and why

| Cut | Why we cut it |
|---|---|
| **Payroll execution, tax, deductions, payslips** | Goal is *management* of salary data, not running payroll. Each of these is a separate domain with regulatory weight; faking them would be worse than omitting them. |
| **Employee self-service portal** | Persona is HR Manager only. A second persona doubles the auth, RBAC, and UI surface for no signal on the actual goal. |
| **Approval workflows / maker-checker** | Real HR systems have them, but they require a second role (approver) which we don't have. Mentioned in `TRADE-OFFS.md` as the next thing we'd add for production. |
| **Field-level encryption of salary amounts** | A production system would do this; an assessment focused on engineering judgment doesn't need it (Supabase TLS + at-rest disk encryption is honest baseline). Called out explicitly in trade-offs. |
| **Fine-grained RBAC beyond HR Manager** | Single role is enough to show auth-gating works. Multi-role permissioning is a separate, large concern. |
| **Real-time FX rates** | Live FX makes tests non-deterministic and adds a third-party dependency for marginal product value (HR doesn't usually convert at the millisecond mark). Snapshot table → same answer every run. |
| **Multi-tenant / multi-org** | Problem statement is one org (ACME). Tenancy would force schema and auth changes everywhere. |
| **Pay-gap analytics beyond an indicative view** | We *do* ship an indicative pay-gap view (gated by n≥5 per group, labelled "not statistically controlled") because it's a fair question for the HR persona to ask. We do **not** ship a regression-controlled gap analysis — that's a research project, not a v1 feature. |
| **Org chart / manager hierarchy** | No consumer in the in-scope features. Adding `manager_id` would be schema-bloat for v1. |
| **Notifications / email** | Not part of the questions HR wants answered. Skipped. |
| **Mobile app / responsive polish** | Desktop-first; the persona uses a laptop. Pages will be usable but not optimized for phones. |

## Success criteria

1. HR Manager can find any of 10,000 employees in under 10 seconds via search or filter.
2. Giving a raise produces an audited, immutable history row visible on the detail page within one click.
3. The dashboard answers "median salary for X in country Y" in under 1 second against 10k rows.
4. Importing a CSV with one bad row blocks the entire commit and shows *which* row failed and *why*.
5. `pnpm install && pnpm db:reset && pnpm seed && pnpm dev` works on a fresh clone with only env vars to fill in.
6. Repo can be cloned, deployed, and demoed end-to-end by someone other than the author.

## Constraints, assumptions, and ground rules

- **Scale:** 10,000 employees is small for Postgres. Performance work is targeted (pagination, indexed filters, SQL aggregates) — no caching layer needed.
- **Currency:** all amounts stored as `bigint` minor units (cents/paise/etc.) + ISO-4217 currency code. Display conversion happens at the read layer using the snapshot FX table.
- **Salary history:** salaries are immutable rows; "current" = the one row per employee with `effective_to IS NULL`. A raise closes the current row and inserts a new one in a single transaction.
- **Auth:** Supabase Auth (email/password). One role: `hr_manager`. All backend routes verify Supabase JWT.
- **Determinism:** seed uses a fixed Faker seed; FX rates come from a fixed snapshot. The same `pnpm seed` produces the same DB every time.
- **AI usage:** AI is used intentionally to accelerate scaffolding, schema drafting, test stubs, and prose. All decisions (scope, data model, money handling, auth approach, what to cut) are human-made. AI usage is documented in `docs/AI-USAGE.md`.

## Out-of-scope items we'd add *next* (for a real production rollout)

In rough priority order, so the reviewer can see the runway:

1. Approval workflows for raises above a threshold (maker-checker).
2. Field-level encryption of salary amounts at rest.
3. Audit log table separate from `salaries` (every read, not just writes).
4. Employee self-service portal (separate persona, separate auth).
5. Org chart / manager hierarchy + manager-level reporting.
6. Live FX with cached fallback for high-volatility currencies.
7. Compensation planning workflows (cycles, budgets, modeling).
