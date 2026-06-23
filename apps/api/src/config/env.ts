import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  // Optional. Newer Supabase projects use asymmetric signing (ES256 +
  // JWKS), in which case the secret isn't used. Older projects sign
  // with HS256, where this secret is required. The auth middleware
  // picks the verification mode per-request based on the token's `alg`.
  SUPABASE_JWT_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
