/**
 * Zod validators for user profile update payloads.
 */

import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@/types/errors.js';

// ─── Profile update schema ────────────────────────────────────────────────────

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(1, 'name must not be empty')
      .max(100, 'name must be at most 100 characters')
      .trim()
      .optional(),

    bio: z
      .string()
      .max(500, 'bio must be at most 500 characters')
      .trim()
      .optional(),

    avatar_url: z
      .string()
      .url('avatar_url must be a valid URL')
      .optional()
      .nullable(),

    phone: z
      .string()
      .regex(
        /^\+?[1-9]\d{6,14}$/,
        'phone must be a valid international phone number (e.g. +14155552671)',
      )
      .optional()
      .nullable(),

    stellar_address: z
      .string()
      .regex(
        /^G[A-Z2-7]{55}$/,
        'stellar_address must be a valid Stellar public key',
      )
      .optional()
      .nullable(),

    preferred_currency: z
      .enum(['USD', 'EUR', 'GBP', 'USDC'], {
        errorMap: () => ({ message: 'preferred_currency must be one of: USD, EUR, GBP, USDC' }),
      })
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' },
  );

// ─── Middleware factory ───────────────────────────────────────────────────────

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      result.error.errors.forEach((error) => {
        const field = error.path.join('.');
        if (!fields[field]) {
          fields[field] = [];
        }
        fields[field].push(error.message);
      });

      const validationError = new ValidationError('Validation failed', fields);
      next(validationError);
      return;
    }
    req.body = result.data;
    next();
  };
}
