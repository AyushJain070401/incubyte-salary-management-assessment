import { z } from 'zod';

// One row from employee_changes. field is the camelCase field name
// (e.g. "country", "email", "department").
export const EmployeeChangeReadSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  changedBy: z.string().uuid().nullable(),
  changedAt: z.string().datetime(),
  reason: z.string().max(500).nullable(),
});

export type EmployeeChangeRead = z.infer<typeof EmployeeChangeReadSchema>;

// Body for PATCH /employees/:id.
// Extends EmployeeUpdateSchema with an optional reason so callers can
// document why the change was made (stored in employee_changes rows).
export const PatchEmployeeInputSchema = z
  .object({
    fullName: z.string().min(1).max(120).optional(),
    email: z.string().email().max(254).optional(),
    country: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/u, 'country must be ISO-3166-1 alpha-2 (2 uppercase letters)')
      .optional(),
    department: z.string().min(1).max(120).optional(),
    role: z.string().min(1).max(120).optional(),
    level: z.string().min(1).max(120).optional(),
    status: z.enum(['active', 'terminated']).optional(),
    gender: z.enum(['female', 'male', 'non_binary']).nullable().optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).some((k) => k !== 'reason'), {
    message: 'at least one field other than reason must be provided',
  });

export type PatchEmployeeInput = z.infer<typeof PatchEmployeeInputSchema>;
