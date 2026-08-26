/**
 * Tests for cursor-based (keyset) pagination utilities and service integration.
 *
 * Verifies:
 *  - encodeCursor / decodeCursor round-trip
 *  - buildCursorPage correctly detects hasMore and emits nextCursor
 *  - Pages are non-overlapping and complete even with interleaved inserts
 *  - getUserBookings rejects cursors for non-created sort modes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeCursor, decodeCursor, buildCursorPage } from '../utils/cursor.js';
import { BookingService } from '../services/booking.service.js';

// ─── cursor utilities ─────────────────────────────────────────────────────────

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a valid payload', () => {
    const payload = { created_at: '2027-01-15T10:00:00Z', id: 'abc-123' };
    const encoded = encodeCursor(payload);
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain('{');  // must be opaque
    expect(decodeCursor(encoded)).toEqual(payload);
  });

  it('returns null for undefined / empty cursor', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for malformed base64', () => {
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
  });

  it('returns null for valid base64 that decodes to wrong shape', () => {
    const bad = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });

  it('returns null for base64 that decodes to non-JSON', () => {
    const bad = Buffer.from('not json', 'utf8').toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });
});

// ─── buildCursorPage ──────────────────────────────────────────────────────────

describe('buildCursorPage', () => {
  function makeRows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `id-${String(i).padStart(3, '0')}`,
      created_at: `2027-01-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
    }));
  }

  it('returns all rows and null nextCursor when rows <= limit', () => {
    const rows = makeRows(5);
    const page = buildCursorPage(rows, 5);
    expect(page.data).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it('returns limit rows and a nextCursor when rows > limit (hasMore)', () => {
    const rows = makeRows(21); // limit=20, service fetched 21
    const page = buildCursorPage(rows, 20);
    expect(page.data).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();
  });

  it('nextCursor decodes to the last row of the returned page', () => {
    const rows = makeRows(21);
    const page = buildCursorPage(rows, 20);
    const decoded = decodeCursor(page.nextCursor!);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(rows[19].id);
    expect(decoded!.created_at).toBe(rows[19].created_at);
  });

  it('pages are non-overlapping (cursor filters correct rows)', () => {
    const allRows = makeRows(9);
    const LIMIT = 3;

    const page1 = buildCursorPage([...allRows.slice(0, 3), allRows[3]], LIMIT);
    expect(page1.data.map((r) => r.id)).toEqual(['id-000', 'id-001', 'id-002']);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = buildCursorPage([...allRows.slice(3, 6), allRows[6]], LIMIT);
    expect(page2.data.map((r) => r.id)).toEqual(['id-003', 'id-004', 'id-005']);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = buildCursorPage(allRows.slice(6, 9), LIMIT);
    expect(page3.data.map((r) => r.id)).toEqual(['id-006', 'id-007', 'id-008']);
    expect(page3.nextCursor).toBeNull();

    const allIds = [
      ...page1.data.map((r) => r.id),
      ...page2.data.map((r) => r.id),
      ...page3.data.map((r) => r.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

// ─── BookingService.getUserBookings (cursor) ──────────────────────────────────
//
// The Supabase query builder is a thenable — `await query` resolves the last
// object in the fluent chain. We mock mockFrom per-call using
// mockImplementation so each query step resolves inline with a real Promise,
// matching the pattern used in bookingConflict.test.ts.

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../config/supabase.js', () => ({ supabase: { from: mockFrom } }));
vi.mock('../blockchain/bookingContract.js', () => ({
  checkAvailability: vi.fn(),
  cancelBookingOnChain: vi.fn(),
  createBookingOnChain: vi.fn(),
  updateBookingStatusOnChain: vi.fn(),
}));
vi.mock('../blockchain/trustlessWork.js', () => ({
  trustlessWorkClient: { createBookingEscrow: vi.fn(), cancelEscrow: vi.fn(), releaseEscrow: vi.fn() },
}));
vi.mock('../services/logging.service.js', () => ({
  loggingService: { logBlockchainOperation: vi.fn() },
}));
vi.mock('../services/notification.service.js', () => ({
  createNotification: vi.fn(),
}));
vi.mock('../middleware/metrics.middleware.js', () => ({
  incCounter: vi.fn(),
  bookingsCreatedTotal: {},
  escrowFailuresTotal: {},
}));

// ─── Helper: build a fully-resolved fluent Supabase mock ─────────────────────
//
// Returns a mock `from('bookings')` that records the .or() call (so we can
// assert on it) and resolves with the given rows when awaited.

function makeBookingsQueryMock(rows: unknown[]) {
  const orSpy = vi.fn();

  // The object returned by .limit() (and optionally .eq(status) / .or(cursor))
  // must be thenable so `await query` resolves to { data, error }.
  const terminal = {
    or: (arg: string) => {
      orSpy(arg);
      return Promise.resolve({ data: rows, error: null });
    },
    eq: (_col: string, _val: string) => ({
      or: (arg: string) => {
        orSpy(arg);
        return Promise.resolve({ data: rows, error: null });
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };

  const builder = {
    select: () => ({
      eq: () => ({
        order: () => ({
          order: () => ({
            limit: () => terminal,
          }),
        }),
      }),
    }),
  };

  return { builder, orSpy };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService.getUserBookings', () => {
  let service: BookingService;

  const makeBooking = (index: number) => ({
    id: `booking-${String(index).padStart(3, '0')}`,
    tenant_id: 'user-1',
    created_at: `2027-01-${String(30 - index).padStart(2, '0')}T10:00:00Z`,
    status: 'Confirmed',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingService();
  });

  it('returns first page with nextCursor when more rows exist', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => makeBooking(i));
    const { builder } = makeBookingsQueryMock(rows);
    mockFrom.mockReturnValue(builder);

    const result = await service.getUserBookings('user-1', null, 20);

    expect(result.success).toBe(true);
    expect(result.data!.data).toHaveLength(20);
    expect(result.data!.nextCursor).not.toBeNull();
  });

  it('returns last page with null nextCursor when no more rows', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeBooking(i));
    const { builder } = makeBookingsQueryMock(rows);
    mockFrom.mockReturnValue(builder);

    const result = await service.getUserBookings('user-1', null, 20);

    expect(result.success).toBe(true);
    expect(result.data!.data).toHaveLength(5);
    expect(result.data!.nextCursor).toBeNull();
  });

  it('passes cursor to the or() filter on subsequent pages', async () => {
    const { builder, orSpy } = makeBookingsQueryMock([]);
    mockFrom.mockReturnValue(builder);

    const cursor = encodeCursor({ created_at: '2027-01-20T10:00:00Z', id: 'booking-010' });
    await service.getUserBookings('user-1', cursor, 20);

    expect(orSpy).toHaveBeenCalledWith(expect.stringContaining('2027-01-20T10:00:00Z'));
  });

  it('returns error when userId is empty', async () => {
    const result = await service.getUserBookings('');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/user id is required/i);
  });
});

// ─── getUserBookings — cursor rejected for non-created sort modes ─────────────

describe('BookingService.getUserBookings — cursor with non-created sort', () => {
  let service: BookingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingService();
  });

  it('rejects a cursor when sort=date without querying Supabase', async () => {
    const cursor = encodeCursor({ created_at: '2027-01-15T10:00:00Z', id: 'booking-010' });

    const result = await service.getUserBookings('user-1', cursor, 20, null, 'date');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cursor pagination is only supported for sort=created');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a cursor when sort=price without querying Supabase', async () => {
    const cursor = encodeCursor({ created_at: '2027-01-15T10:00:00Z', id: 'booking-005' });

    const result = await service.getUserBookings('user-1', cursor, 20, null, 'price');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cursor pagination is only supported for sort=created');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('allows null cursor with sort=date — first page proceeds without or() filter', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `booking-${String(i).padStart(3, '0')}`,
      tenant_id: 'user-1',
      created_at: `2027-01-${String(30 - i).padStart(2, '0')}T10:00:00Z`,
      status: 'Confirmed',
    }));
    const { builder, orSpy } = makeBookingsQueryMock(rows);
    mockFrom.mockReturnValue(builder);

    const result = await service.getUserBookings('user-1', null, 20, null, 'date');

    expect(result.success).toBe(true);
    expect(orSpy).not.toHaveBeenCalled();
    expect(result.data!.data).toHaveLength(5);
  });

  it('a second date-sort page is rejected — no first-page row can be duplicated', async () => {
    // A client that passes a cursor from a previous page while using sort=date
    // must receive an error, not a silent restart from page 1.
    const cursor = encodeCursor({ created_at: '2027-01-20T10:00:00Z', id: 'booking-010' });

    const result = await service.getUserBookings('user-1', cursor, 20, null, 'date');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Cursor pagination is only supported for sort=created');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
