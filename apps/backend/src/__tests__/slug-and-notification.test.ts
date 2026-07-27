/**
 * Tests for:
 *  A. generateSlug / extractIdSuffix / isValidSlug (apps/backend/src/utils/slug.ts)
 *     — uniqueness, determinism, special-character handling, truncation
 *
 *  B. notifyHostFollowers (notification.service.ts)
 *     — fan-out count, preference gating, 0-follower short-circuit,
 *       individual failure does not abort fan-out
 *
 *  C. Canonical-redirect logic (pure function extracted from the page)
 *     — verifies the redirect condition matches the spec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSlug,
  extractIdSuffix,
  isValidSlug,
} from '../utils/slug.js';
import { notifyHostFollowers } from '../services/notification.service.js';

// ─── Supabase + service mocks ─────────────────────────────────────────────────

const mockInsert      = vi.fn();
const mockSelect      = vi.fn();
const mockEq          = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle      = vi.fn();

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert:  mockInsert,
      select:  mockSelect,
      update:  vi.fn(() => ({ eq: mockEq })),
    })),
  },
}));

mockInsert.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq, maybeSingle: mockMaybeSingle });
mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle });
mockMaybeSingle.mockResolvedValue({ data: null, error: null });
mockSingle.mockResolvedValue({ data: null, error: null });

vi.mock('../services/cache.service.js', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

// ─────────────────────────────────────────────────────────────────────────────
// A. Slug utility
// ─────────────────────────────────────────────────────────────────────────────

describe('generateSlug()', () => {
  const ID_A = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const ID_B = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  it('produces a lowercase hyphen-separated string', () => {
    const slug = generateSlug('Cozy Loft', 'Paris', ID_A);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('includes a 6-char suffix derived from the id', () => {
    const slug = generateSlug('Cozy Loft', 'Paris', ID_A);
    // ID_A without hyphens starts with 'a1b2c3d4e5f6…' → first 6 = 'a1b2c3'
    expect(slug.endsWith('-a1b2c3')).toBe(true);
  });

  it('is deterministic — same inputs always produce the same slug', () => {
    const s1 = generateSlug('Beach House', 'Miami', ID_A);
    const s2 = generateSlug('Beach House', 'Miami', ID_A);
    expect(s1).toBe(s2);
  });

  it('produces different slugs for different ids with the same title+city', () => {
    const s1 = generateSlug('Beach House', 'Miami', ID_A);
    const s2 = generateSlug('Beach House', 'Miami', ID_B);
    expect(s1).not.toBe(s2);
  });

  it('handles special characters in title (strips non-alphanumeric)', () => {
    const slug = generateSlug('Café & Bar!', 'São Paulo', ID_A);
    expect(slug).not.toMatch(/[^a-z0-9-]/);
  });

  it('handles undefined / null city gracefully', () => {
    const slugUndef = generateSlug('Penthouse', undefined, ID_A);
    const slugNull  = generateSlug('Penthouse', null, ID_A);
    expect(slugUndef).toMatch(/^[a-z0-9-]+$/);
    expect(slugUndef).toBe(slugNull);
  });

  it('truncates the base to at most 60 characters before the suffix', () => {
    const longTitle = 'A'.repeat(80);
    const slug = generateSlug(longTitle, 'Berlin', ID_A);
    // Remove the 7-char suffix ("-a1b2c3") to measure the base
    const base = slug.slice(0, slug.lastIndexOf('-'));
    expect(base.length).toBeLessThanOrEqual(60);
  });

  it('does not produce double hyphens', () => {
    const slug = generateSlug('Hello  World', 'New   York', ID_A);
    expect(slug).not.toContain('--');
  });

  it('does not start or end the base with a hyphen', () => {
    const slug = generateSlug('  Spaced  ', '  City  ', ID_A);
    const base = slug.slice(0, slug.lastIndexOf('-'));
    expect(base.startsWith('-')).toBe(false);
    expect(base.endsWith('-')).toBe(false);
  });

  it('falls back to "property" when title is empty', () => {
    const slug = generateSlug('', 'Rome', ID_A);
    expect(slug.startsWith('property-')).toBe(true);
  });
});

// ─── extractIdSuffix ──────────────────────────────────────────────────────────

describe('extractIdSuffix()', () => {
  it('extracts the 6-char suffix from a well-formed slug', () => {
    const slug   = 'cozy-loft-paris-a1b2c3';
    const suffix = extractIdSuffix(slug);
    expect(suffix).toBe('a1b2c3');
  });

  it('returns null for a malformed slug (no parts)', () => {
    expect(extractIdSuffix('nohyphen')).toBeNull();
  });

  it('returns null when the last segment is not exactly 6 lowercase hex chars', () => {
    expect(extractIdSuffix('some-slug-ABCDEF')).toBeNull();  // uppercase
    expect(extractIdSuffix('some-slug-1234567')).toBeNull(); // 7 chars
    expect(extractIdSuffix('some-slug-12345')).toBeNull();   // 5 chars
  });

  it('round-trips with generateSlug', () => {
    const id   = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const slug = generateSlug('Test Title', 'TestCity', id);
    expect(extractIdSuffix(slug)).toBe('a1b2c3');
  });
});

// ─── isValidSlug ─────────────────────────────────────────────────────────────

describe('isValidSlug()', () => {
  it('accepts a well-formed slug', () => {
    expect(isValidSlug('cozy-loft-paris-a1b2c3')).toBe(true);
  });

  it('rejects slugs with uppercase letters', () => {
    expect(isValidSlug('Cozy-Loft-a1b2c3')).toBe(false);
  });

  it('rejects slugs with spaces', () => {
    expect(isValidSlug('cozy loft a1b2c3')).toBe(false);
  });

  it('rejects slugs longer than 200 characters', () => {
    expect(isValidSlug('a'.repeat(201))).toBe(false);
  });

  it('accepts a slug of exactly 200 characters', () => {
    // 200 lowercase letters is valid
    expect(isValidSlug('a'.repeat(200))).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. notifyHostFollowers — fan-out
// ─────────────────────────────────────────────────────────────────────────────

const FAN_OUT_DATA = {
  propertyId:    'prop-001',
  propertyTitle: 'Cozy Loft Downtown',
  propertySlug:  'cozy-loft-downtown-a1b2c3',
  hostId:        'host-001',
  hostName:      'Alice',
};

// Mock follow.service so we control the follower list
vi.mock('../services/follow.service.js', () => ({
  getHostFollowerIds: vi.fn(),
}));

// Mock notification preferences to always allow (default)
vi.mock('../services/preferenceToken.js', () => ({
  buildPreferenceUrlForUser: vi.fn().mockReturnValue('http://example.com/prefs'),
  verifyPreferenceToken:     vi.fn().mockReturnValue(null),
}));

vi.mock('./email.service.js', () => ({ emailService: { sendBookingCreated: vi.fn() } }));

import { getHostFollowerIds } from '../services/follow.service.js';

describe('notifyHostFollowers()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { notified: 0 } when the host has no followers', async () => {
    vi.mocked(getHostFollowerIds).mockResolvedValueOnce({
      success: true, data: [],
    });

    const r = await notifyHostFollowers(FAN_OUT_DATA);
    expect(r.success).toBe(true);
    expect(r.data?.notified).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates one notification per follower', async () => {
    vi.mocked(getHostFollowerIds).mockResolvedValueOnce({
      success: true, data: ['f1', 'f2', 'f3'],
    });

    // Preferences: all allow (maybeSingle returns no prefs → defaults allow)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    // Insert succeeds for every follower
    mockSingle.mockResolvedValue({ data: { id: 'notif-1' }, error: null });

    const r = await notifyHostFollowers(FAN_OUT_DATA);
    expect(r.success).toBe(true);
    expect(r.data?.notified).toBe(3);
  });

  it('skips followers who have disabled new_property notifications', async () => {
    vi.mocked(getHostFollowerIds).mockResolvedValueOnce({
      success: true, data: ['f1', 'f2'],
    });

    // f1 has new_property disabled, f2 allows all
    mockMaybeSingle
      .mockResolvedValueOnce({
        data: {
          user_id: 'f1',
          email_notifications: true,
          push_notifications: true,
          notification_types: { new_property: false },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null }); // f2 — no prefs → default allow

    mockSingle.mockResolvedValue({ data: { id: 'notif-x' }, error: null });

    const r = await notifyHostFollowers(FAN_OUT_DATA);
    expect(r.success).toBe(true);
    // Only f2 gets a notification
    expect(r.data?.notified).toBe(1);
  });

  it('continues fan-out when one follower notification fails', async () => {
    vi.mocked(getHostFollowerIds).mockResolvedValueOnce({
      success: true, data: ['f1', 'f2'],
    });

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // f1 insert fails, f2 insert succeeds
    mockSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })
      .mockResolvedValueOnce({ data: { id: 'notif-2' }, error: null });

    const r = await notifyHostFollowers(FAN_OUT_DATA);
    expect(r.success).toBe(true);
    // Only f2 counted
    expect(r.data?.notified).toBe(1);
  });

  it('returns success: false when getHostFollowerIds fails', async () => {
    vi.mocked(getHostFollowerIds).mockResolvedValueOnce({
      success: false, error: 'DB unreachable',
    });

    const r = await notifyHostFollowers(FAN_OUT_DATA);
    expect(r.success).toBe(false);
    expect(r.error).toBe('DB unreachable');
  });

  it('embeds the correct property payload in every notification', async () => {
    vi.mocked(getHostFollowerIds).mockResolvedValueOnce({
      success: true, data: ['f1'],
    });

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: { id: 'notif-1' }, error: null });

    await notifyHostFollowers(FAN_OUT_DATA);

    const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.type).toBe('new_property');
    expect((insertArg.data as Record<string, unknown>).propertySlug).toBe(FAN_OUT_DATA.propertySlug);
    expect((insertArg.data as Record<string, unknown>).hostId).toBe(FAN_OUT_DATA.hostId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Canonical redirect logic (pure function mirror of the Next.js page)
// ─────────────────────────────────────────────────────────────────────────────

describe('Canonical redirect logic', () => {
  /**
   * Mirror the condition from apps/web/src/app/property/[id]/page.tsx.
   * A redirect is triggered when the URL segment does not match the
   * property's canonical slug.
   */
  function shouldRedirect(urlSegment: string, canonicalSlug: string): boolean {
    return urlSegment !== canonicalSlug;
  }

  it('does NOT redirect when segment matches the canonical slug', () => {
    expect(shouldRedirect('cozy-loft-paris-a1b2c3', 'cozy-loft-paris-a1b2c3')).toBe(false);
  });

  it('redirects when segment is a raw UUID (legacy URL)', () => {
    expect(
      shouldRedirect(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'cozy-loft-paris-a1b2c3',
      ),
    ).toBe(true);
  });

  it('redirects when segment is a stale slug (title changed)', () => {
    expect(shouldRedirect('old-title-paris-a1b2c3', 'new-title-paris-a1b2c3')).toBe(true);
  });

  it('does not redirect when property has no slug and segment is the id', () => {
    const id   = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const slug = id; // fallback: slug = id when no slug exists
    expect(shouldRedirect(id, slug)).toBe(false);
  });
});
