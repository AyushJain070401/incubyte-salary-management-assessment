import type { Request, Response, NextFunction } from 'express';
import { AnalyticsQuerySchema } from '@acme/shared';

import { analyticsService } from '../services/analytics.js';

// GET /api/analytics — dashboard data for the filtered employee set.
export async function getAnalytics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = AnalyticsQuerySchema.parse(req.query);
    const result = await analyticsService(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
