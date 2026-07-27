import { describe, expect, it } from 'vitest';
import { summarizeBookingPreferences } from '../analytics';
import type { FormattedBooking } from '../types';

function makeBooking(overrides: Partial<FormattedBooking>): FormattedBooking {
  return {
    id: '1',
    propertyTitle: 'Test Property',
    location: 'New York, NY',
    checkIn: new Date('2026-01-01'),
    checkOut: new Date('2026-01-04'),
    totalPrice: 300,
    status: 'completed',
    escrowStatus: 'released',
    ...overrides,
  };
}

describe('summarizeBookingPreferences', () => {
  it('returns zeroed summary when there are no bookings', () => {
    const summary = summarizeBookingPreferences([]);
    expect(summary).toEqual({
      totalBookings: 0,
      totalSpent: 0,
      averageStayNights: 0,
      favoriteLocation: null,
    });
  });

  it('aggregates spend, stay length, and favorite location', () => {
    const bookings = [
      makeBooking({
        id: '1',
        location: 'Miami, FL',
        totalPrice: 300,
        checkIn: new Date('2026-01-01'),
        checkOut: new Date('2026-01-04'),
      }),
      makeBooking({
        id: '2',
        location: 'Miami, FL',
        totalPrice: 500,
        checkIn: new Date('2026-02-01'),
        checkOut: new Date('2026-02-03'),
      }),
      makeBooking({
        id: '3',
        location: 'New York, NY',
        totalPrice: 200,
        checkIn: new Date('2026-03-01'),
        checkOut: new Date('2026-03-02'),
      }),
    ];

    const summary = summarizeBookingPreferences(bookings);

    expect(summary.totalBookings).toBe(3);
    expect(summary.totalSpent).toBe(1000);
    expect(summary.averageStayNights).toBeCloseTo((3 + 2 + 1) / 3);
    expect(summary.favoriteLocation).toBe('Miami, FL');
  });
});
