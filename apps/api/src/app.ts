import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';

// Build a fresh Express app. Separated from server-listen so tests can
// instantiate the app and hit it with supertest without binding a port.
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ level: env.LOG_LEVEL }));

  app.use(healthRouter);

  return app;
}
