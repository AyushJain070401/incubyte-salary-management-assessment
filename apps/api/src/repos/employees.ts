import { Prisma } from '@prisma/client';
import type { EmployeeListQuery } from '@acme/shared';

import { prisma } from '../db/client.js';

// Shape returned by getEmployeeById. Same columns as the list row but
// without the FX-conversion fields — the detail endpoint doesn't need
// them (it shows native currency).
export type EmployeeDetailRow = {
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
};

export type SalaryHistoryRow = {
  id: string;
  employeeId: string;
  amountMinor: bigint;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  reason: string | null;
  changedBy: string | null;
  changedAt: Date;
};

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

// Single-employee read with current salary attached. Returns null if no
// row matches (controller maps to 404).
export async function getEmployeeById(id: string): Promise<EmployeeDetailRow | null> {
  const row = await prisma.employee.findUnique({
    where: { id },
    include: {
      salaries: {
        where: { effectiveTo: null },
        take: 1,
      },
    },
  });

  if (!row) return null;

  const current = row.salaries[0];

  return {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    email: row.email,
    country: row.country.trim(),
    department: row.department,
    role: row.role,
    level: row.level,
    hireDate: row.hireDate,
    status: row.status.trim(),
    gender: row.gender,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    currentAmountMinor: current?.amountMinor ?? null,
    currentCurrency: current?.currency.trim() ?? null,
  };
}

// Newest-first salary history for an employee. Includes all rows
// (current + historical).
export async function listSalariesByEmployee(
  employeeId: string,
): Promise<SalaryHistoryRow[]> {
  const rows = await prisma.salary.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    amountMinor: r.amountMinor,
    currency: r.currency.trim(),
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    reason: r.reason,
    changedBy: r.changedBy,
    changedAt: r.changedAt,
  }));
}

// Transactional give-raise: close the current row and insert a new one.
// Returns the new row.
//
// Validation that runs inside the transaction:
//   - the employee exists (else throws Prisma P2025-style)
//   - the new effectiveFrom is strictly later than the current
//     row's effectiveFrom (else throws — controller maps to 422)
//
// The partial unique index `salaries_current_uniq` enforces "one
// current salary per employee" at the database level — if two raises
// race, the second INSERT fails with a 23505 unique-violation and the
// whole transaction rolls back. Controller maps to 409 conflict.
export type GiveRaiseInput = {
  employeeId: string;
  amountMinor: bigint;
  currency: string;
  effectiveFrom: Date;
  reason: string | null;
  changedBy: string;
};

export async function giveRaise(input: GiveRaiseInput): Promise<SalaryHistoryRow> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.salary.findFirst({
      where: { employeeId: input.employeeId, effectiveTo: null },
    });

    if (current) {
      if (input.effectiveFrom <= current.effectiveFrom) {
        // Hoist out as a typed signal — controller catches and maps.
        throw new RaiseValidationError(
          `effectiveFrom (${input.effectiveFrom.toISOString().slice(0, 10)}) must be after the current salary's effective_from (${current.effectiveFrom.toISOString().slice(0, 10)})`,
        );
      }

      // Close the current row: effective_to = effective_from - 1 day.
      const closingDate = new Date(input.effectiveFrom);
      closingDate.setUTCDate(closingDate.getUTCDate() - 1);

      await tx.salary.update({
        where: { id: current.id },
        data: { effectiveTo: closingDate },
      });
    } else {
      // No current row — either a new hire whose initial salary is
      // being set, or the data is missing. Either way, just insert.
      // The employee must still exist; verify before insert so we can
      // distinguish "missing employee" from a unique-violation race.
      const exists = await tx.employee.findUnique({
        where: { id: input.employeeId },
        select: { id: true },
      });
      if (!exists) throw new RaiseValidationError('employee not found');
    }

    const inserted = await tx.salary.create({
      data: {
        employeeId: input.employeeId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        reason: input.reason,
        changedBy: input.changedBy,
      },
    });

    return {
      id: inserted.id,
      employeeId: inserted.employeeId,
      amountMinor: inserted.amountMinor,
      currency: inserted.currency.trim(),
      effectiveFrom: inserted.effectiveFrom,
      effectiveTo: inserted.effectiveTo,
      reason: inserted.reason,
      changedBy: inserted.changedBy,
      changedAt: inserted.changedAt,
    };
  });
}

