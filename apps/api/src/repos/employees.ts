import { Prisma } from '@prisma/client';
import type { EmployeeListQuery } from '@acme/shared';

import { prisma } from '../db/client.js';

// Row returned by listEmployees. Mirrors the shape the controller needs
// to assemble an EmployeeRead — repo returns raw, domain-typed values.
export type EmployeeListRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  country: string;
  department: string;
  role: string;
  level: string;
  hireDate: Date;
  status: string;
  gender: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentAmountMinor: bigint | null;
  currentCurrency: string | null;
  // Set when sorting by salary or whenever we computed the display amount.
  displayAmountMinor: bigint | null;
};

export type ListEmployeesResult = {
  items: EmployeeListRow[];
  total: number;
};

// Build a parameterized SQL WHERE fragment from the filter set. Each
// piece uses Prisma.sql so the placeholders are properly escaped — never
// string-concatenated user input.
function buildWhere(q: EmployeeListQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (q.country) conditions.push(Prisma.sql`e.country = ${q.country}`);
  if (q.department) conditions.push(Prisma.sql`e.department = ${q.department}`);
  if (q.role) conditions.push(Prisma.sql`e.role = ${q.role}`);
  if (q.status) conditions.push(Prisma.sql`e.status = ${q.status}`);
  if (q.search) {
    const like = `%${q.search}%`;
    conditions.push(
      Prisma.sql`(e.full_name ILIKE ${like} OR e.email ILIKE ${like} OR e.employee_code ILIKE ${like})`,
    );
  }

  if (conditions.length === 0) return Prisma.sql`TRUE`;
  return conditions.reduce<Prisma.Sql>(
    (acc, c, i) => (i === 0 ? c : Prisma.sql`${acc} AND ${c}`),
    Prisma.empty,
  );
}

// Map the controller's sort field to the SQL ORDER BY column. `salary`
// uses the joined+converted display amount; others map to the underlying
// employee column.
// Columns referenced here are from the outer `rows` CTE, not the
// employees alias `e` — `rows` flattens them out so they're accessible
// without a table prefix.
function orderByClause(q: EmployeeListQuery): Prisma.Sql {
  const dir = q.sortDir === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  switch (q.sortBy) {
    case 'fullName':
      return Prisma.sql`full_name ${dir}, id ASC`;
    case 'hireDate':
      return Prisma.sql`hire_date ${dir}, id ASC`;
    case 'createdAt':
      return Prisma.sql`created_at ${dir}, id ASC`;
    case 'salary':
      // NULLS LAST so employees without a salary on file don't dominate
      // an ascending sort.
      return Prisma.sql`display_amount_minor ${dir} NULLS LAST, id ASC`;
    default: {
      // exhaustiveness — caught at compile time by `never`
      const _: never = q.sortBy;
      return _;
    }
  }
}

// The list query. One round trip via a CTE that:
//  1. picks the current salary per employee (effective_to IS NULL),
//  2. picks the latest FX rate row matching (currency -> displayCurrency),
//  3. computes display_amount_minor = current * rate * 10^(target - source)
//     where the precision adjustment handles currencies with different
//     minor-digit counts (USD 2 vs JPY 0 etc.),
//  4. counts the filtered set in the same query via COUNT() OVER ().
export async function listEmployees(q: EmployeeListQuery): Promise<ListEmployeesResult> {
  const where = buildWhere(q);
  const orderBy = orderByClause(q);
  const offset = (q.page - 1) * q.perPage;

  // Static map of currency -> minor-unit digits, embedded as a CASE
  // expression so SQL can do the precision arithmetic.
  const minorDigitsCase = Prisma.sql`
    CASE
      WHEN s.currency IN ('JPY', 'KRW') THEN 0
      WHEN s.currency IN ('BHD', 'KWD', 'TND') THEN 3
      ELSE 2
    END
  `;
  const displayMinorDigits = Prisma.sql`
    CASE
      WHEN ${q.displayCurrency}::text IN ('JPY', 'KRW') THEN 0
      WHEN ${q.displayCurrency}::text IN ('BHD', 'KWD', 'TND') THEN 3
      ELSE 2
    END
  `;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      employee_code: string;
      full_name: string;
      email: string;
      country: string;
      department: string;
      role: string;
      level: string;
      hire_date: Date;
      status: string;
      gender: string | null;
      created_at: Date;
      updated_at: Date;
      current_amount_minor: bigint | null;
      current_currency: string | null;
      display_amount_minor: bigint | null;
      total_count: bigint;
    }>
  >(Prisma.sql`
    WITH current_salary AS (
      SELECT
        s.employee_id,
        s.amount_minor,
        s.currency,
        ${minorDigitsCase} AS source_digits
      FROM salaries s
      WHERE s.effective_to IS NULL
    ),
    fx AS (
      SELECT DISTINCT ON (base_currency, quote_currency)
        base_currency, quote_currency, rate
      FROM fx_rates
      WHERE quote_currency = ${q.displayCurrency}
      ORDER BY base_currency, quote_currency, as_of DESC
    ),
    rows AS (
      SELECT
        e.id, e.employee_code, e.full_name, e.email, e.country,
        e.department, e.role, e.level, e.hire_date, e.status, e.gender,
        e.created_at, e.updated_at,
        cs.amount_minor AS current_amount_minor,
        cs.currency      AS current_currency,
        CASE
          WHEN cs.amount_minor IS NULL THEN NULL
          WHEN cs.currency = ${q.displayCurrency} THEN cs.amount_minor
          WHEN fx.rate IS NULL THEN NULL
          ELSE ROUND(
            cs.amount_minor::numeric
              * fx.rate
              * POWER(10, ${displayMinorDigits} - cs.source_digits)
          )::bigint
        END AS display_amount_minor
      FROM employees e
      LEFT JOIN current_salary cs ON cs.employee_id = e.id
      LEFT JOIN fx ON fx.base_currency = cs.currency
      WHERE ${where}
    )
    SELECT *, COUNT(*) OVER ()::bigint AS total_count
    FROM rows
    ORDER BY ${orderBy}
    LIMIT ${q.perPage}
    OFFSET ${offset}
  `);

  const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      employeeCode: r.employee_code,
      fullName: r.full_name,
      email: r.email,
      country: r.country.trim(), // CHAR(2) is right-padded in postgres
      department: r.department,
      role: r.role,
      level: r.level,
      hireDate: r.hire_date,
      status: r.status.trim(),
      gender: r.gender,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      currentAmountMinor: r.current_amount_minor,
      currentCurrency: r.current_currency?.trim() ?? null,
      displayAmountMinor: r.display_amount_minor,
    })),
    total,
  };
}
