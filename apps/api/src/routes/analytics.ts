import { Router } from 'express';
import { getAnalytics } from '../controllers/analytics.js';

export const analyticsRouter: Router = Router();

analyticsRouter.get('/', getAnalytics);
