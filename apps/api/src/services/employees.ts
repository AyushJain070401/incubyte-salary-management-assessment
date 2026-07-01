import type {
  EmployeeListQuery,
  EmployeeRead,
  Paginated,
  Gender,
  EmployeeStatus,
  SalaryRead,
  RaiseInput,
  PatchEmployeeInput,
  EmployeeChangeRead,
} from '@acme/shared';
import { Prisma } from '@prisma/client';

import {
  listEmployees as listEmployeesRepo,
  getEmployeeById,
  listSalariesByEmployee,
  giveRaise,
  RaiseValidationError,
  updateEmployee,
  listEmployeeChanges,
  EmployeeNotFoundError,
} from '../repos/employees.js';
import { toWire, fromWire } from '../domain/money.js';
import { ApiError } from '../middleware/errors.js';
import type {
  EmployeeListRow,
  EmployeeDetailRow,
  SalaryHistoryRow,
  EmployeeChangeRow,
} from '../repos/employees.js';

// Convert a Date to the YYYY-MM-DD ISO date string the schema requires.
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Convert a repo row to the wire EmployeeRead. Keeps the controller free
// of mapping boilerplate.
function rowToRead(row: EmployeeListRow, displayCurrency: string): EmployeeRead {
  const out: EmployeeRead = {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    email: row.email,
    country: row.country,
    department: row.department,
    role: row.role,
    level: row.level,
    hireDate: toIsoDate(row.hireDate),
    status: row.status as EmployeeStatus,
    gender: row.gender as Gender,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.currentAmountMinor !== null && row.currentCurrency) {
    out.currentSalary = {
      amountMinor: toWire(row.currentAmountMinor),
      currency: row.currentCurrency,
    };
  }

  if (row.displayAmountMinor !== null) {
    out.displaySalary = {
      amountMinor: toWire(row.displayAmountMinor),
      currency: displayCurrency,
    };
  }

  return out;
}

// Orchestrates the list query: calls the repo, maps rows to the wire
// shape, and wraps in the paginated envelope.
export async function listEmployeesService(
  q: EmployeeListQuery,
): Promise<Paginated<EmployeeRead>> {
  const { items, total } = await listEmployeesRepo(q);

  return {
    items: items.map((row) => rowToRead(row, q.displayCurrency)),
    page: q.page,
    perPage: q.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.perPage)),
  };
}

// Convert a detail row to EmployeeRead. No displaySalary — detail
// endpoint shows native currency only.
function detailRowToRead(row: EmployeeDetailRow): EmployeeRead {
  const out: EmployeeRead = {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    email: row.email,
    country: row.country,
    department: row.department,
    role: row.role,
    level: row.level,
    hireDate: row.hireDate.toISOString().slice(0, 10),
    status: row.status as EmployeeStatus,
    gender: row.gender as Gender,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.currentAmountMinor !== null && row.currentCurrency) {
    out.currentSalary = {
      amountMinor: toWire(row.currentAmountMinor),
      currency: row.currentCurrency,
    };
  }
  return out;
}

// One employee with current salary. 404 if not found.
export async function getEmployeeService(id: string): Promise<EmployeeRead> {
  const row = await getEmployeeById(id);
  if (!row) throw ApiError.notFound(`employee ${id} not found`);
  return detailRowToRead(row);
}

// Convert a salary repo row to SalaryRead wire shape.
function salaryRowToRead(row: SalaryHistoryRow): SalaryRead {
  return {
    id: row.id,
    employeeId: row.employeeId,
    amountMinor: toWire(row.amountMinor),
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString().slice(0, 10) : null,
    reason: row.reason,
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString(),
  };
}

// Salary history for an employee, newest first.
// 404 if the employee doesn't exist.
export async function listSalariesService(employeeId: string): Promise<SalaryRead[]> {
  const exists = await getEmployeeById(employeeId);
  if (!exists) throw ApiError.notFound(`employee ${employeeId} not found`);
  const rows = await listSalariesByEmployee(employeeId);
  return rows.map(salaryRowToRead);
}

// PATCH /employees/:id — update mutable fields and record change rows.
export async function updateEmployeeService(
  id: string,
  input: PatchEmployeeInput,
  changedBy: string | null,
): Promise<EmployeeRead> {
  const { reason, ...patch } = input;
  try {
    const row = await updateEmployee({
      employeeId: id,
      patch,
      changedBy,
      reason: reason ?? null,
    });
    return detailRowToRead(row);
  } catch (err) {
    if (err instanceof EmployeeNotFoundError) throw ApiError.notFound(err.message);
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw ApiError.conflict('email already in use by another employee');
    }
    throw err;
  }
}

// GET /employees/:id/changes — field change history, newest first.
export async function listEmployeeChangesService(
  employeeId: string,
): Promise<EmployeeChangeRead[]> {
  const exists = await getEmployeeById(employeeId);
  if (!exists) throw ApiError.notFound(`employee ${employeeId} not found`);
  const rows = await listEmployeeChanges(employeeId);
  return rows.map(changeRowToRead);
}

function changeRowToRead(row: EmployeeChangeRow): EmployeeChangeRead {
  return {
    id: row.id,
    employeeId: row.employeeId,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString(),
    reason: row.reason,
  };
}

// Give-raise orchestration:
//   - converts the wire RaiseInput to the repo input shape
//   - invokes the transactional repo call
//   - maps RaiseValidationError -> 422 and Prisma unique-violation -> 409
export async function giveRaiseService(
  employeeId: string,
  input: RaiseInput,
  changedBy: string,
): Promise<SalaryRead> {
  try {
    const row = await giveRaise({
      employeeId,
      amountMinor: fromWire(input.amountMinor),
      currency: input.currency,
      effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
      reason: input.reason ?? null,
      changedBy,
    });
    return salaryRowToRead(row);
  } catch (err) {
    if (err instanceof RaiseValidationError) {
      throw ApiError.unprocessable(err.message);
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw ApiError.conflict(
        'a concurrent raise already created a current salary row; retry',
      );
    }
    throw err;
  }
}
