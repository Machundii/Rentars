/**
 * Unit tests for Zod validators.
 * Pure functions — no external dependencies needed.
 */

import { describe, it, expect } from 'bun:test';
import { createBookingSchema, updateBookingSchema } from '../../src/validators/booking.validator.js';
import {
  propertySchema,
  updatePropertySchema,
  propertySearchSchema,
} from '../../src/validators/property.validator.js';
import { registerSchema, loginSchema, walletChallengeSchema, walletVerifySchema } from '../../src/validators/auth.validator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Booking validators
// ─────────────────────────────────────────────────────────────────────────────

describe('createBookingSchema', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const checkIn = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 5);
  const checkOut = dayAfter.toISOString().split('T')[0];

  const valid = {
    property_id: '550e8400-e29b-41d4-a716-446655440000',
    check_in: checkIn,
    check_out: checkOut,
    guests: 2,
  };

  it('should accept valid booking input', () => {
    const result = createBookingSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject missing property_id', () => {
    const result = createBookingSchema.safeParse({ ...valid, property_id: undefined });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID property_id', () => {
    const result = createBookingSchema.safeParse({ ...valid, property_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject check_out before check_in', () => {
    const result = createBookingSchema.safeParse({ ...valid, check_in: checkOut, check_out: checkIn });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.errors.map((e) => e.path.join('.'));
      expect(fields).toContain('check_out');
    }
  });

  it('should reject guests less than 1', () => {
    const result = createBookingSchema.safeParse({ ...valid, guests: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative total_price', () => {
    const result = createBookingSchema.safeParse({ ...valid, total_price: -100 });
    expect(result.success).toBe(false);
  });

  it('should accept optional stellar_address when valid', () => {
    const result = createBookingSchema.safeParse({
      ...valid,
      stellar_address: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNHERX3LRJCX5FWCL46664F3',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid stellar_address format', () => {
    const result = createBookingSchema.safeParse({ ...valid, stellar_address: 'not-valid' });
    expect(result.success).toBe(false);
  });
});

describe('updateBookingSchema', () => {
  it('should accept valid status', () => {
    for (const status of ['Pending', 'Confirmed', 'Cancelled', 'Completed']) {
      expect(updateBookingSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('should reject invalid status', () => {
    const result = updateBookingSchema.safeParse({ status: 'InvalidStatus' });
    expect(result.success).toBe(false);
  });

  it('should accept empty object (all fields optional)', () => {
    expect(updateBookingSchema.safeParse({}).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property validators
// ─────────────────────────────────────────────────────────────────────────────

describe('propertySchema', () => {
  const valid = {
    title: 'Beautiful Beach House',
    description: 'A wonderful beachfront property with stunning views.',
    price_per_night: 250,
    location: { city: 'Miami', country: 'USA', lat: 25.77, lng: -80.19 },
    max_guests: 6,
    bedrooms: 3,
    bathrooms: 2,
  };

  it('should accept valid property input', () => {
    const result = propertySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject title shorter than 3 characters', () => {
    const result = propertySchema.safeParse({ ...valid, title: 'AB' });
    expect(result.success).toBe(false);
  });

  it('should reject title longer than 100 characters', () => {
    const result = propertySchema.safeParse({ ...valid, title: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('should reject description shorter than 10 characters', () => {
    const result = propertySchema.safeParse({ ...valid, description: 'Short' });
    expect(result.success).toBe(false);
  });

  it('should reject zero price', () => {
    const result = propertySchema.safeParse({ ...valid, price_per_night: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject negative price', () => {
    const result = propertySchema.safeParse({ ...valid, price_per_night: -100 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid amenity', () => {
    const result = propertySchema.safeParse({ ...valid, amenities: ['invalid_amenity'] });
    expect(result.success).toBe(false);
  });

  it('should accept valid amenities', () => {
    const result = propertySchema.safeParse({ ...valid, amenities: ['wifi', 'parking', 'pool'] });
    expect(result.success).toBe(true);
  });

  it('should default amenities to empty array', () => {
    const result = propertySchema.safeParse(valid);
    if (result.success) {
      expect(result.data.amenities).toEqual([]);
    }
  });

  it('should reject invalid image URL', () => {
    const result = propertySchema.safeParse({ ...valid, images: ['not-a-url'] });
    expect(result.success).toBe(false);
  });

  it('should reject invalid location latitude', () => {
    const result = propertySchema.safeParse({
      ...valid,
      location: { ...valid.location, lat: 100 }, // > 90
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePropertySchema', () => {
  it('should accept partial updates', () => {
    expect(updatePropertySchema.safeParse({ title: 'New Title' }).success).toBe(true);
    expect(updatePropertySchema.safeParse({ price_per_night: 300 }).success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(updatePropertySchema.safeParse({}).success).toBe(true);
  });
});

describe('propertySearchSchema', () => {
  it('should accept valid search filters', () => {
    const result = propertySearchSchema.safeParse({
      city: 'Miami',
      min_price: '100',
      max_price: '500',
    });
    expect(result.success).toBe(true);
  });

  it('should coerce numeric strings', () => {
    const result = propertySearchSchema.safeParse({ min_price: '100', max_price: '500' });
    if (result.success) {
      expect(typeof result.data.min_price).toBe('number');
      expect(result.data.min_price).toBe(100);
    }
  });

  it('should reject when max_price < min_price', () => {
    const result = propertySearchSchema.safeParse({ min_price: '500', max_price: '100' });
    expect(result.success).toBe(false);
  });

  it('should reject when check_out before check_in', () => {
    const result = propertySearchSchema.safeParse({
      check_in: '2026-08-10',
      check_out: '2026-08-01',
    });
    expect(result.success).toBe(false);
  });

  it('should default page=1 and limit=20', () => {
    const result = propertySearchSchema.safeParse({});
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should cap limit at 100', () => {
    const result = propertySearchSchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth validators
// ─────────────────────────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const valid = { email: 'user@example.com', password: 'SecurePass1!', name: 'Alice' };

  it('should accept valid registration input', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('should lowercase email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'USER@EXAMPLE.COM' });
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('should reject password shorter than 8 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('should reject empty name', () => {
    expect(registerSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('should accept valid login input', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'pass' }).success).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'pass' }).success).toBe(false);
  });

  it('should reject empty password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });
});

describe('walletChallengeSchema', () => {
  it('should accept a valid Stellar public key', () => {
    expect(
      walletChallengeSchema.safeParse({
        address: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNHERX3LRJCX5FWCL46664F3',
      }).success
    ).toBe(true);
  });

  it('should reject an invalid key', () => {
    expect(walletChallengeSchema.safeParse({ address: 'not-a-key' }).success).toBe(false);
  });

  it('should reject missing address', () => {
    expect(walletChallengeSchema.safeParse({}).success).toBe(false);
  });
});

describe('walletVerifySchema', () => {
  it('should accept valid verify input', () => {
    expect(
      walletVerifySchema.safeParse({
        address: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNHERX3LRJCX5FWCL46664F3',
        challenge: 'challenge-string',
        signature: 'base64-signature',
      }).success
    ).toBe(true);
  });

  it('should reject missing fields', () => {
    expect(walletVerifySchema.safeParse({ address: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNHERX3LRJCX5FWCL46664F3' }).success).toBe(false);
  });
});
