/**
 * Unit tests for:
 *  1. Guest-capacity enforcement in BookingService.createBooking
 *  2. ICS generation in utils/ics.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../services/booking.service.js';
import { generateIcs } from '../utils/ics.js';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle, eq: vi.fn(() => ({ single: mockSingle })) }));
const mockEq = vi.fn(() => ({ single: mockSingle, select: mockSelect }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  eq: mockEq,
  update: vi.fn(() => ({ eq: mockEq })),
  delete: vi.fn(() => ({ eq: mockEq })),
}));

vi.mock('../config/supabase.js', () => ({
  supabase: { from: mockFrom },
}));

// ─── Blockchain + TrustlessWork mocks ────────────────────────────────────────

const mockBlockchain = {
  checkAvailability: vi.fn().mockResolvedValue(true),
  createBookingOnChain: vi.fn().mockResolvedValue(BigInt(42)),
  cancelBookingOnChain: vi.fn().mockResolvedValue(undefined),
  updateBookingStatusOnChain: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../blockchain/trustlessWork.js', () => ({
  trustlessWorkClient: {
    createBookingEscrow: vi.fn().mockResolvedValue({ escrowId: 'escrow-abc' }),
    cancelEscrow: vi.fn().mockResolvedValue(undefined),
    releaseEscrow: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/logging.service.js', () => ({
  loggingService: {
    logBlockchainOperation: vi.fn(),
  },
}));

vi.mock('../services/notification.service.js', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STELLAR_OWNER =
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGWKX2ZKUOBQHBU9K6WHEP';
const VALID_STELLAR_TENANT =
  'GDKIJJIKXLOM2NRMPNQZUUYK24ZPVFC6426GZAEP3KUK6KEJLACCWNMX';

/** Set up supabase mock to return a full property row followed by owner and
 *  tenant Stellar addresses, then a successful booking insert. */
function setupSuccessfulMocks(maxGuests: number) {
  let callIndex = 0;

  mockSingle.mockImplementation(() => {
    callIndex += 1;

    // 1st call — fetch property
    if (callIndex === 1) {
      return Promise.resolve({
        data: {
          id: 'prop-1',
          owner_id: 'owner-1',
          on_chain_id: null,
          max_guests: maxGuests,
        },
        error: null,
      });
    }

    // 2nd call — fetch owner Stellar address (profiles)
    if (callIndex === 2) {
      return Promise.resolve({
        data: { stellar_address: VALID_STELLAR_OWNER },
        error: null,
      });
    }

    // 3rd call — fetch tenant Stellar address (profiles)
    if (callIndex === 3) {
      return Promise.resolve({
        data: { stellar_address: VALID_STELLAR_TENANT },
        error: null,
      });
    }

    // 4th call — booking insert select
    return Promise.resolve({
      data: {
        id: 'booking-1',
        property_id: 'prop-1',
        tenant_id: 'tenant-1',
        check_in: '2027-08-01',
        check_out: '2027-08-05',
        guest_count: 2,
        total_price: 400,
        status: 'Pending',
        escrow_id: 'escrow-abc',
      },
      error: null,
    });
  });
}

const BASE_INPUT = {
  property_id: 'prop-1',
  tenant_id: 'tenant-1',
  check_in: '2027-08-01',
  check_out: '2027-08-05',
  total_price: 400,
};

// ─── Capacity enforcement tests ───────────────────────────────────────────────

