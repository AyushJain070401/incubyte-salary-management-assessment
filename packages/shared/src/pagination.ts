import { z } from 'zod';

// Query params for any paginated GET. Coerce strings → numbers because they
// arrive from URLSearchParams.
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// Generic paginated envelope. Constructed via paginated(ItemSchema) to keep
// the API response shape uniform across resources.
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    perPage: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  });
}

export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};
