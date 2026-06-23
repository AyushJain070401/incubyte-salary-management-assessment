import { prisma } from '../db/client.js';

// Pre-validated row ready for insert. The service does Zod validation
// first, then translates to this shape.
export type ImportEmployeeData = {
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
  initialSalary: {
    amountMinor: bigint;
    currency: string;
    effectiveFrom: Date;
    reason: string;
  } | null;
};

export type ImportResult = {
  employees: number;
  salaries: number;
};

// Bulk insert all rows in a single transaction. If anything in the
// transaction throws (e.g. a unique-constraint violation on
// employee_code or email), the entire import rolls back — caller sees
// the error, no rows committed.
//
// Inserts are batched to keep the per-statement parameter count under
// the Postgres limit and to give the transaction a chance to break
// large imports into smaller round-trips.
const CHUNK = 500;

export async function importEmployees(
  rows: ImportEmployeeData[],
  changedBy: string,
): Promise<ImportResult> {
  if (rows.length === 0) return { employees: 0, salaries: 0 };

  return prisma.$transaction(
    async (tx) => {
      const employeeData = rows.map((r) => ({
        employeeCode: r.employeeCode,
        fullName: r.fullName,
        email: r.email,
        country: r.country,
        department: r.department,
        role: r.role,
        level: r.level,
        hireDate: r.hireDate,
        status: r.status,
        gender: r.gender,
      }));

      // Insert employees in chunks; createMany doesn't return IDs by
      // default. We pre-generated employee_code so we can look them up
      // after the insert to attach salary rows.
      let employeesInserted = 0;
      for (let i = 0; i < employeeData.length; i += CHUNK) {
        const chunk = employeeData.slice(i, i + CHUNK);
        const r = await tx.employee.createMany({ data: chunk });
        employeesInserted += r.count;
      }

      // Build a lookup from employeeCode -> id for the freshly-inserted
      // employees so we can attach salary rows.
      const inserted = await tx.employee.findMany({
        where: { employeeCode: { in: rows.map((r) => r.employeeCode) } },
        select: { id: true, employeeCode: true },
      });
      const idByCode = new Map(inserted.map((e) => [e.employeeCode, e.id]));

      const salaryData = rows
        .filter((r) => r.initialSalary !== null)
        .map((r) => {
          const id = idByCode.get(r.employeeCode);
          if (!id) {
            throw new Error(
              `internal: employee ${r.employeeCode} was not inserted as expected`,
            );
          }
          return {
            employeeId: id,
            amountMinor: r.initialSalary!.amountMinor,
            currency: r.initialSalary!.currency,
            effectiveFrom: r.initialSalary!.effectiveFrom,
            effectiveTo: null,
            reason: r.initialSalary!.reason,
            changedBy,
          };
        });

      let salariesInserted = 0;
      for (let i = 0; i < salaryData.length; i += CHUNK) {
        const chunk = salaryData.slice(i, i + CHUNK);
        const r = await tx.salary.createMany({ data: chunk });
        salariesInserted += r.count;
      }

      return { employees: employeesInserted, salaries: salariesInserted };
    },
    {
      // Allow up to 60s for very large imports. Default is 5s.
      timeout: 60_000,
    },
  );
}
