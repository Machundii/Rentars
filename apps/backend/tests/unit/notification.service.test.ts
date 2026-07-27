/**
 * Unit tests for notification service.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ── Supabase mock (module-level) ──────────────────────────────────────────────

const mockSingleFn = mock(async () => ({ data: null, error: null }));
const mockFrom = mock((_: string) => ({
  insert: mock(() => ({ select: mock(() => ({ single: mockSingleFn })) })),
  select: mock(() => ({
    eq: mock(() => ({
      order: mock(() => ({ limit: mock(async () => ({ data: [], error: null })) })),
      eq: mock(async () => ({ data: null, error: null })),
    })),
  })),
  update: mock(() => ({
    eq: mock(() => ({
      eq: mock(async () => ({ data: null, error: null })),
    })),
  })),
}));

const mockSupabase = { from: mockFrom };

const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../../src/services/notification.service.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('notification.service', () => {
  beforeEach(() => {
    mockSingleFn.mockClear();
    mockFrom.mockClear();
  });

  // ── createNotification ──────────────────────────────────────────────────────

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      const mockNotif = {
        id: 'notif-1',
        user_id: 'u1',
        type: 'booking_created',
        data: { booking_id: 'b1' },
        read: false,
      };

      mockFrom.mockImplementation((_: string) => ({
        insert: mock(() => ({
          select: mock(() => ({
            single: mock(async () => ({ data: mockNotif, error: null })),
          })),
        })),
      }));

      const result = await createNotification('u1', 'booking_created', { booking_id: 'b1' });
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('booking_created');
      expect(result.data?.read).toBe(false);
    });

    it('should return error when insert fails', async () => {
      mockFrom.mockImplementation((_: string) => ({
        insert: mock(() => ({
          select: mock(() => ({
            single: mock(async () => ({ data: null, error: { message: 'Insert failed' } })),
          })),
        })),
      }));

      const result = await createNotification('u1', 'booking_confirmed', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });

    it('should support all notification types', async () => {
      const types = ['booking_created', 'booking_confirmed', 'booking_cancelled', 'payment_received'] as const;

      for (const type of types) {
        mockFrom.mockImplementation((_: string) => ({
          insert: mock(() => ({
            select: mock(() => ({
              single: mock(async () => ({
                data: { id: 'n1', user_id: 'u1', type, data: {}, read: false },
                error: null,
              })),
            })),
          })),
        }));

        const result = await createNotification('u1', type, {});
        expect(result.success).toBe(true);
        expect(result.data?.type).toBe(type);
      }
    });
  });

  // ── getNotifications ────────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('should return list of notifications', async () => {
      const notifications = [
        { id: 'n1', user_id: 'u1', type: 'booking_created', read: false },
        { id: 'n2', user_id: 'u1', type: 'booking_confirmed', read: true },
      ];

      mockFrom.mockImplementation((_: string) => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(() => ({
              limit: mock(async () => ({ data: notifications, error: null })),
            })),
          })),
        })),
      }));

      const result = await getNotifications('u1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array when no notifications', async () => {
      mockFrom.mockImplementation((_: string) => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(() => ({
              limit: mock(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      }));

      const result = await getNotifications('u-no-notifs');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return error on DB failure', async () => {
      mockFrom.mockImplementation((_: string) => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(() => ({
              limit: mock(async () => ({ data: null, error: { message: 'Connection timeout' } })),
            })),
          })),
        })),
      }));

      const result = await getNotifications('u1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockFrom.mockImplementation((_: string) => ({
        update: mock(() => ({
          eq: mock(() => ({
            eq: mock(async () => ({ data: null, error: null })),
          })),
        })),
      }));

      const result = await markAsRead('n1', 'u1');
      expect(result.success).toBe(true);
    });

    it('should return error when update fails', async () => {
      mockFrom.mockImplementation((_: string) => ({
        update: mock(() => ({
          eq: mock(() => ({
            eq: mock(async () => ({ data: null, error: { message: 'Update failed' } })),
          })),
        })),
      }));

      const result = await markAsRead('n1', 'u1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ── markAllAsRead ───────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockFrom.mockImplementation((_: string) => ({
        update: mock(() => ({
          eq: mock(() => ({
            eq: mock(async () => ({ data: null, error: null })),
          })),
        })),
      }));

      const result = await markAllAsRead('u1');
      expect(result.success).toBe(true);
    });

    it('should return error on DB failure', async () => {
      mockFrom.mockImplementation((_: string) => ({
        update: mock(() => ({
          eq: mock(() => ({
            eq: mock(async () => ({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      }));

      const result = await markAllAsRead('u1');
      expect(result.success).toBe(false);
    });
  });
});
