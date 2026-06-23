import type { Request, Response, NextFunction } from 'express';
import { EmployeeListQuerySchema } from '@acme/shared';

import { listEmployeesService } from '../services/employees.js';

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
