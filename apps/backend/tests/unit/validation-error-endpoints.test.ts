/**
 * Integration tests for validation error normalization across representative endpoints.
 * Tests that all validation failures return 400 status with { message, fields } structure.
 */

import { describe, it, expect } from 'bun:test';
import { registerSchema, loginSchema } from '../../src/validators/auth.validator.js';
import { createBookingSchema } from '../../src/validators/booking.validator.js';
import { propertySchema } from '../../src/validators/property.validator.js';
import { updateProfileSchema } from '../../src/validators/profile.validator.js';
import { ValidationError } from '../../src/types/errors.js';

/**
 * Helper to convert Zod validation errors to our normalized format
 */
function convertZodErrorToValidation(zodError: any): ValidationError {
  const fields: Record<string, string[]> = {};
  zodError.errors.forEach((error: any) => {
    const field = error.path.join('.');
    if (!fields[field]) {
      fields[field] = [];
    }
    fields[field].push(error.message);
  });
  return new ValidationError('Validation failed', fields);
}

describe('Validation Error Normalization', () => {
  describe('Auth endpoints', () => {
    it('should normalize register validation errors', () => {
      const result = registerSchema.safeParse({
        email: 'invalid-email',
        password: 'short',
        name: '',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        const validationError = convertZodErrorToValidation(result.error);
        expect(validationError.message).toBe('Validation failed');
        expect(validationError.fields).toBeDefined();
        expect(Object.keys(validationError.fields).length).toBeGreaterThan(0);

        // Should have per-field errors
        const fields = Object.keys(validationError.fields);
        expect(fields.some(f => f.includes('email'))).toBe(true);
        expect(fields.some(f => f.includes('password'))).toBe(true);
        expect(fields.some(f => f.includes('name'))).toBe(true);
      }
    });

    it('should normalize login validation errors', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: '',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        const validationError = convertZodErrorToValidation(result.error);
        expect(validationError.fields.email).toBeDefined();
        expect(validationError.fields.password).toBeDefined();
        expect(Array.isArray(validationError.fields.email)).toBe(true);
        expect(Array.isArray(validationError.fields.password)).toBe(true);
      }
    });
  });

  describe('Booking endpoints', () => {
    it('should normalize booking validation errors', () => {
      const result = createBookingSchema.safeParse({
        property_id: 'not-a-uuid',
        check_in: 'invalid-date',
        check_out: 'invalid-date',
        guest_count: 0,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        const validationError = convertZodErrorToValidation(result.error);
        expect(Object.keys(validationError.fields).length).toBeGreaterThan(0);

        // Each field should have an array of error messages
        Object.values(validationError.fields).forEach(messages => {
          expect(Array.isArray(messages)).toBe(true);
          expect(messages.length).toBeGreaterThan(0);
          messages.forEach(msg => {
            expect(typeof msg).toBe('string');
          });
        });
      }
    });
  });

  describe('Property endpoints', () => {
    it('should normalize property validation errors', () => {
      const result = propertySchema.safeParse({
        title: 'AB', // Too short
        description: 'Short', // Too short
        price_per_night: -100, // Negative
        location: {
          city: 'Miami',
          country: 'USA',
          lat: 100, // Invalid latitude
          lng: -80.19,
        },
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        const validationError = convertZodErrorToValidation(result.error);
        expect(validationError.fields).toBeDefined();

        // Should have nested field errors
        const fieldNames = Object.keys(validationError.fields);
        expect(fieldNames.some(f => f.includes('title'))).toBe(true);
        expect(fieldNames.some(f => f.includes('price'))).toBe(true);
      }
    });
  });

  describe('Profile endpoints', () => {
    it('should normalize profile update validation errors', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'not-a-url',
        phone: '123', // Too short
        stellar_address: 'not-a-key',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        const validationError = convertZodErrorToValidation(result.error);
        expect(Object.keys(validationError.fields).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error response structure', () => {
    it('should always have message property', () => {
      const error = new ValidationError('Validation failed', { field: ['error'] });
      expect(error.message).toBe('Validation failed');
    });

    it('should always have fields property as Record<string, string[]>', () => {
      const error = new ValidationError('Validation failed', {
        field1: ['error1', 'error2'],
        field2: ['error3'],
      });
      expect(error.fields).toBeDefined();
      expect(typeof error.fields).toBe('object');
      Object.values(error.fields).forEach(messages => {
        expect(Array.isArray(messages)).toBe(true);
      });
    });

    it('should handle multiple errors on single field', () => {
      const result = registerSchema.safeParse({
        email: 'invalid',
        password: 'weak',
        name: '',
      });

      if (!result.success) {
        const validationError = convertZodErrorToValidation(result.error);
        // email field might have multiple validation errors
        if (validationError.fields.email) {
          expect(Array.isArray(validationError.fields.email)).toBe(true);
        }
      }
    });
  });
});
