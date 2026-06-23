import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { apiRouter } from './routes/api.js';
import { errorHandler } from './middleware/error-handler.js';
import './types/auth.js'; // augments Express.Request

// Build a fresh Express app. Separated from server-listen so tests can
// instantiate the app and hit it with supertest without binding a port.
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ level: env.LOG_LEVEL }));

  // Public routes
  app.use(healthRouter);

  // Protected routes — every /api/* request goes through requireAuth.
  app.use('/api', apiRouter);

  // Final error handler — must be last.
  app.use(errorHandler);

  return app;
}
