import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@/types/errors.js';

export const geocodeSchema = z.object({
  address: z.string().min(1, 'Address is required'),
});

export const reverseGeocodeSchema = z.object({
  lat: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), 'Latitude must be a number')
    .refine((val) => {
      const n = parseFloat(val);
      return n >= -90 && n <= 90;
    }, 'Latitude must be between -90 and 90'),
  lng: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), 'Longitude must be a number')
    .refine((val) => {
      const n = parseFloat(val);
      return n >= -180 && n <= 180;
    }, 'Longitude must be between -180 and 180'),
});

export const searchSchema = z.object({
  lat: z.string().refine((val) => !isNaN(parseFloat(val)), 'Latitude must be a number'),
  lng: z.string().refine((val) => !isNaN(parseFloat(val)), 'Longitude must be a number'),
  radius: z
    .string()
    .optional()
    .refine((val) => val === undefined || !isNaN(parseFloat(val)), 'Radius must be a number'),
});

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
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
    req.query = result.data;
    next();
  };
}
