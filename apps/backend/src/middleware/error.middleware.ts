import type { NextFunction, Request, Response } from 'express';
import { isDomainError, ValidationError } from '@/types/errors.js';
import type { DomainError } from '@/types/errors.js';

// ── Body-parser error types ───────────────────────────────────────────────────
// express.json() throws a plain SyntaxError for malformed JSON and a custom
// error with status 413 for payloads that exceed the configured limit.

interface BodyParserError extends SyntaxError {
  status?: number;
  body?: unknown;
  type?: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface ValidationErrorResponse {
  message: string;
  fields: Record<string, string[]>;
}

const ERROR_STATUS_MAP: Record<string, number> = {
  // Auth errors
  INVALID_CREDENTIALS: 401,
  USER_NOT_FOUND: 404,
  USER_ALREADY_EXISTS: 409,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  UNAUTHORIZED: 403,

  // Booking errors
  PROPERTY_NOT_FOUND: 404,
  BOOKING_OVERLAP: 409,
  ESCROW_FAILED: 400,
  INVALID_DATES: 400,
  INSUFFICIENT_FUNDS: 402,
  BOOKING_NOT_FOUND: 404,
  INVALID_STATUS: 400,

  // Escrow errors
  ESCROW_CREATION_FAILED: 400,
  ESCROW_RELEASE_FAILED: 400,
  ESCROW_NOT_FOUND: 404,
  INVALID_ESCROW_STATE: 400,
  INSUFFICIENT_ESCROW_BALANCE: 402,

  // Property errors
  UNAUTHORIZED_OWNER: 403,
  INVALID_PROPERTY_DATA: 400,

  // Validation errors
  VALIDATION_ERROR: 400,
  MISSING_REQUIRED_FIELD: 400,
  INVALID_DATE_FORMAT: 400,

  // Rate limit errors
  RATE_LIMITED: 429,

  // Infrastructure / timeout
  REQUEST_TIMEOUT: 504,
  INTERNAL_SERVER_ERROR: 500,
};

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);

  // ── 413 Payload Too Large ─────────────────────────────────────────────────
  // express.json() sets err.status = 413 and err.type = 'entity.too.large'
  // when the body exceeds the configured limit.
  const bodyParserErr = err as BodyParserError;
  if (bodyParserErr.status === 413 || bodyParserErr.type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds the maximum allowed size.',
      },
    });
    return;
  }

  // ── 400 Malformed JSON ────────────────────────────────────────────────────
  // express.json() throws a SyntaxError with err.status = 400 and
  // err.type = 'entity.parse.failed' when the body is not valid JSON.
  if (
    err instanceof SyntaxError &&
    (bodyParserErr.status === 400 || bodyParserErr.type === 'entity.parse.failed')
  ) {
    res.status(400).json({
      error: {
        code: 'MALFORMED_JSON',
        message: 'Request body contains invalid JSON.',
      },
    });
    return;
  }

  if (err instanceof ValidationError) {
    const response: ValidationErrorResponse = {
      message: err.message,
      fields: err.fields,
    };

    res.status(400).json(response);
    return;
  }

  if (isDomainError(err)) {
    const domainErr = err as DomainError;
    const statusCode = ERROR_STATUS_MAP[domainErr.code] || 400;

    const response: ErrorResponse = {
      error: {
        code: domainErr.code,
        message: domainErr.message,
      },
    };

    if (domainErr.details) {
      response.error.details = domainErr.details;
    }

    res.status(statusCode).json(response);
    return;
  }

  // Handle untyped errors
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error',
    },
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
