import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { z } from 'zod';

import { env } from '../config/env.js';
import { ApiError } from './errors.js';
import type { AuthenticatedUser } from '../types/auth.js';

// Two verification modes, picked per-request from the JWT's own `alg`:
//
//   HS256 — shared secret. Older Supabase projects, and tests (which
//   sign their own deterministic tokens). Requires SUPABASE_JWT_SECRET.
//
//   ES256 / RS256 / EdDSA — asymmetric signing. Supabase rolled this out
//   in 2025 with "JWT Signing Keys"; new projects use it by default.
//   Verification is via JWKS at $SUPABASE_URL/auth/v1/.well-known/jwks.json
//   — no shared secret needed.
//
// We don't auto-detect by trying both (would add a network round-trip
// per failed attempt); instead we look at the token's `alg` header
// (which jose decodes WITHOUT verifying) and pick the matching key.

const jwksUrl = new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
const remoteKeySet = createRemoteJWKSet(jwksUrl);

const hsSecret = env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
  : null;

// Supabase's expected payload (the subset we depend on).
const SupabasePayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  role: z.string(),
  exp: z.number().int(),
});

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

    // Read the alg from the (still-unverified) JWT header to choose
    // the right verification path. decodeProtectedHeader does NOT
    // validate the signature.
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      throw ApiError.unauthorized('malformed token');
    }
    if (!alg) throw ApiError.unauthorized('token has no algorithm header');

    let verified;
    if (alg.startsWith('HS')) {
      if (!hsSecret) {
        throw ApiError.unauthorized(
          'received an HS-signed token but SUPABASE_JWT_SECRET is not configured',
        );
      }
      verified = await jwtVerify(token, hsSecret, { algorithms: [alg] });
    } else {
      verified = await jwtVerify(token, remoteKeySet, {
        algorithms: ['ES256', 'RS256', 'EdDSA'],
      });
    }

    const claims = SupabasePayloadSchema.safeParse(verified.payload);
    if (!claims.success) {
      throw ApiError.unauthorized('JWT payload missing required claims');
    }
    if (claims.data.role === 'anon') {
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
    next(ApiError.unauthorized('invalid or expired token'));
  }
};
