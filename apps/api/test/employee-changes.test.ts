import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { SignJWT } from 'jose';

import { createApp } from '../src/app.js';

// ---------------------------------------------------------------------------
// Mocks — intercept the service layer so no real DB is needed.
// ---------------------------------------------------------------------------
vi.mock('../src/services/employees.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/employees.js')>();
  return {
    ...actual,
    updateEmployeeService: vi.fn(),
    listEmployeeChangesService: vi.fn(),
  };
});

import {
  updateEmployeeService,
  listEmployeeChangesService,
} from '../src/services/employees.js';

const TEST_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const EMP_ID = '11111111-2222-3333-4444-555555555555';

async function authToken(): Promise<string> {
  return new SignJWT({ sub: USER_ID, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(TEST_SECRET);
}

const EMPLOYEE_FIXTURE = {
  id: EMP_ID,
  employeeCode: 'EMP001',
  fullName: 'Alice Smith',
  email: 'alice@example.com',
  country: 'US',
  department: 'Engineering',
  role: 'Engineer',
  level: 'L3',
  hireDate: '2024-01-01',
  status: 'active',
  gender: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('PATCH /api/employees/:id', () => {
  const app = createApp();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`/api/employees/${EMP_ID}`).send({ country: 'GB' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID id', async () => {
    const token = await authToken();
    const res = await request(app)
      .patch('/api/employees/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'GB' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body has only reason (no actual field)', async () => {
    const token = await authToken();
    const res = await request(app)
      .patch(`/api/employees/${EMP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'relocated' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown body field', async () => {
    const token = await authToken();
    const res = await request(app)
      .patch(`/api/employees/${EMP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'GB', unknownField: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with updated employee on valid patch', async () => {
    vi.mocked(updateEmployeeService).mockResolvedValue({
      ...EMPLOYEE_FIXTURE,
      country: 'GB',
    } as never);

    const token = await authToken();
    const res = await request(app)
      .patch(`/api/employees/${EMP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'GB', reason: 'relocated' });

    expect(res.status).toBe(200);
    expect(res.body.country).toBe('GB');
    expect(updateEmployeeService).toHaveBeenCalledWith(
      EMP_ID,
      { country: 'GB', reason: 'relocated' },
      USER_ID,
    );
  });

  it('returns 404 when service throws not-found', async () => {
    const { ApiError } = await import('../src/middleware/errors.js');
    vi.mocked(updateEmployeeService).mockRejectedValue(ApiError.notFound('employee not found'));

    const token = await authToken();
    const res = await request(app)
      .patch(`/api/employees/${EMP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ country: 'GB' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when service throws conflict (duplicate email)', async () => {
    const { ApiError } = await import('../src/middleware/errors.js');
    vi.mocked(updateEmployeeService).mockRejectedValue(
      ApiError.conflict('email already in use by another employee'),
    );

    const token = await authToken();
    const res = await request(app)
      .patch(`/api/employees/${EMP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/employees/:id/changes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/employees/${EMP_ID}/changes`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when employee does not exist', async () => {
    const { ApiError } = await import('../src/middleware/errors.js');
    vi.mocked(listEmployeeChangesService).mockRejectedValue(
      ApiError.notFound(`employee ${EMP_ID} not found`),
    );

    const token = await authToken();
    const res = await request(app)
      .get(`/api/employees/${EMP_ID}/changes`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with change history', async () => {
    const changesFixture = [
      {
        id: 'cccccccc-dddd-eeee-ffff-000000000001',
        employeeId: EMP_ID,
        field: 'country',
        oldValue: 'US',
        newValue: 'GB',
        changedBy: USER_ID,
        changedAt: '2026-07-01T10:00:00.000Z',
        reason: 'relocated',
      },
    ];
    vi.mocked(listEmployeeChangesService).mockResolvedValue(changesFixture as never);

    const token = await authToken();
    const res = await request(app)
      .get(`/api/employees/${EMP_ID}/changes`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: changesFixture });
    expect(listEmployeeChangesService).toHaveBeenCalledWith(EMP_ID);
  });

  it('returns empty items array when no changes recorded', async () => {
    vi.mocked(listEmployeeChangesService).mockResolvedValue([]);

    const token = await authToken();
    const res = await request(app)
      .get(`/api/employees/${EMP_ID}/changes`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });
});
