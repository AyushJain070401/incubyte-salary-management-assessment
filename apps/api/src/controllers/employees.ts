import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmployeeListQuerySchema, RaiseInputSchema } from '@acme/shared';

import {
  listEmployeesService,
  getEmployeeService,
  listSalariesService,
  giveRaiseService,
} from '../services/employees.js';
import { ApiError } from '../middleware/errors.js';

const IdParamSchema = z.object({ id: z.string().uuid('id must be a UUID') });

// GET /api/employees — paginated list with filters / sort / display currency.
// Query schema validation happens here; service composes repo + FX.
export async function listEmployees(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = EmployeeListQuerySchema.parse(req.query);
    const result = await listEmployeesService(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/employees/:id
export async function getEmployee(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const result = await getEmployeeService(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/employees/:id/salaries
export async function listSalaries(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const items = await listSalariesService(id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// POST /api/employees/:id/raise
export async function postRaise(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = IdParamSchema.parse(req.params);
    const input = RaiseInputSchema.parse(req.body);
    if (!req.user) throw ApiError.unauthorized();
    const created = await giveRaiseService(id, input, req.user.id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}
