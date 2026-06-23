import { z } from 'zod';
import { MinorUnitsSchema, CurrencySchema } from './money.js';

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'date must be ISO-8601 (YYYY-MM-DD)');

// One row from the salaries table. effective_to is null for the current row.
export const SalaryReadSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  amountMinor: MinorUnitsSchema,
  currency: CurrencySchema,
  effectiveFrom: IsoDate,
  effectiveTo: IsoDate.nullable(),
  reason: z.string().max(500).nullable(),
  changedBy: z.string().uuid().nullable(),
  changedAt: z.string().datetime(),
});

export type SalaryRead = z.infer<typeof SalaryReadSchema>;

// Body for POST /employees/:id/raise.
// The service closes the current row (sets effective_to = effectiveFrom - 1)
// and inserts a new row with this payload, all in one transaction.
export const RaiseInputSchema = z
  .object({
    amountMinor: MinorUnitsSchema,
    currency: CurrencySchema,
    effectiveFrom: IsoDate,
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();

export type RaiseInput = z.infer<typeof RaiseInputSchema>;
