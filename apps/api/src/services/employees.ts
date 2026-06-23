import type {
  EmployeeListQuery,
  EmployeeRead,
  Paginated,
  Gender,
  EmployeeStatus,
} from '@acme/shared';

import { listEmployees as listEmployeesRepo } from '../repos/employees.js';
import { toWire } from '../domain/money.js';
import type { EmployeeListRow } from '../repos/employees.js';

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
