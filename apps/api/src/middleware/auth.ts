import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { jwtVerify } from 'jose';
import { z } from 'zod';

import { env } from '../config/env.js';
import { ApiError } from './errors.js';
import type { AuthenticatedUser } from '../types/auth.js';

// Pre-encode the JWT secret once; jose wants Uint8Array.
const secretKey = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

// Shape of the relevant Supabase JWT claims. Supabase issues many more
// claims (aal, aud, iss, app_metadata, ...); we only validate the ones
// the API depends on and ignore the rest.
const SupabasePayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  role: z.string(),
  exp: z.number().int(),
});

// Express middleware: verify the JWT in the `Authorization: Bearer …`
// header. On success, attach `req.user` and call next(). On failure,
// throw an ApiError; the global error handler maps to a 401 response.
export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header) throw ApiError.unauthorized('missing Authorization header');

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw ApiError.unauthorized('Authorization header must be "Bearer <token>"');
    }

    // jose validates signature + exp automatically. The HS256 algorithm
    // is what Supabase uses with the shared JWT_SECRET.
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });

    const claims = SupabasePayloadSchema.safeParse(payload);
    if (!claims.success) {
      throw ApiError.unauthorized('JWT payload missing required claims');
    }

    if (claims.data.role === 'anon') {
      // Supabase anon tokens are scoped for public access; we don't honor
      // them on protected endpoints.
      throw ApiError.unauthorized('anonymous tokens are not accepted');
    }

    const user: AuthenticatedUser = {
      id: claims.data.sub,
      email: claims.data.email ?? null,
      role: claims.data.role,
    };
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      next(err);
      return;
    }
    // jose throws on bad signature, malformed token, expired, etc.
    // All of these are 401 from the client's perspective.
    next(ApiError.unauthorized('invalid or expired token'));
  }
};
