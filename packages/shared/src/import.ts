import { z } from 'zod';
import { CountryCodeSchema, EmployeeStatusSchema, GenderSchema } from './employee.js';
import { CurrencySchema, MinorUnitsSchema } from './money.js';

// CSV column conventions (snake_case — matches what spreadsheet exports
// typically produce). Blank cells are treated as `undefined`.
//
// Required: employee_code, full_name, email, country, department, role,
// level, hire_date
// Optional: status (default 'active'), gender (default null), salary_*
//
// When any salary_* field is present, salary_amount_minor + salary_currency
// must both be set. salary_effective_from defaults to hire_date.
export const ImportRowSchema = z
  .object({
    employee_code: z
      .string()
      .min(1)
      .max(32)
      .regex(/^[A-Z0-9_-]+$/u, 'employee_code must be uppercase letters/digits/_/-'),
    full_name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    country: CountryCodeSchema,
    department: z.string().min(1).max(120),
    role: z.string().min(1).max(120),
    level: z.string().min(1).max(120),
    hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'hire_date must be YYYY-MM-DD'),
    status: EmployeeStatusSchema.optional().default('active'),
    gender: z
      .union([GenderSchema, z.literal(''), z.undefined()])
      .transform((g) => (g === '' || g === undefined ? null : g)),
    salary_amount_minor: z
      .union([MinorUnitsSchema, z.literal(''), z.undefined()])
      .transform((v) => (v === '' || v === undefined ? undefined : v)),
    salary_currency: z
      .union([CurrencySchema, z.literal(''), z.undefined()])
      .transform((v) => (v === '' || v === undefined ? undefined : v)),
    salary_effective_from: z
      .union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'salary_effective_from must be YYYY-MM-DD'),
        z.literal(''),
        z.undefined(),
      ])
      .transform((v) => (v === '' || v === undefined ? undefined : v)),
  })
  .superRefine((row, ctx) => {
    const hasAmount = row.salary_amount_minor !== undefined;
    const hasCurrency = row.salary_currency !== undefined;
    if (hasAmount !== hasCurrency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasAmount ? ['salary_currency'] : ['salary_amount_minor'],
        message: 'salary_amount_minor and salary_currency must be set together',
      });
    }
  });

export type ImportRow = z.infer<typeof ImportRowSchema>;

// Per-row outcome from dry-run validation.
export const ImportReportRowSchema = z.object({
  rowNumber: z.number().int().min(1), // 1-based; row 1 is the first data row, not the header
  employeeCode: z.string().optional(),
  valid: z.boolean(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).default([]),
});
export type ImportReportRow = z.infer<typeof ImportReportRowSchema>;

// What POST /api/import/employees?mode=dry-run returns.
export const ImportReportSchema = z.object({
  mode: z.literal('dry-run'),
  total: z.number().int().min(0),
  valid: z.number().int().min(0),
  invalid: z.number().int().min(0),
  rows: z.array(ImportReportRowSchema),
});
export type ImportReport = z.infer<typeof ImportReportSchema>;

// What POST /api/import/employees?mode=commit returns on success.
export const ImportCommitResultSchema = z.object({
  mode: z.literal('commit'),
  inserted: z.object({
    employees: z.number().int().min(0),
    salaries: z.number().int().min(0),
  }),
});
export type ImportCommitResult = z.infer<typeof ImportCommitResultSchema>;
