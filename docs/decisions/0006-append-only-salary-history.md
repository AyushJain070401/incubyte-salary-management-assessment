# ADR 0006: Append-only salary history with a partial unique constraint

## Status

accepted — 2026-06-23

## Context

The application needs to record an employee's compensation over time. Two question to answer:

1. How is salary history represented in the schema?
2. How is the "current salary" invariant enforced — exactly one current row per employee — under concurrent writes?

### Schema shape

- **Mutable column on `employees` + a separate `salary_history` table.** Two places to keep in sync, easy to drift. The current salary on the employee row could disagree with the latest row in the history table after a partial failure.
- **Append-only `salaries` table only.** The "current" salary is derivable: `WHERE employee_id = $1 AND effective_to IS NULL`. There is no separate "current" field to keep in sync, because there is no separate place.
- **ORM-managed temporal tables.** Adds a dependency on an ORM extension; the conventional table-with-effective-dates pattern is portable and well-understood.

### Concurrency invariant

A raise:

1. Closes the current row by setting `effective_to = $effectiveFrom - 1 day`.
2. Inserts a new row with `effective_to = NULL`.

Without coordination, two raises submitted concurrently could each see the same "current" row, each close it, each insert a new "current" row — leaving the employee with **two** current rows. The application-level transaction (`BEGIN/COMMIT`) ensures atomicity but not isolation against this race; both transactions could read the same starting state at `READ COMMITTED`.

Options for enforcement:

- **`SERIALIZABLE` isolation level on the raise transaction.** Correct but pessimistic; every concurrent raise on different employees would also retry on serialization failures.
- **Application-level lock (Redis, advisory lock).** Adds infrastructure and a failure mode.
- **Partial unique constraint at the database.** `CREATE UNIQUE INDEX ... ON salaries(employee_id) WHERE effective_to IS NULL`. The database refuses the second `INSERT` with a unique-violation error; the second transaction's `COMMIT` fails and rolls back. Simple, correct, no application code.

## Decision

1. Salary history is the `salaries` table, append-only. The current salary for an employee is the row where `effective_to IS NULL`. A raise closes the current row and inserts a new one, in one transaction (`prisma.$transaction([...])`).
2. The invariant "at most one current salary per employee" is enforced by a partial unique index:
   ```sql
   CREATE UNIQUE INDEX salaries_current_uniq
       ON salaries (employee_id)
       WHERE effective_to IS NULL;
   ```
   The index is declared in `prisma/migrations/20260623000000_init/migration.sql`; Prisma's schema language can't express it directly.
3. Audit fields (`reason`, `changed_by`, `changed_at`) live on the salary row itself rather than in a separate audit table. The history *is* the audit log.

## Consequences

**Easier:**
- "Show me Jane's salary on 2024-06-01" is one query: `WHERE employee_id = $jane AND effective_from <= '2024-06-01' AND (effective_to IS NULL OR effective_to >= '2024-06-01')`.
- "Who gave Jane her last raise and why" is one row.
- The DB refuses to enter the inconsistent state. The application doesn't have to defend the invariant in code.
- No background reconciliation jobs; nothing to keep in sync.

**Harder:**
- A raise is two SQL statements wrapped in a transaction, not a one-line UPDATE. The transactional boundary lives in the service layer.
- The second concurrent raise gets a `23505` unique-violation error rather than a domain-level error. The service maps this to a `409 conflict` response with a human-readable message; the API client retries if it chooses.
- The partial unique index is Postgres-specific. We use Postgres in dev and prod; if we ever target a database without partial indexes, this would need rework. Documented and accepted.

**Not chosen — and why:**
- **`SERIALIZABLE` isolation.** Higher retry rate, slower under load, more code to handle retries. The partial unique index gives us the same correctness for free.
- **Distributed lock.** Adds Redis and a failure mode for a problem the database can solve directly.
- **Separate audit table.** A future "every read is audited" requirement would warrant one; the v1 requirement is "every salary change is auditable", which the per-row columns satisfy. If the audit scope grows, we'd add a generic `audit_log` table then.
