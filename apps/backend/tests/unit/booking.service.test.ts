/**
 * Unit tests for booking service.
 * Tests the full escrow flow, error cases, and edge cases.
 * Uses bun:test with module-level Supabase + TrustlessWork mocks.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { mockBookings, mockProperties, mockUsers } from '../mocks/supabase.mock.data.js';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = mock((_: string) => ({}));
const mockSupabase = { from: mockFrom };
const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

// ── TrustlessWork mock ────────────────────────────────────────────────────────

const mockTrustlessWork = {
  createBookingEscrow: mock(async () => ({ escrowId: 'escrow-123' })),
  cancelEscrow: mock(async () => {}),
  releaseEscrow: mock(async () => {}),
};

const trustlessMod = await import('../../src/blockchain/trustlessWork.js');
(trustlessMod as any).trustlessWorkClient = mockTrustlessWork;

// ── Logging mock (suppress logs) ──────────────────────────────────────────────

const loggingMod = await import('../../src/services/logging.service.js');
(loggingMod as any).loggingService = { logBlockchainOperation: mock(() => {}) };

// ── Notification mock ─────────────────────────────────────────────────────────

const notifMod = await import('../../src/services/notification.service.js');
(notifMod as any).createNotification = mock(async () => ({ success: true }));

import {
  BookingService,
  type Booking,
  type BlockchainServices,
  type CreateBookingInput,
} from '../../src/services/booking.service.js';

// ─────────────────────────────────────────────────────────────────────────────

function makeBlockchain(): BlockchainServices {
  return {
    checkAvailability: mock(async () => true),
    createBookingOnChain: mock(async () => BigInt(1)),
    cancelBookingOnChain: mock(async () => {}),
    updateBookingStatusOnChain: mock(async () => {}),
  };
}

describe('BookingService', () => {
  let bookingService: BookingService;
  let blockchain: BlockchainServices;

  beforeEach(() => {
    mockFrom.mockClear();
    mockTrustlessWork.createBookingEscrow.mockClear();
    mockTrustlessWork.cancelEscrow.mockClear();
    mockTrustlessWork.releaseEscrow.mockClear();
    blockchain = makeBlockchain();
    bookingService = new BookingService(blockchain);
  });

  // ── getBookingById ──────────────────────────────────────────────────────────

  describe('getBookingById', () => {
    it('should return a booking when found', async () => {
      const booking = mockBookings[0];
      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            single: mock(async () => ({ data: booking, error: null })),
          })),
        })),
      }));

      const result = await bookingService.getBookingById(booking.id);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(booking);
    });

    it('should return error when booking not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            single: mock(async () => ({ data: null, error: { message: 'Not found' } })),
          })),
        })),
      }));

      const result = await bookingService.getBookingById('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should return error when ID is empty', async () => {
      const result = await bookingService.getBookingById('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking ID is required');
    });
  });

  // ── createBooking ───────────────────────────────────────────────────────────

  describe('createBooking', () => {
    const validInput: CreateBookingInput = {
      property_id: mockProperties[0].id,
      tenant_id: mockUsers[1].id,
      check_in: '2026-08-01',
      check_out: '2026-08-05',
      total_price: 500,
      on_chain_property_id: BigInt(1),
    };

    function setupPropertyAndProfiles() {
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { id: mockProperties[0].id, owner_id: mockUsers[0].id, on_chain_id: 1 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profiles') {
          callCount++;
          const address = callCount === 1
            ? mockUsers[0].stellar_address
            : mockUsers[1].stellar_address;
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { stellar_address: address },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'bookings') {
          return {
            insert: mock(() => ({
              select: mock(() => ({
                single: mock(async () => ({
                  data: { id: 'new-booking', ...validInput, status: 'Pending', escrow_id: 'escrow-123' },
                  error: null,
                })),
              })),
            })),
            update: mock(() => ({
              eq: mock(async () => ({ data: null, error: null })),
            })),
          };
        }
        return {};
      });
    }

    it('should create a booking with escrow successfully', async () => {
      setupPropertyAndProfiles();
      const result = await bookingService.createBooking(validInput);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('Pending');
      expect(result.data?.escrow_id).toBe('escrow-123');
    });

    it('should return error when required fields are missing', async () => {
      const result = await bookingService.createBooking({
        property_id: '',
        tenant_id: '',
        check_in: '',
        check_out: '',
        total_price: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return error for invalid date range (check_in after check_out)', async () => {
      const result = await bookingService.createBooking({
        ...validInput,
        check_in: '2026-08-10',
        check_out: '2026-08-05',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('check_in must be before check_out');
    });

    it('should return error when property not found', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({ data: null, error: { message: 'Not found' } })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await bookingService.createBooking(validInput);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Property not found');
    });

    it('should return error when property owner has no Stellar address', async () => {
      let profileCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { id: mockProperties[0].id, owner_id: mockUsers[0].id, on_chain_id: 1 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profiles') {
          profileCall++;
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { stellar_address: profileCall === 1 ? null : mockUsers[1].stellar_address },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await bookingService.createBooking(validInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Property owner does not have a valid Stellar address');
    });

    it('should return error when tenant has no Stellar address', async () => {
      let profileCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { id: mockProperties[0].id, owner_id: mockUsers[0].id, on_chain_id: null },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profiles') {
          profileCall++;
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { stellar_address: profileCall === 1 ? mockUsers[0].stellar_address : null },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await bookingService.createBooking(validInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tenant does not have a valid Stellar address');
    });

    it('should return error when property is not available on-chain', async () => {
      setupPropertyAndProfiles();
      (blockchain.checkAvailability as ReturnType<typeof mock>).mockImplementation(async () => false);

      const result = await bookingService.createBooking(validInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should return error when total_price is missing or zero', async () => {
      const result = await bookingService.createBooking({ ...validInput, total_price: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('total_price must be a positive number');
    });
  });

  // ── cancelBooking ───────────────────────────────────────────────────────────

  describe('cancelBooking', () => {
    it('should cancel a booking successfully', async () => {
      const booking = mockBookings[0];
      let updateCalled = false;
      mockFrom.mockImplementation((table: string) => {
        if (!updateCalled) {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({ data: booking, error: null })),
              })),
            })),
          };
        }
        return {
          update: mock(() => ({
            eq: mock(() => ({
              select: mock(() => ({
                single: mock(async () => ({
                  data: { ...booking, status: 'Cancelled' },
                  error: null,
                })),
              })),
            })),
          })),
        };
      });

      // First call = select, second = update
      let call = 0;
      mockFrom.mockImplementation(() => {
        call++;
        if (call === 1) {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({ data: booking, error: null })),
              })),
            })),
          };
        }
        return {
          update: mock(() => ({
            eq: mock(() => ({
              select: mock(() => ({
                single: mock(async () => ({
                  data: { ...booking, status: 'Cancelled' },
                  error: null,
                })),
              })),
            })),
          })),
        };
      });

      const result = await bookingService.cancelBooking(booking.id, mockUsers[0].id);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('Cancelled');
    });

    it('should return error when booking not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            single: mock(async () => ({ data: null, error: { message: 'Not found' } })),
          })),
        })),
      }));

      const result = await bookingService.cancelBooking('non-existent', mockUsers[0].id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should return error when booking is already cancelled', async () => {
      const cancelledBooking = { ...mockBookings[0], status: 'Cancelled' };
      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            single: mock(async () => ({ data: cancelledBooking, error: null })),
          })),
        })),
      }));

      const result = await bookingService.cancelBooking(cancelledBooking.id, mockUsers[0].id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already cancelled');
    });

    it('should return error when ID is empty', async () => {
      const result = await bookingService.cancelBooking('', mockUsers[0].id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking ID is required');
    });
  });

  // ── confirmBooking ──────────────────────────────────────────────────────────

  describe('confirmBooking', () => {
    it('should confirm a pending booking successfully', async () => {
      const booking = { ...mockBookings[0], status: 'Pending', escrow_id: 'escrow-123' };
      let call = 0;
      mockFrom.mockImplementation(() => {
        call++;
        if (call === 1) {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({ data: booking, error: null })),
              })),
            })),
          };
        }
        return {
          update: mock(() => ({
            eq: mock(() => ({
              select: mock(() => ({
                single: mock(async () => ({
                  data: { ...booking, status: 'Confirmed' },
                  error: null,
                })),
              })),
            })),
          })),
        };
      });

      const result = await bookingService.confirmBooking(booking.id, mockUsers[0].id);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('Confirmed');
    });

    it('should return error when booking is already confirmed', async () => {
      const confirmedBooking = { ...mockBookings[0], status: 'Confirmed' };
      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            single: mock(async () => ({ data: confirmedBooking, error: null })),
          })),
        })),
      }));

      const result = await bookingService.confirmBooking(confirmedBooking.id, mockUsers[0].id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already confirmed');
    });

    it('should return error when trying to confirm a cancelled booking', async () => {
      const cancelledBooking = { ...mockBookings[0], status: 'Cancelled' };
      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            single: mock(async () => ({ data: cancelledBooking, error: null })),
          })),
        })),
      }));

      const result = await bookingService.confirmBooking(cancelledBooking.id, mockUsers[0].id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot confirm a cancelled booking');
    });

    it('should return error when ID is empty', async () => {
      const result = await bookingService.confirmBooking('', mockUsers[0].id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking ID is required');
    });
  });

  // ── updateBooking ───────────────────────────────────────────────────────────

  describe('updateBooking', () => {
    it('should update booking fields', async () => {
      const booking = mockBookings[0];
      mockFrom.mockImplementation(() => ({
        update: mock(() => ({
          eq: mock(() => ({
            select: mock(() => ({
              single: mock(async () => ({
                data: { ...booking, total_price: 600 },
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await bookingService.updateBooking(booking.id, { total_price: 600 });
      expect(result.success).toBe(true);
      expect(result.data?.total_price).toBe(600);
    });

    it('should return error when ID is empty', async () => {
      const result = await bookingService.updateBooking('', { total_price: 100 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking ID is required');
    });

    it('should return error when no fields provided', async () => {
      const result = await bookingService.updateBooking('booking-1', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('No fields provided for update');
    });
  });

  // ── deleteBooking ───────────────────────────────────────────────────────────

  describe('deleteBooking', () => {
    it('should delete a booking successfully', async () => {
      mockFrom.mockImplementation(() => ({
        delete: mock(() => ({
          eq: mock(async () => ({ error: null })),
        })),
      }));

      const result = await bookingService.deleteBooking('booking-1');
      expect(result.success).toBe(true);
    });

    it('should return error when ID is empty', async () => {
      const result = await bookingService.deleteBooking('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking ID is required');
    });
  });
});