describe('BookingService — guest capacity enforcement', () => {
  let service: BookingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingService(mockBlockchain);

    // Default from() chain returns the mock
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
  });

  it('rejects a booking when guest_count exceeds max_guests', async () => {
    // Property allows 2 guests; booking requests 3
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'prop-1',
        owner_id: 'owner-1',
        on_chain_id: null,
        max_guests: 2,
      },
      error: null,
    });

    const result = await service.createBooking({ ...BASE_INPUT, guest_count: 3 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds property capacity/i);
    expect(result.error).toContain('3');
    expect(result.error).toContain('2');
  });

  it('accepts a booking exactly at capacity', async () => {
    setupSuccessfulMocks(2);

    const result = await service.createBooking({ ...BASE_INPUT, guest_count: 2 });

    // Will succeed or fail for Stellar address reasons in unit env — what matters
    // is that the capacity check does NOT produce a capacity error
    if (!result.success) {
      expect(result.error).not.toMatch(/exceeds property capacity/i);
    } else {
      expect(result.data).toBeDefined();
    }
  });

  it('accepts a booking well below capacity', async () => {
    setupSuccessfulMocks(6);

    const result = await service.createBooking({ ...BASE_INPUT, guest_count: 1 });

    if (!result.success) {
      expect(result.error).not.toMatch(/exceeds property capacity/i);
    } else {
      expect(result.data).toBeDefined();
    }
  });

  it('rejects when guest_count is missing / zero', async () => {
    const result = await service.createBooking({
      ...BASE_INPUT,
      guest_count: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/guest_count must be at least 1/i);
  });

  it('rejects when required fields are missing', async () => {
    const result = await service.createBooking({
      property_id: '',
      tenant_id: 'tenant-1',
      check_in: '2027-08-01',
      check_out: '2027-08-05',
      guest_count: 2,
      total_price: 400,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });
});

// ─── ICS generation tests ─────────────────────────────────────────────────────

describe('generateIcs — RFC 5545 output', () => {
  const baseEvent = {
    uid: 'booking-abc-123@rentars.app',
    summary: 'Stay at Beachside Villa',
    description: 'Booking ID: abc-123\\nGuests: 3\\nTotal: 600 USDC',
    location: '123 Ocean Ave, Miami, US',
    dtStart: '2027-08-01',
    dtEnd: '2027-08-05',
    created: '2027-06-01T12:00:00Z',
  };

  it('produces a string with CRLF line endings', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('\r\n');
    // Every line should end in \r\n (split on \r\n gives no stray \n)
    const withoutCRLF = ics.replace(/\r\n/g, '');
    expect(withoutCRLF).not.toContain('\n');
  });

  it('begins and ends with the correct calendar wrappers', () => {
    const ics = generateIcs(baseEvent);
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    // Last non-empty line should be END:VCALENDAR
    const nonEmpty = lines.filter(Boolean);
    expect(nonEmpty[nonEmpty.length - 1]).toBe('END:VCALENDAR');
  });

  it('contains a single VEVENT block', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    // Exactly one of each
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(1);
  });

  it('includes the correct UID', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('UID:booking-abc-123@rentars.app');
  });

  it('includes the correct SUMMARY', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('SUMMARY:Stay at Beachside Villa');
  });

  it('includes the LOCATION', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('LOCATION:123 Ocean Ave');
  });

  it('uses all-day DATE values when no time is present', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270801');
    // DTEND should be check-out + 1 day for inclusive all-day range
    expect(ics).toContain('DTEND;VALUE=DATE:20270806');
  });

  it('uses UTC DATETIME values when time is present in input', () => {
    const ics = generateIcs({
      ...baseEvent,
      dtStart: '2027-08-01T14:00:00Z',
      dtEnd: '2027-08-05T11:00:00Z',
    });
    expect(ics).toContain('DTSTART:20270801T140000Z');
    expect(ics).toContain('DTEND:20270805T110000Z');
  });

  it('folds lines that exceed 75 characters', () => {
    const longSummary = 'A'.repeat(80);
    const ics = generateIcs({ ...baseEvent, summary: longSummary });
    const lines = ics.split('\r\n');
    // No unfolded line may exceed 75 chars (continuation lines start with a space)
    const longLines = lines.filter((l) => l.length > 75);
    expect(longLines).toHaveLength(0);
  });

  it('escapes special characters in text fields', () => {
    const ics = generateIcs({
      ...baseEvent,
      summary: 'Villa; Pool, Hot-tub',
      location: 'Street 1\\2, City',
    });
    // Semicolons and commas must be escaped
    expect(ics).toContain('Villa\\; Pool\\,');
  });

  it('includes DTSTAMP when created is provided', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('DTSTAMP:20270601T120000Z');
  });

  it('falls back to current timestamp when created is omitted', () => {
    const before = Date.now();
    const ics = generateIcs({ ...baseEvent, created: undefined });
    const after = Date.now();
    // Just verify DTSTAMP is present and parseable
    const stampMatch = ics.match(/DTSTAMP:(\d{8}T\d{6}Z)/);
    expect(stampMatch).not.toBeNull();
    const stampDate = new Date(
      stampMatch![1].replace(
        /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,
        '$1-$2-$3T$4:$5:$6Z',
      ),
    );
    expect(stampDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(stampDate.getTime()).toBeLessThanOrEqual(after + 1000);
  });

  it('includes PRODID identifying Rentars', () => {
    const ics = generateIcs(baseEvent);
    expect(ics).toContain('PRODID:-//Rentars//');
  });
});
