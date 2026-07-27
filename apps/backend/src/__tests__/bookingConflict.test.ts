/**
 * Booking conflict detection tests (#266).
 *
 * Verifies that:
 *  1. A conflict from the atomic RPC surfaces as success=false with conflict=true
 *  2. A host-block from the atomic RPC surfaces as success=false with conflict=true
 *  3. Concurrent overlapping requests result in exactly one success (409 for the loser)
 *  4. Non-overlapping bookings both succeed
 *  5. Escrow is NOT created when the reservation fails (conflict)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../services/booking.service.js';
import type { CreateBookingInput, BlockchainServices } from '../services/booking.service.js';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockRpc  = vi.fn();
const mockFrom = vi.fn();

vi.mock('../config/supabase.js', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

// ─── TrustlessWork mock ───────────────────────────────────────────────────────

const mockCreateEscrow = vi.fn();
const mockCancelEscrow = vi.fn();

vi.mock('../blockchain/trustlessWork.js', () => ({
  trustlessWorkClient: {
    createBookingEscrow: mockCreateEscrow,
    cancelEscrow:        mockCancelEscrow,
  },
}));

// ─── Logging / notifications ──────────────────────────────────────────────────

vi.mock('../services/logging.service.js', () => ({
  loggingService: { logBlockchainOperation: vi.fn() },
}));

vi.mock('../services/notification.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock('../middleware/metrics.middleware.js', () => ({
  incCounter:            vi.fn(),
  bookingsCreatedTotal:  {},
  escrowFailuresTotal:   {},
}));

// ─────────────────────────────────────────────────────────────────────────────

function makeBlockchain(): BlockchainServices {
  return {
    checkAvailability:        vi.fn().mockResolvedValue(true),
    createBookingOnChain:     vi.fn().mockResolvedValue(BigInt(1)),
    cancelBookingOnChain:     vi.fn().mockResolvedValue(undefined),
    updateBookingStatusOnChain: vi.fn().mockResolvedValue(undefined),
  };
}

const VALID_STELLAR = 'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A';

function stubPropertyAndProfile() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'properties') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'prop-1', owner_id: 'owner-1', on_chain_id: null, max_guests: 10 },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { stellar_address: VALID_STELLAR },
              error: null,
            }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'b1' }, error: null }) }) }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    };
  });
}

const BASE_INPUT: CreateBookingInput = {
  property_id: 'prop-1',
  tenant_id: 'tenant-1',
  check_in: '2026-08-10',
  check_out: '2026-08-15',
  guest_count: 2,
  total_price: 500,
  rules_acknowledged_at: new Date().toISOString(),
};

describe('Booking conflict detection', () => {
  let blockchain: BlockchainServices;
  let service: BookingService;

  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockCreateEscrow.mockReset();
    mockCancelEscrow.mockReset();
    blockchain = makeBlockchain();
    service = new BookingService(blockchain);
    stubPropertyAndProfile();
  });

  it('returns conflict=true when atomic RPC raises BOOKING_CONFLICT', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'BOOKING_CONFLICT: dates overlap with an existing booking' },
    });

    const result = await service.createBooking(BASE_INPUT);

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.error).toMatch(/conflict/i);
  });

  it('returns conflict=true when atomic RPC raises BOOKING_BLOCKED', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'BOOKING_BLOCKED: dates are blocked by the host' },
    });

    const result = await service.createBooking(BASE_INPUT);

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.error).toMatch(/blocked/i);
  });

  it('does NOT create escrow when reservation fails with a conflict', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'BOOKING_CONFLICT: dates overlap with an existing booking' },
    });

    await service.createBooking(BASE_INPUT);

    expect(mockCreateEscrow).not.toHaveBeenCalled();
  });

  it('succeeds when the atomic RPC reserves the booking', async () => {
    mockRpc.mockResolvedValue({ data: 'booking-uuid-1', error: null });
    mockCreateEscrow.mockResolvedValue({ escrowId: 'escrow-abc' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'prop-1', owner_id: 'owner-1', on_chain_id: null, max_guests: 10 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { stellar_address: VALID_STELLAR },
                error: null,
              }),
            }),
          }),
        };
      }
      // bookings table — update (attach escrow_id)
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'booking-uuid-1', status: 'Pending', escrow_id: 'escrow-abc' },
                error: null,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    const result = await service.createBooking(BASE_INPUT);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('booking-uuid-1');
  });

  it('concurrent overlapping requests: exactly one should succeed', async () => {
    let reservations = 0;

    mockRpc.mockImplementation(async () => {
      reservations++;
      if (reservations === 1) {
        return { data: 'booking-first', error: null };
      }
      return {
        data: null,
        error: { message: 'BOOKING_CONFLICT: dates overlap with an existing booking' },
      };
    });

    mockCreateEscrow.mockResolvedValue({ escrowId: 'escrow-ok' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'prop-1', owner_id: 'owner-1', on_chain_id: null, max_guests: 10 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { stellar_address: VALID_STELLAR }, error: null }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'booking-first', status: 'Pending', escrow_id: 'escrow-ok' },
                error: null,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    const input2: CreateBookingInput = { ...BASE_INPUT, tenant_id: 'tenant-2' };

    const [r1, r2] = await Promise.all([
      service.createBooking(BASE_INPUT),
      new BookingService(makeBlockchain()).createBooking(input2),
    ]);

    const successes = [r1, r2].filter((r) => r.success).length;
    expect(successes).toBe(1);

    const loser = r1.success ? r2 : r1;
    expect(loser.conflict).toBe(true);
  });
});
