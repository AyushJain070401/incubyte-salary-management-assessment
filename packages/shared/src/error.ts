import { z } from 'zod';

// The single error envelope the API returns for every non-2xx response.
// Codes are machine-readable; `message` is for humans.
//
// Codes the API actually emits (server-enforced, not just by convention):
//   - invalid_input      400  body/query failed zod validation; `issues` set
//   - unauthorized       401  missing or invalid JWT
//   - forbidden          403  authenticated but not allowed
//   - not_found          404  resource missing
//   - conflict           409  e.g. duplicate employee_code
//   - unprocessable      422  semantically invalid (e.g. effectiveFrom <= current)
//   - rate_limited       429  reserved; not enforced in v1
//   - internal_error     500  unexpected; stack logged, not returned
export const ApiErrorCodeSchema = z.enum([
  'invalid_input',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'unprocessable',
  'rate_limited',
  'internal_error',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorBodySchema = z.object({
  error: ApiErrorCodeSchema,
  message: z.string(),
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
      }),
    )
    .optional(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
