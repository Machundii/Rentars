/**
 * Unit tests for the UUID format guard in BookingService.getBookingById.
 *
 * Verifies that:
 *  1. An empty string is rejected without touching Supabase
 *  2. A malformed (non-UUID) string is rejected without touching Supabase
 *  3. A string that resembles a UUID but has the wrong length is also rejected
 *  4. A valid UUID still reaches Supabase (query behaviour unchanged)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock refs so they are available before vi.mock hoisting ────────────

const { mockFrom, mockEq, mockSelect, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockFrom, mockEq, mockSelect, mockSingle };
});

vi.mock('../config/supabase.js', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('../blockchain/bookingContract.js', () => ({
  checkAvailability: vi.fn(),
  cancelBookingOnChain: vi.fn(),
  createBookingOnChain: vi.fn(),
  updateBookingStatusOnChain: vi.fn(),
}));
vi.mock('../blockchain/trustlessWork.js', () => ({
  trustlessWorkClient: {
    createBookingEscrow: vi.fn(),
    cancelEscrow: vi.fn(),
    releaseEscrow: vi.fn(),
  },
}));
vi.mock('../services/logging.service.js', () => ({
  loggingService: { logBlockchainOperation: vi.fn() },
}));
vi.mock('../services/notification.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  getPreferences: vi.fn(),
}));
vi.mock('../services/email.service.js', () => ({
  emailService: { sendEmail: vi.fn() },
}));
vi.mock('../services/preferenceToken.js', () => ({
  buildPreferenceUrlForUser: vi.fn(),
}));
vi.mock('../services/refundPolicy.service.js', () => ({
  computeRefund: vi.fn(),
}));
vi.mock('../utils/cursor.js', () => ({
  decodeCursor: vi.fn(),
  buildCursorPage: vi.fn(),
}));
vi.mock('../middleware/metrics.middleware.js', () => ({
  incCounter: vi.fn(),
  bookingsCreatedTotal: {},
  escrowFailuresTotal: {},
}));
vi.mock('../services/availability.service.js', () => ({
  checkDateRangeAvailability: vi.fn(),
}));
vi.mock('../services/pricing.service.js', () => ({
  calculateRangePrice: vi.fn(),
}));

import { BookingService } from '../services/booking.service.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService.getBookingById — UUID validation', () => {
  let service: BookingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingService();
  });

  it('rejects an empty string without querying Supabase', async () => {
    const result = await service.getBookingById('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Booking ID is required');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a malformed ID without querying Supabase', async () => {
    const result = await service.getBookingById('not-a-uuid');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Booking ID must be a valid UUID');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a UUID-like string with wrong segment length without querying Supabase', async () => {
    const result = await service.getBookingById('12345678-1234-1234-1234-12345678');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Booking ID must be a valid UUID');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passes a valid UUID through to Supabase', async () => {
    const validId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    mockSingle.mockResolvedValueOnce({
      data: { id: validId, status: 'Pending' },
      error: null,
    });

    const result = await service.getBookingById(validId);

    expect(mockFrom).toHaveBeenCalledWith('bookings');
    expect(result.success).toBe(true);
  });
});
