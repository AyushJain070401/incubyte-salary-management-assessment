import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { dryRunImport, commitImport } from '../services/import.js';
import { ApiError } from '../middleware/errors.js';

const ModeSchema = z.enum(['dry-run', 'commit']);

// POST /api/import/employees?mode=dry-run|commit
// Body: text/csv. The body is the raw CSV; express.text() puts it on req.body
// as a string.
export async function postEmployeeImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mode = ModeSchema.parse(req.query.mode ?? 'dry-run');

    if (typeof req.body !== 'string' || req.body.length === 0) {
      throw ApiError.unprocessable(
        'request body must be a non-empty text/csv payload',
      );
    }

    if (mode === 'dry-run') {
      res.json(dryRunImport(req.body));
      return;
    }

    if (!req.user) throw ApiError.unauthorized();
    const result = await commitImport(req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
