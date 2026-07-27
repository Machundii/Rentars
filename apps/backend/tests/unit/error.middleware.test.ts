/**
 * Tests for validation error middleware and normalized error responses.
 * Ensures validation errors return 400 status with normalized { message, fields } structure.
 */

import { describe, it, expect, mock } from 'bun:test';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { ValidationError, AuthError } from '../../src/types/errors.js';
import type { Response } from 'express';

describe('errorMiddleware with ValidationError', () => {
  it('should return 400 status with normalized validation error format', () => {
    const validationError = new ValidationError('Validation failed', {
      email: ['email is required', 'email must be a valid email address'],
      password: ['password must be at least 8 characters'],
    });

    const mockReq = {} as any;
    const mockRes = {
      status: mock(() => mockRes),
      json: mock(() => undefined),
    } as unknown as Response;

    const mockNext = mock(() => undefined);

    errorMiddleware(validationError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Validation failed',
      fields: {
        email: ['email is required', 'email must be a valid email address'],
        password: ['password must be at least 8 characters'],
      },
    });
  });

  it('should handle validation error with empty fields', () => {
    const validationError = new ValidationError('Validation failed', {});

    const mockReq = {} as any;
    const mockRes = {
      status: mock(() => mockRes),
      json: mock(() => undefined),
    } as unknown as Response;

    const mockNext = mock(() => undefined);

    errorMiddleware(validationError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Validation failed',
      fields: {},
    });
  });

  it('should handle nested field validation errors', () => {
    const validationError = new ValidationError('Validation failed', {
      'location.lat': ['latitude must be between -90 and 90'],
      'location.lng': ['longitude must be between -180 and 180'],
    });

    const mockReq = {} as any;
    const mockRes = {
      status: mock(() => mockRes),
      json: mock(() => undefined),
    } as unknown as Response;

    const mockNext = mock(() => undefined);

    errorMiddleware(validationError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Validation failed',
      fields: {
        'location.lat': ['latitude must be between -90 and 90'],
        'location.lng': ['longitude must be between -180 and 180'],
      },
    });
  });
});

describe('errorMiddleware with non-validation errors', () => {
  it('should preserve domain error handling for AuthError', () => {
    const authError = new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');

    const mockReq = {} as any;
    const mockRes = {
      status: mock(() => mockRes),
      json: mock(() => undefined),
    } as unknown as Response;

    const mockNext = mock(() => undefined);

    errorMiddleware(authError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
  });

  it('should handle generic errors with 500 status', () => {
    const genericError = new Error('Something went wrong');

    const mockReq = {} as any;
    const mockRes = {
      status: mock(() => mockRes),
      json: mock(() => undefined),
    } as unknown as Response;

    const mockNext = mock(() => undefined);

    errorMiddleware(genericError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      },
    });
  });
});
