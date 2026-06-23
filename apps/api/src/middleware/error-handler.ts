import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@acme/shared';

import { ApiError } from './errors.js';

// Global error-handling middleware. Mounted last in app.ts.
//
// - ApiError → its declared status + the typed envelope
// - ZodError → 400 invalid_input with the validation issues
// - Anything else → 500 internal_error (stack logged, not returned)
//
// Always emits the shape declared by @acme/shared.ApiErrorBodySchema.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: err.code, message: err.message };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: 'invalid_input',
      message: 'request failed validation',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    };
    res.status(400).json(body);
    return;
  }

  // Unexpected — log to the request logger if pino-http attached one,
  // otherwise to stderr.
  const log = req.log ?? console;
  log.error({ err }, 'unhandled error in request handler');

  const body: ApiErrorBody = {
    error: 'internal_error',
    message: 'an unexpected error occurred',
  };
  res.status(500).json(body);
};
