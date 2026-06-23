import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { SignJWT } from 'jose';

import { createApp } from '../src/app.js';

// Same secret the vitest config sets in process.env.SUPABASE_JWT_SECRET.
// We re-sign test tokens with it so the middleware's verification works.
const TEST_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

const USER_ID = '11111111-2222-3333-4444-555555555555';

async function signJwt(claims: Record<string, unknown>, exp = '1h'): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(TEST_SECRET);
}

describe('requireAuth middleware (via GET /api/me)', () => {
  const app = createApp();

  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: 'unauthorized',
      message: expect.stringContaining('Authorization'),
    });
  });

  it('rejects requests with a non-Bearer scheme', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('rejects a malformed JWT', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('rejects a JWT signed with a different secret', async () => {
    const wrongSecret = new TextEncoder().encode('different-secret-that-is-long-enough');
    const token = await new SignJWT({ sub: USER_ID, role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    // jose can backdate via setIssuedAt(<seconds>); set exp to a past time.
    const token = await new SignJWT({ sub: USER_ID, role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(TEST_SECRET);

    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an anon JWT', async () => {
    const token = await signJwt({ sub: USER_ID, role: 'anon', email: 'a@b.test' });
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/anonymous/);
  });

  it('rejects a JWT with missing claims', async () => {
    const token = await signJwt({ role: 'authenticated' }); // no sub
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('accepts a valid Supabase-shaped JWT and attaches req.user', async () => {
    const token = await signJwt({
      sub: USER_ID,
      role: 'authenticated',
      email: 'hr@acme.test',
    });
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: USER_ID, email: 'hr@acme.test', role: 'authenticated' },
    });
  });
});
