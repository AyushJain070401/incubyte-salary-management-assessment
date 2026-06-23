import type { ApiErrorCode } from '@acme/shared';

// Application-typed error. Routes/services throw this; the global error
// middleware translates to the wire envelope. Anything else thrown is
// treated as a 500 with a generic message (stack logged, not returned).
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(message = 'authentication required'): ApiError {
    return new ApiError('unauthorized', 401, message);
  }

  static forbidden(message = 'not allowed'): ApiError {
    return new ApiError('forbidden', 403, message);
  }

  static notFound(message = 'not found'): ApiError {
    return new ApiError('not_found', 404, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError('conflict', 409, message);
  }

  static unprocessable(message: string): ApiError {
    return new ApiError('unprocessable', 422, message);
  }
}
