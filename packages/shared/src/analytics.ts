import { z } from 'zod';
import { EmployeeFiltersSchema } from './filters.js';
import { CurrencySchema, MoneySchema } from './money.js';

// Query: same filter surface as the employees list, plus the display
// currency used for every monetary aggregate in the response.
export const AnalyticsQuerySchema = EmployeeFiltersSchema.extend({
  displayCurrency: CurrencySchema.default('USD'),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

const HeadcountBucket = z.object({
  key: z.string(),
  count: z.number().int().min(0),
});

const SalaryDistribution = z.object({
  displayCurrency: CurrencySchema,
  count: z.number().int().min(0),
  avg: MoneySchema.nullable(),
  median: MoneySchema.nullable(),
  p25: MoneySchema.nullable(),
  p75: MoneySchema.nullable(),
});

const TopEarner = z.object({
  id: z.string().uuid(),
  employeeCode: z.string(),
  fullName: z.string(),
  country: z.string(),
  department: z.string(),
  role: z.string(),
  displaySalary: MoneySchema,
});

const PayBand = z.object({
  // Inclusive lower bound, exclusive upper bound, both in minor units of
  // the display currency. `upperMinor` is null on the open-ended top band.
  lowerMinor: z.string(),
  upperMinor: z.string().nullable(),
  count: z.number().int().min(0),
});

const PayGapRow = z.object({
  country: z.string(),
  role: z.string(),
  gender: z.enum(['female', 'male']),
  count: z.number().int().min(0),
  avg: MoneySchema,
});

const PayGap = z.object({
  // When the entire filter set yields no role+country with n>=5 in BOTH
  // female and male, we return an empty rows array with `suppressed: true`.
  suppressed: z.boolean(),
  reason: z.string().nullable(),
  rows: z.array(PayGapRow),
});

export const AnalyticsResponseSchema = z.object({
  filters: AnalyticsQuerySchema,
  totals: z.object({
    matching: z.number().int().min(0),
    active: z.number().int().min(0),
    terminated: z.number().int().min(0),
  }),
  headcount: z.object({
    byCountry: z.array(HeadcountBucket),
    byDepartment: z.array(HeadcountBucket),
  }),
  salary: SalaryDistribution,
  topEarners: z.array(TopEarner),
  bands: z.array(PayBand),
  payGap: PayGap,
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
