# Demo script

A ~3-minute walkthrough of the app. Use this as the script for the demo video.

Before recording:
1. Sign in once so you're on the employees page when recording starts.
2. Open Supabase Studio in a second tab so you can pull up DB rows on demand.
3. Have the example CSV from the Import page ready to demo.

## 1 · Open the app (0:00 – 0:15)

- "ACME Salary Management — replaces the spreadsheets HR was using to manage 10,000 employees across multiple countries."
- Point at the **green api-ok pill** in the header — "frontend and backend are talking."
- "Single role: HR Manager. Already signed in."

## 2 · Employees list (0:15 – 1:00)

- Highlight the total count in the header — "**10,000+ employees** seeded."
- Type "**aaron**" in the search box → results filter live.
- Clear, then pick **Country = IN** → filter chips into Indian employees only (~1,200 of them).
- "**Salary** column shows everyone's pay converted to USD. Switch to EUR…" → currency selector → values re-render.
- Click the **Salary** column header → sort descending → top earners surface.
- "Pagination is server-side — 50 per page, 200 pages, fast even with the 10k dataset because the filters use indexed columns."

## 3 · Employee detail + give raise (1:00 – 1:45)

- Click a row → detail page.
- Show the **profile grid + current salary callout**.
- **Salary history timeline** — "every salary the employee has ever had, append-only. The current one has the green dot."
- "Now I'll give them a raise." → **Give raise…** button → dialog.
  - Enter a new amount (slightly higher than current).
  - Pick a date a few months from now.
  - Type a reason — "Annual review".
  - Submit.
- Dialog closes, page re-renders → "**New row at the top of the history, marked Current. The old row now has an effective_to date.** Audit info — who made the change, when — visible at the bottom of the new row."
- Hover the green dot on the new row, click into Supabase Studio if you want to show the underlying `salaries` table for the same employee — two rows, both with the same `employee_id`, only one with `effective_to IS NULL`.

## 4 · CSV import (1:45 – 2:30)

- Navigate to **Import**.
- "This is the Excel migration story. HR exports CSV from their existing spreadsheets, we ingest it."
- Click **Load example** → dry-run report renders.
- "Two rows, both valid. **Dry-run validated them but didn't write anything.**"
- *(Optional)* Modify one of the example rows to be broken (paste into the file, re-upload), show the per-row error list.
- Click **Commit** → success banner with insert counts.
- Navigate back to **Employees**, search for the imported `ACME-00001` → row is there.

## 5 · Analytics dashboard (2:30 – 3:00)

- Navigate to **Analytics**.
- Walk left-to-right: **avg / median / p25 / p75** salary cards.
- **Headcount charts** — by country, by department.
- **Pay bands** — distribution histogram.
- **Top 10 earners** — names are linked, clicking takes you to detail.
- **Pay gap table** — "Indicative, not statistically controlled. Sample-size guard hides groups with fewer than five employees in either gender."
- Change the **country filter** to GB → all charts and tables update.
- Switch **display currency** to GBP → numbers re-render.

## 6 · Wrap (3:00)

- "10k employees, multiple countries, real auth, real DB, audit-tracked raises, dry-run-protected imports, filterable analytics. Built end-to-end in a paired session with Claude — full commit history shows the evolution."
- Recording stops.

## Talking points if there's time

- **Money handling**: amounts are stored as `bigint` minor units + ISO-4217 currency, never floats. Wire format is strings. No precision bugs.
- **Concurrency**: a partial unique index on `salaries` enforces "one current salary per employee" at the database level. Two raises racing produces a clean 409 conflict, not corrupted history.
- **Layering**: routes → controllers → services → repos → domain. Domain is pure and unit-tested; integration tests cover the auth seam.
- **ADRs**: 9 short markdown files in `docs/decisions/` capture every architectural decision with context and consequences.

## If a question comes up

- "Why Express, not Nest?" → see `docs/decisions/0004-backend-express-prisma-supabase.md`.
- "Why Supabase + Postgres, not SQLite?" → `docs/TRADE-OFFS.md#database`.
- "How does the give-raise transaction work?" → `docs/ARCHITECTURE.md#give-raise-flow`.
- "Why no pay-gap regression?" → `docs/REQUIREMENTS.md#out-of-scope`.
