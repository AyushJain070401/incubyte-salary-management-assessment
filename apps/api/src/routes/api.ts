import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { employeesRouter } from './employees.js';
import { importRouter } from './import.js';
import { analyticsRouter } from './analytics.js';

// All routes mounted under /api are gated by requireAuth.
export const apiRouter: Router = Router();

apiRouter.use(requireAuth);

apiRouter.get('/me', (req, res) => {
  res.json({ user: req.user });
});

apiRouter.use('/employees', employeesRouter);
apiRouter.use('/import', importRouter);
apiRouter.use('/analytics', analyticsRouter);
