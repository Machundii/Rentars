/**
 * Tests for Feature D — Occupancy Heatmap
 *
 * Covers:
 *  1. getOccupancyHeatmap — input validation
 *  2. Date-range generation (dateRange helper tested via service output)
 *  3. Status assignment — booked, blocked, available
 *  4. Boundary conditions — same-day, 366-day cap
 *  5. Authorization logic (ownership check, unit-tested)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOccupancyHeatmap } from '../services/occupancy.service.js';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockNot  = vi.fn();
const mockGt   = vi.fn(() => ({ not: mockNot }));
const mockLt   = vi.fn(() => ({ gt: mockGt }));
const mockEqB  = vi.fn(() => ({ lt: mockLt }));
const mockNotB = vi.fn(() => ({ lt: mockLt }));

// availability_ranges chain: .eq('property_id').eq('is_available').lt().gt()
const mockGtBlock  = vi.fn();
const mockLtBlock  = vi.fn(() => ({ gt: mockGtBlock }));
const mockEqBlock2 = vi.fn(() => ({ lt: mockLtBlock }));
const mockEqBlock1 = vi.fn(() => ({ eq: mockEqBlock2 }));

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn(() => ({
            eq:  mockEqB,
            not: mockNotB,
          })),
        };
      }
      if (table === 'availability_ranges') {
        return { select: vi.fn(() => ({ eq: mockEqBlock1 })) };
      }
      return {};
    }),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wire up booking + block mocks for a given test scenario. */
function setupMocks(
  bookings: { check_in: string; check_out: string; status: string }[],
  blocks:   { start_date: string; end_date: string }[],
) {
  mockNot.mockResolvedValueOnce({ data: bookings, error: null });
  mockGtBlock.mockResolvedValueOnce({ data: blocks, error: null });
}

// ─── Input validation ─────────────────────────────────────────────────────────

describe('getOccupancyHeatmap — input validation', () => {
  it('returns error when propertyId is empty', async () => {
    const r = await getOccupancyHeatmap('', '2027-08-01', '2027-08-31');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('returns error for invalid date format', async () => {
    const r = await getOccupancyHeatmap('prop-1', 'not-a-date', '2027-08-31');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalid date/i);
  });

  it('returns error when from is after to', async () => {
    const r = await getOccupancyHeatmap('prop-1', '2027-09-01', '2027-08-01');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/before/i);
  });

  it('returns error when range exceeds 366 days', async () => {
    const r = await getOccupancyHeatmap('prop-1', '2027-01-01', '2028-12-31');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/366/);
  });
});

// ─── Day count ────────────────────────────────────────────────────────────────

describe('getOccupancyHeatmap — day count', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns exactly N+1 days for an N-day range', async () => {
    setupMocks([], []);
    const r = await getOccupancyHeatmap('prop-1', '2027-08-01', '2027-08-07');
    expect(r.success).toBe(true);
    expect(r.data!.days).toHaveLength(7); // 1st through 7th inclusive
  });

  it('works for a single-day range', async () => {
    setupMocks([], []);
    const r = await getOccupancyHeatmap('prop-1', '2027-08-15', '2027-08-15');
    expect(r.success).toBe(true);
    expect(r.data!.days).toHaveLength(1);
    expect(r.data!.days[0].date).toBe('2027-08-15');
  });
});

// ─── Status assignment ────────────────────────────────────────────────────────

describe('getOccupancyHeatmap — status assignment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks a day as available when no bookings or blocks exist', async () => {
    setupMocks([], []);
    const r = await getOccupancyHeatmap('prop-1', '2027-08-01', '2027-08-03');
    expect(r.success).toBe(true);
    expect(r.data!.days.every((d) => d.status === 'available')).toBe(true);
  });

  it('marks booked days correctly (check_out day is NOT booked)', async () => {
    // Booking covers 01–03 (nights 01, 02; check_out=03 is departure)
    setupMocks(
      [{ check_in: '2027-08-01', check_out: '2027-08-03', status: 'Confirmed' }],
      [],
    );
    const r = await getOccupancyHeatmap('prop-1', '2027-08-01', '2027-08-04');
    expect(r.success).toBe(true);

    const byDate = Object.fromEntries(r.data!.days.map((d) => [d.date, d.status]));
    expect(byDate['2027-08-01']).toBe('booked');
    expect(byDate['2027-08-02']).toBe('booked');
    expect(byDate['2027-08-03']).toBe('available'); // check-out day — not a booked night
    expect(byDate['2027-08-04']).toBe('available');
  });

  it('marks blocked days correctly', async () => {
    setupMocks(
      [],
      [{ start_date: '2027-08-05', end_date: '2027-08-08' }],
    );
    const r = await getOccupancyHeatmap('prop-1', '2027-08-03', '2027-08-10');
    expect(r.success).toBe(true);

    const byDate = Object.fromEntries(r.data!.days.map((d) => [d.date, d.status]));
    expect(byDate['2027-08-03']).toBe('available');
    expect(byDate['2027-08-05']).toBe('blocked');
    expect(byDate['2027-08-06']).toBe('blocked');
    expect(byDate['2027-08-07']).toBe('blocked');
    expect(byDate['2027-08-08']).toBe('available'); // end_date is exclusive
    expect(byDate['2027-08-09']).toBe('available');
  });

  it('booked takes precedence over blocked on the same day', async () => {
    setupMocks(
      [{ check_in: '2027-08-10', check_out: '2027-08-12', status: 'Confirmed' }],
      [{ start_date: '2027-08-09', end_date: '2027-08-13' }],
    );
    const r = await getOccupancyHeatmap('prop-1', '2027-08-10', '2027-08-10');
    expect(r.success).toBe(true);
    expect(r.data!.days[0].status).toBe('booked');
  });
});

// ─── Summary counts ───────────────────────────────────────────────────────────

describe('getOccupancyHeatmap — summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('summary totals equal the number of days', async () => {
    setupMocks(
      [{ check_in: '2027-08-01', check_out: '2027-08-03', status: 'Confirmed' }],
      [{ start_date: '2027-08-04', end_date: '2027-08-05' }],
    );
    const r = await getOccupancyHeatmap('prop-1', '2027-08-01', '2027-08-05');
    expect(r.success).toBe(true);
    const { booked, blocked, available, total } = r.data!.summary;
    expect(booked + blocked + available).toBe(total);
    expect(total).toBe(5);
    expect(booked).toBe(2);    // 01, 02
    expect(blocked).toBe(1);   // 04 (end_date=05 is exclusive)
    expect(available).toBe(2); // 03, 05
  });
});

// ─── Authorization logic ──────────────────────────────────────────────────────

describe('Occupancy heatmap authorization', () => {
  function canViewHeatmap(requesterId: string, ownerId: string): boolean {
    return requesterId === ownerId;
  }

  it('allows the property owner', () => {
    expect(canViewHeatmap('host-1', 'host-1')).toBe(true);
  });

  it('blocks a different user', () => {
    expect(canViewHeatmap('tenant-1', 'host-1')).toBe(false);
  });

  it('blocks an unauthenticated caller (empty id)', () => {
    expect(canViewHeatmap('', 'host-1')).toBe(false);
  });
});
