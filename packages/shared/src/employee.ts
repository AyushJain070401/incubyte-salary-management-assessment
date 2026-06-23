import { z } from 'zod';
import { MoneySchema } from './money.js';

// Employee status. Two states for v1 — joins/leaves are common, anything
// finer-grained (suspended, on_leave, contractor, etc.) is feature work
// we're not doing.
export const EmployeeStatusSchema = z.enum(['active', 'terminated']);
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

// Optional, opt-in. Used only for indicative pay-gap analytics with a
// sample-size guard (n >= 5 per group). See docs/REQUIREMENTS.md.
export const GenderSchema = z.enum(['female', 'male', 'non_binary']).nullable();
export type Gender = z.infer<typeof GenderSchema>;

// ISO-3166-1 alpha-2. Two uppercase letters.
export const CountryCodeSchema: z.ZodString = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/u, 'country must be ISO-3166-1 alpha-2 (2 uppercase letters)');

// Tightish bound on free-form strings to keep validation honest.
const ShortText = z.string().min(1).max(120);
const Email = z.string().email().max(254);
const EmployeeCode = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9_-]+$/u, 'employee code must be uppercase letters, digits, _ or -');

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'date must be ISO-8601 (YYYY-MM-DD)');

// Returned by GET /employees and GET /employees/:id.
// `currentSalary` is the row from the salaries table with effective_to = null,
// or absent if the employee has no salary on file yet.
export const EmployeeReadSchema = z.object({
  id: z.string().uuid(),
  employeeCode: EmployeeCode,
  fullName: ShortText,
  email: Email,
  country: CountryCodeSchema,
  department: ShortText,
  role: ShortText,
  level: ShortText,
  hireDate: IsoDate,
  status: EmployeeStatusSchema,
  gender: GenderSchema,
  currentSalary: MoneySchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmployeeRead = z.infer<typeof EmployeeReadSchema>;

// POST /employees body. `initialSalary` is optional so we can create the
// employee record first and add their salary later if the data isn't ready.
export const EmployeeCreateSchema = z.object({
  employeeCode: EmployeeCode,
  fullName: ShortText,
  email: Email,
  country: CountryCodeSchema,
  department: ShortText,
  role: ShortText,
  level: ShortText,
  hireDate: IsoDate,
  status: EmployeeStatusSchema.default('active'),
  gender: GenderSchema.optional().default(null),
  initialSalary: z
    .object({
      amountMinor: MoneySchema.shape.amountMinor,
      currency: MoneySchema.shape.currency,
      effectiveFrom: IsoDate,
    })
    .optional(),
});

export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;

// PATCH /employees/:id body. All fields optional; whatever's sent is the
// change set. Salary changes go through POST /employees/:id/raise instead.
export const EmployeeUpdateSchema = EmployeeCreateSchema.omit({
  initialSalary: true,
  employeeCode: true,
})
  .partial()
  .strict();

export type EmployeeUpdate = z.infer<typeof EmployeeUpdateSchema>;
