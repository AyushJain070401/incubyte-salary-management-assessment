import Papa from 'papaparse';
import { ZodError } from 'zod';
import {
  ImportRowSchema,
  type ImportRow,
  type ImportReport,
  type ImportReportRow,
  type ImportCommitResult,
} from '@acme/shared';
import { Prisma } from '@prisma/client';

import { importEmployees, type ImportEmployeeData } from '../repos/import.js';
import { ApiError } from '../middleware/errors.js';

// Maximum allowed rows in a single import. Caps memory + transaction time.
const MAX_ROWS = 10_000;

// Parse a CSV string into rows. Headers are normalized to lower-case +
// trimmed; cells likewise. Returns an array of plain objects keyed by
// header name.
function parseCsv(csv: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (v) => v.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]!;
    throw ApiError.unprocessable(
      `CSV parse error at row ${first.row ?? '?'}: ${first.message}`,
    );
  }
  return parsed.data;
}

// Build per-row errors from a ZodError into the wire shape.
function zodErrorsToRowErrors(err: ZodError): ImportReportRow['errors'] {
  return err.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
}

// Validate every parsed row. Returns the per-row report plus the
// fully-validated rows (in original order) for commit mode.
function validateRows(rawRows: Record<string, string>[]): {
  report: ImportReportRow[];
  validated: Array<{ rowNumber: number; row: ImportRow } | null>;
  validCount: number;
} {
  const report: ImportReportRow[] = [];
  const validated: Array<{ rowNumber: number; row: ImportRow } | null> = [];
  let validCount = 0;

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const parsed = ImportRowSchema.safeParse(raw);
    if (parsed.success) {
      validCount++;
      validated.push({ rowNumber, row: parsed.data });
      report.push({
        rowNumber,
        employeeCode: parsed.data.employee_code,
        valid: true,
        errors: [],
      });
    } else {
      validated.push(null);
      report.push({
        rowNumber,
        employeeCode: raw.employee_code,
        valid: false,
        errors: zodErrorsToRowErrors(parsed.error),
      });
    }
  });

  return { report, validated, validCount };
}

// Detect duplicate employee_code or email WITHIN the upload itself.
// Adds errors to the existing report; rows flagged here are also
// removed from the validated array.
function detectIntraFileDuplicates(
  report: ImportReportRow[],
  validated: Array<{ rowNumber: number; row: ImportRow } | null>,
): void {
  const codeFirst = new Map<string, number>();
  const emailFirst = new Map<string, number>();

  for (let i = 0; i < validated.length; i++) {
    const v = validated[i];
    if (!v) continue;

    const existingCode = codeFirst.get(v.row.employee_code);
    if (existingCode !== undefined) {
      report[i]!.valid = false;
      report[i]!.errors.push({
        path: 'employee_code',
        message: `duplicates row ${existingCode}'s employee_code`,
      });
      validated[i] = null;
      continue;
    }
    const existingEmail = emailFirst.get(v.row.email);
    if (existingEmail !== undefined) {
      report[i]!.valid = false;
      report[i]!.errors.push({
        path: 'email',
        message: `duplicates row ${existingEmail}'s email`,
      });
      validated[i] = null;
      continue;
    }

    codeFirst.set(v.row.employee_code, v.rowNumber);
    emailFirst.set(v.row.email, v.rowNumber);
  }
}

// Convert a validated row to the repo's insert shape.
function toRepoData(row: ImportRow): ImportEmployeeData {
  const hireDate = new Date(`${row.hire_date}T00:00:00.000Z`);
  const hasSalary = row.salary_amount_minor !== undefined && row.salary_currency !== undefined;
  return {
    employeeCode: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    country: row.country,
    department: row.department,
    role: row.role,
    level: row.level,
    hireDate,
    status: row.status,
    gender: row.gender,
    initialSalary: hasSalary
      ? {
          amountMinor: BigInt(row.salary_amount_minor!),
          currency: row.salary_currency!,
          effectiveFrom: row.salary_effective_from
            ? new Date(`${row.salary_effective_from}T00:00:00.000Z`)
            : hireDate,
          reason: 'Initial salary (CSV import)',
        }
      : null,
  };
}

// Dry-run: parse + validate + detect intra-file dupes + return report.
export function dryRunImport(csv: string): ImportReport {
  const raw = parseCsv(csv);
  if (raw.length > MAX_ROWS) {
    throw ApiError.unprocessable(
      `import exceeds the ${MAX_ROWS.toLocaleString()}-row limit (got ${raw.length.toLocaleString()})`,
    );
  }

  const { report, validated } = validateRows(raw);
  detectIntraFileDuplicates(report, validated);

  const validCount = report.filter((r) => r.valid).length;
  return {
    mode: 'dry-run',
    total: report.length,
    valid: validCount,
    invalid: report.length - validCount,
    rows: report,
  };
}

// Commit: dry-run first; if all rows pass, do the transactional insert.
// If any row is invalid, refuse with a 422 and the full report so the
// caller knows what's wrong.
export async function commitImport(
  csv: string,
  changedBy: string,
): Promise<ImportCommitResult> {
  const raw = parseCsv(csv);
  if (raw.length > MAX_ROWS) {
    throw ApiError.unprocessable(
      `import exceeds the ${MAX_ROWS.toLocaleString()}-row limit (got ${raw.length.toLocaleString()})`,
    );
  }

  const { report, validated } = validateRows(raw);
  detectIntraFileDuplicates(report, validated);

  const invalidCount = report.filter((r) => !r.valid).length;
  if (invalidCount > 0) {
    throw new ApiError(
      'unprocessable',
      422,
      `import has ${invalidCount} invalid row(s); run dry-run to see details`,
    );
  }

  const toInsert = validated
    .filter((v): v is { rowNumber: number; row: ImportRow } => v !== null)
    .map((v) => toRepoData(v.row));

  try {
    const result = await importEmployees(toInsert, changedBy);
    return {
      mode: 'commit',
      inserted: { employees: result.employees, salaries: result.salaries },
    };
  } catch (err) {
    // Unique-violation on employee_code or email (vs existing DB rows)
    // hits us here. Surface as 409 with the conflicting target if we
    // can extract it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = (err.meta as { target?: string[] } | undefined)?.target;
      throw ApiError.conflict(
        `import conflicts with existing rows on ${target?.join(',') ?? 'unique fields'}`,
      );
    }
    throw err;
  }
}
