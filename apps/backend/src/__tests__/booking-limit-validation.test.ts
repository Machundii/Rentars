/**
 * Unit tests for the pagination limit guard in listUserBookings controller.
 *
 * Verifies that:
 *  1. A fractional limit (e.g. 1.5) returns 422
 *  2. A non-numeric string (parsed as NaN) returns 422
 *  3. An infinite-looking value returns 422
 *  4. A valid integer (e.g. 10) passes through to the service
 *  5. A limit above 100 is accepted by the controller (service clamps it)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';

// ─── Hoist mock refs ──────────────────────────────────────────────────────────

const { mockGetUserBookings } = vi.hoisted(() => {
  const mockGetUserBookings = vi.fn();
  return { mockGetUserBookings };
});

// Mock everything that gets touched at module-load time
vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../services/booking.service.js', () => {
  class BookingService {
    getUserBookings = mockGetUserBookings;
    getBookingById = vi.fn();
    createBooking = vi.fn();
    cancelBooking = vi.fn();
    confirmBooking = vi.fn();
    completeBooking = vi.fn();
    disputeBooking = vi.fn();
    updateBooking = vi.fn();
    deleteBooking = vi.fn();
    getBookingStatusHistory = vi.fn();
    requestModification = vi.fn();
    acceptModification = vi.fn();
    declineModification = vi.fn();
    raiseDispute = vi.fn();
    resolveDispute = vi.fn();
  }
  return { BookingService };
});

vi.mock('../services/property.service.js', () => ({
  getPropertyById: vi.fn(),
}));

vi.mock('../utils/ics.js', () => ({
  generateIcs: vi.fn(),
}));

// ─── Import controller after mocks ───────────────────────────────────────────

import { listUserBookings } from '../controllers/booking.controller.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(limitQuery: string | undefined, userId = 'user-uuid-123'): AuthRequest {
  return {
    userId,
    query: {
      ...(limitQuery !== undefined ? { limit: limitQuery } : {}),
    },
    headers: {},
  } as unknown as AuthRequest;
}

function makeRes(): Response & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res as unknown as Response & { _status: number; _body: unknown };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('listUserBookings — limit validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 for a fractional limit (1.5)', async () => {
    const res = makeRes();
    await listUserBookings(makeReq('1.5'), res);

    expect(res._status).toBe(422);
    expect((res._body as { error: string }).error).toBe('limit must be a positive integer');
    expect(mockGetUserBookings).not.toHaveBeenCalled();
  });

  it('returns 422 for a non-numeric string (parsed as NaN)', async () => {
    const res = makeRes();
    await listUserBookings(makeReq('abc'), res);

    expect(res._status).toBe(422);
    expect((res._body as { error: string }).error).toBe('limit must be a positive integer');
    expect(mockGetUserBookings).not.toHaveBeenCalled();
  });

  it('returns 422 for "Infinity" (non-finite)', async () => {
    const res = makeRes();
    // Number('Infinity') === Infinity which is not finite
    await listUserBookings(makeReq('Infinity'), res);

    expect(res._status).toBe(422);
    expect((res._body as { error: string }).error).toBe('limit must be a positive integer');
    expect(mockGetUserBookings).not.toHaveBeenCalled();
  });

  it('passes a valid integer limit to the service', async () => {
    mockGetUserBookings.mockResolvedValueOnce({
      success: true,
      data: { items: [], nextCursor: null },
    });

    const res = makeRes();
    await listUserBookings(makeReq('10'), res);

    expect(mockGetUserBookings).toHaveBeenCalledWith(
      'user-uuid-123',
      null,
      10,
      null,
      'created',
      'desc',
    );
  });

  it('accepts a limit above 100 and passes it to the service unchanged', async () => {
    mockGetUserBookings.mockResolvedValueOnce({
      success: true,
      data: { items: [], nextCursor: null },
    });

    const res = makeRes();
    await listUserBookings(makeReq('200'), res);

    // Controller should NOT reject 200 — it's a valid integer > 0
    expect(mockGetUserBookings).toHaveBeenCalled();
    const calledLimit = (mockGetUserBookings.mock.calls[0] as unknown[])[2];
    expect(calledLimit).toBe(200);
  });
});
