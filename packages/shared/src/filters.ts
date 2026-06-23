import { z } from 'zod';
import { CountryCodeSchema, EmployeeStatusSchema } from './employee.js';
import { CurrencySchema } from './money.js';

// Shared filter surface for the employees list and the analytics endpoints.
// Each filter is optional; the absence of a filter means "all values".
//
// `search` is a free-text query matched against full_name, email, and
// employee_code (case-insensitive ILIKE). The server applies it as a single
// OR clause; the client passes one string.
export const EmployeeFiltersSchema = z.object({
  country: CountryCodeSchema.optional(),
  department: z.string().min(1).max(120).optional(),
  role: z.string().min(1).max(120).optional(),
  status: EmployeeStatusSchema.optional(),
  search: z.string().min(1).max(200).optional(),
});

export type EmployeeFilters = z.infer<typeof EmployeeFiltersSchema>;

// Sort. Limited to fields that have indexes (or are cheap to sort without
// one). `salary` sorts by the current salary converted to the display
// currency at query time. `displayCurrency` defaults to USD on the server
// if absent.
export const EmployeeSortFieldSchema = z.enum([
  'fullName',
  'hireDate',
  'salary',
  'createdAt',
]);
export type EmployeeSortField = z.infer<typeof EmployeeSortFieldSchema>;

export const SortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof SortDirSchema>;

export const EmployeeListQuerySchema = EmployeeFiltersSchema.extend({
  sortBy: EmployeeSortFieldSchema.default('fullName'),
  sortDir: SortDirSchema.default('asc'),
  displayCurrency: CurrencySchema.default('USD'),
});

export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>;
