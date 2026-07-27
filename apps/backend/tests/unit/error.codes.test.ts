/**
 * Tests that representative error classes carry the correct machine-readable
 * codes and that the error middleware maps them to the right HTTP status +
 * response shape.
 *
 * Uses bun:test — no external framework needed.
 */

import { describe, it, expect, mock } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';

import {
  AuthError,
  AuthErrorCode,
  BookingError,
  EscrowError,
  EscrowErrorCode,
  PropertyError,
  PropertyErrorCode,
  ValidationError,
  ValidationErrorCode,
  RateLimitError,
  RateLimitErrorCode,
  isDomainError,
} from '../../src/types/errors.js';
import { BookingErrorCode } from '../../src/errors/booking.errors.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

interface CapturedResponse {
  status: number;
  body: { error: { code: string; message: string; details?: unknown } };
}

/** Run the error middleware and capture what it would send. */
function runMiddleware(err: Error): CapturedResponse {
  let captured: CapturedResponse = { status: 500, body: { error: { code: '', message: '' } } };

  const res = {
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body as CapturedResponse['body'];
      this.headersSent = true;
      return this;
    },
  } as unknown as Response;

  errorMiddleware(err, {} as Request, res, (() => {}) as NextFunction);
  return captured;
}

// ─── isDomainError guard ───────────────────────────────────────────────────

describe('isDomainError', () => {
  it('returns true for BookingError', () => {
    expect(isDomainError(new BookingError(BookingErrorCode.BOOKING_NOT_FOUND, 'not found'))).toBe(true);
  });

  it('returns true for EscrowError', () => {
    expect(isDomainError(new EscrowError(EscrowErrorCode.ESCROW_NOT_FOUND, 'not found'))).toBe(true);
  });

  it('returns true for PropertyError', () => {
    expect(isDomainError(new PropertyError(PropertyErrorCode.PROPERTY_NOT_FOUND, 'not found'))).toBe(true);
  });

  it('returns true for AuthError', () => {
    expect(isDomainError(new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'bad creds'))).toBe(true);
  });

  it('returns true for ValidationError', () => {
    expect(isDomainError(new ValidationError(ValidationErrorCode.VALIDATION_ERROR, 'bad input'))).toBe(true);
  });

  it('returns true for RateLimitError', () => {
    expect(isDomainError(new RateLimitError(RateLimitErrorCode.RATE_LIMITED, 'slow down'))).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isDomainError(new Error('plain'))).toBe(false);
  });
});

// ─── Error middleware HTTP status mapping ──────────────────────────────────

describe('errorMiddleware — status codes', () => {
  it('maps BOOKING_NOT_FOUND → 404 with code in body', () => {
    const err = new BookingError(BookingErrorCode.BOOKING_NOT_FOUND, 'booking gone');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(404);
    expect(body.error.code).toBe('BOOKING_NOT_FOUND');
    expect(body.error.message).toBe('booking gone');
  });

  it('maps BOOKING_OVERLAP → 409', () => {
    const err = new BookingError(BookingErrorCode.BOOKING_OVERLAP, 'overlap');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(409);
    expect(body.error.code).toBe('BOOKING_OVERLAP');
  });

  it('maps INVALID_DATES → 400', () => {
    const err = new BookingError(BookingErrorCode.INVALID_DATES, 'bad dates');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_DATES');
  });

  it('maps INSUFFICIENT_FUNDS → 402', () => {
    const err = new BookingError(BookingErrorCode.INSUFFICIENT_FUNDS, 'no money');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(402);
    expect(body.error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('maps ESCROW_CREATION_FAILED → 400 with code', () => {
    const err = new EscrowError(EscrowErrorCode.ESCROW_CREATION_FAILED, 'escrow fail');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('ESCROW_CREATION_FAILED');
  });

  it('maps ESCROW_NOT_FOUND → 404', () => {
    const err = new EscrowError(EscrowErrorCode.ESCROW_NOT_FOUND, 'not found');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(404);
    expect(body.error.code).toBe('ESCROW_NOT_FOUND');
  });

  it('maps INSUFFICIENT_ESCROW_BALANCE → 402', () => {
    const err = new EscrowError(EscrowErrorCode.INSUFFICIENT_ESCROW_BALANCE, 'low balance');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(402);
    expect(body.error.code).toBe('INSUFFICIENT_ESCROW_BALANCE');
  });

  it('maps PROPERTY_NOT_FOUND → 404', () => {
    const err = new PropertyError(PropertyErrorCode.PROPERTY_NOT_FOUND, 'no prop');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(404);
    expect(body.error.code).toBe('PROPERTY_NOT_FOUND');
  });

  it('maps UNAUTHORIZED_OWNER → 403', () => {
    const err = new PropertyError(PropertyErrorCode.UNAUTHORIZED_OWNER, 'not owner');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(403);
    expect(body.error.code).toBe('UNAUTHORIZED_OWNER');
  });

  it('maps INVALID_CREDENTIALS → 401', () => {
    const err = new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'bad creds');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('maps TOKEN_EXPIRED → 401', () => {
    const err = new AuthError(AuthErrorCode.TOKEN_EXPIRED, 'expired');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(401);
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('maps UNAUTHORIZED → 403', () => {
    const err = new AuthError(AuthErrorCode.UNAUTHORIZED, 'forbidden');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(403);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('maps VALIDATION_ERROR → 400', () => {
    const err = new ValidationError(ValidationErrorCode.VALIDATION_ERROR, 'bad input');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps MISSING_REQUIRED_FIELD → 400 with details', () => {
    const err = new ValidationError(
      ValidationErrorCode.MISSING_REQUIRED_FIELD,
      'field required',
      { field: 'check_in' },
    );
    const { status, body } = runMiddleware(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_REQUIRED_FIELD');
    expect((body.error as any).details).toEqual({ field: 'check_in' });
  });

  it('maps RATE_LIMITED → 429', () => {
    const err = new RateLimitError(RateLimitErrorCode.RATE_LIMITED, 'too many requests');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('falls back to 500 / INTERNAL_SERVER_ERROR for unknown errors', () => {
    const err = new Error('something exploded');
    const { status, body } = runMiddleware(err);
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('does not write a second response when headersSent is true', () => {
    const err = new BookingError(BookingErrorCode.BOOKING_NOT_FOUND, 'gone');
    let jsonCallCount = 0;

    const res = {
      headersSent: true, // already sent
      status() { return this; },
      json() { jsonCallCount++; return this; },
    } as unknown as Response;

    errorMiddleware(err, {} as Request, res, (() => {}) as NextFunction);
    expect(jsonCallCount).toBe(0);
  });
});
