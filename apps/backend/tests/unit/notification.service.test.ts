/**
 * Unit tests for notification.service — critical notification logic.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ── Build a reusable chainable supabase mock ─────────────────────────────────

function chain(result: unknown) {
  const node: Record<string, unknown> = {
    select: mock(() => node),
    insert: mock(() => node),
    update: mock(() => node),
    delete: mock(() => node),
    eq: mock(() => node),
    not: mock(() => node),
    or: mock(() => node),
    order: mock(() => node),
    // Return node (not a bare Promise) so callers can chain .or() after .limit().
    // The `then` property makes the node itself thenable so `await node` resolves.
    limit: mock(() => node),
    single: mock(async () => result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return node;
}

const mockFrom = mock((_: string) => chain({ data: null, error: null }));

mock.module('../../src/config/supabase.js', () => ({
  supabase: { from: mockFrom },
}));

// Stub email service to prevent SMTP connections in tests
mock.module('../../src/services/email.service.js', () => ({
  emailService: {
    sendBookingCreated: mock(async () => {}),
    sendBookingConfirmed: mock(async () => {}),
    sendBookingCancelled: mock(async () => {}),
  },
}));

mock.module('../../src/services/preferenceToken.js', () => ({
  buildPreferenceUrlForUser: mock((_: string) => 'https://example.com/prefs'),
}));

import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationsCursor,
} from '../../src/services/notification.service.js';
import { decodeCursor } from '../../src/utils/cursor.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('notification.service', () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  // ── createNotification ──────────────────────────────────────────────────────

  describe('createNotification', () => {
    it('creates a notification successfully', async () => {
      const notif = { id: 'n1', user_id: 'u1', type: 'booking_created', data: {}, read: false };
      mockFrom.mockImplementation((_: string) =>
        chain({ data: notif, error: null }),
      );
      const result = await createNotification('u1', 'booking_created', { booking_id: 'b1' });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('booking_created');
      expect(result.data?.read).toBe(false);
    });

    it('returns error when insert fails', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: { message: 'Insert failed' } }),
      );
      const result = await createNotification('u1', 'booking_confirmed', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });

    it('supports new notification types: review_submitted and host_response', async () => {
      const types = ['review_submitted', 'host_response'] as const;
      for (const type of types) {
        mockFrom.mockImplementation((_: string) =>
          chain({ data: { id: 'n1', user_id: 'u1', type, data: {}, read: false }, error: null }),
        );
        const result = await createNotification('u1', type, { message: 'test' });
        expect(result.success).toBe(true);
        expect(result.data?.type).toBe(type);
      }
    });

    it('supports dispute_initiated notification type', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({
          data: { id: 'n1', user_id: 'u1', type: 'dispute_initiated', data: {}, read: false },
          error: null,
        }),
      );
      const result = await createNotification('u1', 'dispute_initiated', {});
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('dispute_initiated');
    });
  });

  // ── getNotifications ────────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('returns list of notifications', async () => {
      const notifications = [
        { id: 'n1', user_id: 'u1', type: 'booking_created', read: false },
        { id: 'n2', user_id: 'u1', type: 'review_submitted', read: true },
      ];
      mockFrom.mockImplementation((_: string) =>
        chain({ data: notifications, error: null }),
      );
      const result = await getNotifications('u1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('returns empty array when user has no notifications', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: null }),
      );
      const result = await getNotifications('u-empty');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('returns error on DB failure', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: { message: 'Connection timeout' } }),
      );
      const result = await getNotifications('u1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('marks a notification as read successfully', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: null }),
      );
      const result = await markAsRead('n1', 'u1');
      expect(result.success).toBe(true);
    });

    it('returns error when update fails', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: { message: 'Update failed' } }),
      );
      const result = await markAsRead('n1', 'u1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ── markAllAsRead ───────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('marks all notifications as read', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: null }),
      );
      const result = await markAllAsRead('u1');
      expect(result.success).toBe(true);
    });

    it('returns error on DB failure', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: { message: 'DB error' } }),
      );
      const result = await markAllAsRead('u1');
      expect(result.success).toBe(false);
    });
  });

  // ── deleteNotification ──────────────────────────────────────────────────────

  describe('deleteNotification', () => {
    it('deletes a notification successfully', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: null }),
      );
      const result = await deleteNotification('n1', 'u1');
      expect(result.success).toBe(true);
    });

    it('returns error when delete fails', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: { message: 'Delete failed' } }),
      );
      const result = await deleteNotification('n1', 'u1');
      expect(result.success).toBe(false);
    });
  });

  // ── getNotificationsCursor — stable tie-breaker (#409) ──────────────────────

  describe('getNotificationsCursor', () => {
    const SHARED_TS = '2026-08-01T10:00:00.000Z';

    // Two notifications sharing an identical created_at — id is the only differentiator
    const row1 = { id: 'b-uuid', user_id: 'u1', type: 'booking_created', data: {}, read: false, created_at: SHARED_TS };
    const row2 = { id: 'a-uuid', user_id: 'u1', type: 'booking_confirmed', data: {}, read: false, created_at: SHARED_TS };

    it('first page returns the expected row and a non-null nextCursor', async () => {
      // Returning 2 rows for a page size of 1 activates the hasMore detection
      mockFrom.mockImplementation((_: string) =>
        chain({ data: [row1, row2], error: null }),
      );

      const result = await getNotificationsCursor('u1', null, 1);
      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(1);
      expect(result.data?.data[0].id).toBe(row1.id);
      expect(result.data?.nextCursor).not.toBeNull();
    });

    it('cursor encodes both created_at and id for the tie-breaker', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: [row1, row2], error: null }),
      );

      const result = await getNotificationsCursor('u1', null, 1);
      const decoded = decodeCursor(result.data?.nextCursor ?? null);
      expect(decoded).not.toBeNull();
      expect(decoded?.created_at).toBe(SHARED_TS);
      expect(decoded?.id).toBe(row1.id);
    });

    it('second page contains the remaining row and no further cursor', async () => {
      // First page: returns 2 rows → hasMore = true
      mockFrom.mockImplementationOnce((_: string) =>
        chain({ data: [row1, row2], error: null }),
      );
      const page1 = await getNotificationsCursor('u1', null, 1);
      const cursor = page1.data?.nextCursor!;

      // Second page: returns only row2 → hasMore = false
      mockFrom.mockImplementationOnce((_: string) =>
        chain({ data: [row2], error: null }),
      );
      const page2 = await getNotificationsCursor('u1', cursor, 1);

      expect(page2.success).toBe(true);
      expect(page2.data?.data).toHaveLength(1);
      expect(page2.data?.data[0].id).toBe(row2.id);
      expect(page2.data?.nextCursor).toBeNull();
    });

    it('returns error on DB failure', async () => {
      mockFrom.mockImplementation((_: string) =>
        chain({ data: null, error: { message: 'DB error' } }),
      );
      const result = await getNotificationsCursor('u1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
});
