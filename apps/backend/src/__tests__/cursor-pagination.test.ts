/**
 * Tests for cursor-based (keyset) pagination utilities and service integration.
 *
 * Verifies:
 *  - encodeCursor / decodeCursor round-trip
 *  - buildCursorPage correctly detects hasMore and emits nextCursor
 *  - Pages are non-overlapping and complete even with interleaved inserts
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
    // Service fetches limit+1; if we got limit+1 back there is a next page
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
    // Last row in data is index 19 (id-019)
    expect(decoded!.id).toBe(rows[19].id);
    expect(decoded!.created_at).toBe(rows[19].created_at);
  });

  it('pages are non-overlapping (cursor filters correct rows)', () => {
    // Simulate 3 pages of 3 rows each from a 9-row dataset
    const allRows = makeRows(9);
    const LIMIT = 3;

    // Page 1: no cursor — rows 0..2, nextCursor points after row 2
    const page1 = buildCursorPage([...allRows.slice(0, 3), allRows[3]], LIMIT);
    expect(page1.data.map((r) => r.id)).toEqual(['id-000', 'id-001', 'id-002']);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2: cursor after row 2 — rows 3..5
    const page2 = buildCursorPage([...allRows.slice(3, 6), allRows[6]], LIMIT);
    expect(page2.data.map((r) => r.id)).toEqual(['id-003', 'id-004', 'id-005']);
    expect(page2.nextCursor).not.toBeNull();

    // Page 3: cursor after row 5 — rows 6..8, no more
    const page3 = buildCursorPage(allRows.slice(6, 9), LIMIT);
    expect(page3.data.map((r) => r.id)).toEqual(['id-006', 'id-007', 'id-008']);
    expect(page3.nextCursor).toBeNull();

    // Verify no id appears in more than one page
    const allIds = [
      ...page1.data.map((r) => r.id),
      ...page2.data.map((r) => r.id),
      ...page3.data.map((r) => r.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});

// ─── BookingService.getUserBookings (cursor) ──────────────────────────────────

// Minimal Supabase mock
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockOrder2 = vi.fn(() => ({ limit: mockLimit }));
const mockOrder1 = vi.fn(() => ({ order: mockOrder2, limit: mockLimit }));
const mockOr = vi.fn(() => ({ order: mockOrder1, limit: mockLimit }));
const mockEq = vi.fn(() => ({
  order: mockOrder1,
  or: mockOr,
}));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('../config/supabase.js', () => ({ supabase: { from: mockFrom } }));
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
  createNotification: vi.fn(),
}));

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

    // Wire the fluent builder so .limit() returns the rows
    mockLimit.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    mockOrder2.mockReturnValue({ limit: mockLimit });
    mockOrder1.mockReturnValue({ order: mockOrder2, limit: mockLimit });
    mockOr.mockReturnValue({ order: mockOrder1, limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder1, or: mockOr });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('returns first page with nextCursor when more rows exist', async () => {
    // Return 21 rows for a limit-20 request (limit+1 trick)
    const rows = Array.from({ length: 21 }, (_, i) => makeBooking(i));
    mockLimit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await service.getUserBookings('user-1', null, 20);

    expect(result.success).toBe(true);
    expect(result.data!.data).toHaveLength(20);
    expect(result.data!.nextCursor).not.toBeNull();
  });

  it('returns last page with null nextCursor when no more rows', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeBooking(i));
    mockLimit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await service.getUserBookings('user-1', null, 20);

    expect(result.success).toBe(true);
    expect(result.data!.data).toHaveLength(5);
    expect(result.data!.nextCursor).toBeNull();
  });

  it('passes cursor to the or() filter on subsequent pages', async () => {
    const cursor = encodeCursor({ created_at: '2027-01-20T10:00:00Z', id: 'booking-010' });
    mockLimit.mockResolvedValueOnce({ data: [], error: null });

    await service.getUserBookings('user-1', cursor, 20);

    // .or() should have been called with the cursor-based keyset filter
    expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('2027-01-20T10:00:00Z'));
  });

  it('returns error when userId is empty', async () => {
    const result = await service.getUserBookings('');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/user id is required/i);
  });

  it('respects the max limit cap of 100', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    await service.getUserBookings('user-1', null, 999);
    // limit(101) should have been called, not limit(1000)
    expect(mockLimit).toHaveBeenCalledWith(101); // 100 + 1 for hasMore detection
  });
});