// Lightweight error used to signal validation problems caught inside
// the transaction. The service layer translates these to ApiError.
export class RaiseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RaiseValidationError';
  }
}

export type EmployeeChangeRow = {
  id: string;
  employeeId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string | null;
  changedAt: Date;
  reason: string | null;
};

export type UpdateEmployeeInput = {
  employeeId: string;
  patch: {
    fullName?: string | undefined;
    email?: string | undefined;
    country?: string | undefined;
    department?: string | undefined;
    role?: string | undefined;
    level?: string | undefined;
    status?: string | undefined;
    gender?: string | null | undefined;
  };
  changedBy: string | null;
  reason: string | null;
};

// Patchable field names (camelCase) and their DB column keys on the Employee model.
const PATCHABLE_FIELDS = [
  'fullName',
  'email',
  'country',
  'department',
  'role',
  'level',
  'status',
  'gender',
] as const;

type PatchableField = (typeof PATCHABLE_FIELDS)[number];

// Update mutable employee fields and record a change row per diffed field,
// all in a single transaction. Returns the updated employee detail row.
// Throws if the employee doesn't exist.
export async function updateEmployee(
  input: UpdateEmployeeInput,
): Promise<EmployeeDetailRow> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.employee.findUnique({
      where: { id: input.employeeId },
      include: { salaries: { where: { effectiveTo: null }, take: 1 } },
    });

    if (!current) throw new EmployeeNotFoundError(input.employeeId);

    // Diff: collect only fields that actually changed.
    const changeRows: {
      employeeId: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: string | null;
      reason: string | null;
    }[] = [];

    const updateData: Record<string, unknown> = {};

    for (const field of PATCHABLE_FIELDS) {
      if (!(field in input.patch)) continue;
      const newVal = (input.patch as Record<PatchableField, unknown>)[field];
      const oldVal = current[field as keyof typeof current] as string | null;

      // Normalise for comparison (CHAR(2) from postgres has trailing spaces).
      const oldNorm = typeof oldVal === 'string' ? oldVal.trim() : oldVal;
      const newNorm = newVal === undefined ? undefined : (newVal as string | null);

      if (oldNorm === newNorm) continue; // no-op

      updateData[field] = newVal;
      changeRows.push({
        employeeId: input.employeeId,
        field,
        oldValue: oldNorm ?? null,
        newValue: newNorm !== null && newNorm !== undefined ? String(newNorm) : null,
        changedBy: input.changedBy,
        reason: input.reason,
      });
    }

    if (changeRows.length === 0) {
      // Nothing changed — return current state without a DB write.
      const sal = current.salaries[0];
      return {
        id: current.id,
        employeeCode: current.employeeCode,
        fullName: current.fullName,
        email: current.email,
        country: current.country.trim(),
        department: current.department,
        role: current.role,
        level: current.level,
        hireDate: current.hireDate,
        status: current.status.trim(),
        gender: current.gender,
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
        currentAmountMinor: sal?.amountMinor ?? null,
        currentCurrency: sal?.currency.trim() ?? null,
      };
    }

    const updated = await tx.employee.update({
      where: { id: input.employeeId },
      data: updateData,
      include: { salaries: { where: { effectiveTo: null }, take: 1 } },
    });

    await tx.employeeChange.createMany({ data: changeRows });

    const sal = updated.salaries[0];
    return {
      id: updated.id,
      employeeCode: updated.employeeCode,
      fullName: updated.fullName,
      email: updated.email,
      country: updated.country.trim(),
      department: updated.department,
      role: updated.role,
      level: updated.level,
      hireDate: updated.hireDate,
      status: updated.status.trim(),
      gender: updated.gender,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      currentAmountMinor: sal?.amountMinor ?? null,
      currentCurrency: sal?.currency.trim() ?? null,
    };
  });
}

// Newest-first change history for an employee.
export async function listEmployeeChanges(
  employeeId: string,
): Promise<EmployeeChangeRow[]> {
  const rows = await prisma.employeeChange.findMany({
    where: { employeeId },
    orderBy: { changedAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    field: r.field,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedBy: r.changedBy,
    changedAt: r.changedAt,
    reason: r.reason,
  }));
}

export class EmployeeNotFoundError extends Error {
  constructor(id: string) {
    super(`employee ${id} not found`);
    this.name = 'EmployeeNotFoundError';
  }
}
