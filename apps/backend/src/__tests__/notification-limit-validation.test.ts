/**
 * Unit tests for the limit validation guard in getNotificationsCursor.
 *
 * Verifies that:
 *  1. NaN is rejected before touching Supabase
 *  2. Infinity is rejected before touching Supabase
 *  3. A fractional value (1.5) is rejected before touching Supabase
 *  4. limit=1 (lower boundary) is accepted and passed to Supabase as-is
 *  5. limit=100 (upper cap) is accepted and passed to Supabase as-is
 *  6. limit=200 is clamped to 100 (existing cap behaviour unchanged)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock refs ──────────────────────────────────────────────────────────

const { mockLimit, mockOrder2, mockOrder1, mockOr, mockEq, mockSelect, mockFrom } =
  vi.hoisted(() => {
    const mockLimit = vi.fn();
    const mockOrder2 = vi.fn(() => ({ limit: mockLimit }));
    const mockOrder1 = vi.fn(() => ({ order: mockOrder2, limit: mockLimit }));
    const mockOr = vi.fn(() => ({ order: mockOrder1, limit: mockLimit }));
    const mockEq = vi.fn(() => ({ order: mockOrder1, or: mockOr }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    const mockFrom = vi.fn(() => ({ select: mockSelect }));
    return { mockLimit, mockOrder2, mockOrder1, mockOr, mockEq, mockSelect, mockFrom };
  });

vi.mock('../config/supabase.js', () => ({
  supabase: { from: mockFrom },
}));
vi.mock('../services/email.service.js', () => ({
  emailService: { sendEmail: vi.fn() },
}));
vi.mock('../services/preferenceToken.js', () => ({
  buildPreferenceUrlForUser: vi.fn(),
}));

import { getNotificationsCursor } from '../services/notification.service.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('getNotificationsCursor — limit validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return an empty page
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder2.mockReturnValue({ limit: mockLimit });
    mockOrder1.mockReturnValue({ order: mockOrder2, limit: mockLimit });
    mockOr.mockReturnValue({ order: mockOrder1, limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder1, or: mockOr });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('rejects NaN without querying Supabase', async () => {
    const result = await getNotificationsCursor('user-1', null, NaN);

    expect(result.success).toBe(false);
    expect(result.error).toBe('limit must be a finite integer');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects Infinity without querying Supabase', async () => {
    const result = await getNotificationsCursor('user-1', null, Infinity);

    expect(result.success).toBe(false);
    expect(result.error).toBe('limit must be a finite integer');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a fractional limit (1.5) without querying Supabase', async () => {
    const result = await getNotificationsCursor('user-1', null, 1.5);

    expect(result.success).toBe(false);
    expect(result.error).toBe('limit must be a finite integer');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('accepts limit=1 and queries Supabase with pageSize=2 (limit+1 trick)', async () => {
    const result = await getNotificationsCursor('user-1', null, 1);

    expect(result.success).toBe(true);
    // limit+1 for hasMore detection → Supabase should receive 2
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it('accepts limit=100 and queries Supabase with pageSize=101', async () => {
    const result = await getNotificationsCursor('user-1', null, 100);

    expect(result.success).toBe(true);
    expect(mockLimit).toHaveBeenCalledWith(101);
  });

  it('clamps limit=200 to 100 (cap unchanged)', async () => {
    const result = await getNotificationsCursor('user-1', null, 200);

    expect(result.success).toBe(true);
    // pageSize clamped to 100, then +1 for hasMore detection
    expect(mockLimit).toHaveBeenCalledWith(101);
  });
});
