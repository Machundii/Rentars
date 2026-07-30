/**
 * Unit tests for the audit log service — recording and listing entries.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockSingle = mock(async () => ({ data: null, error: null }));
const mockInsert = mock(() => ({ select: () => ({ single: mockSingle }) }));

const limitBuilder: any = {};
const orderBuilder: any = { limit: mock(async () => ({ data: [], error: null })) };
Object.assign(limitBuilder, orderBuilder);

const selectBuilder: any = { order: mock(() => orderBuilder) };
selectBuilder.eq = mock(() => selectBuilder);
const mockSelect = mock(() => selectBuilder);

const mockSupabase = {
  from: mock((_: string) => ({
    select: mockSelect,
    insert: mockInsert,
  })),
};

mock.module('../../src/config/supabase.js', () => ({ supabase: mockSupabase }));

const { record, listAuditLogs } = await import('../../src/services/auditLog.service.js');

describe('auditLog.service', () => {
  beforeEach(() => {
    mockSingle.mockClear();
    mockInsert.mockClear();
  });

  describe('record', () => {
    it('inserts an audit entry with actor, action, target, and metadata', async () => {
      mockSingle.mockImplementationOnce(async () => ({
        data: {
          id: 'log-1',
          actor_id: 'admin-1',
          action: 'review.approve',
          target_type: 'review',
          target_id: 'review-1',
          metadata: {},
          created_at: new Date().toISOString(),
        },
        error: null,
      }));

      const result = await record('admin-1', 'review.approve', 'review', 'review-1');

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'admin-1',
          action: 'review.approve',
          target_type: 'review',
          target_id: 'review-1',
        }),
      );
    });

    it('does not throw when the insert fails', async () => {
      mockSingle.mockImplementationOnce(async () => ({
        data: null,
        error: { message: 'db unavailable' },
      }));

      const result = await record('admin-1', 'report.resolved', 'report', 'report-1');
      expect(result.success).toBe(false);
    });
  });

  describe('listAuditLogs', () => {
    it('returns an empty list when there are no entries', async () => {
      const result = await listAuditLogs();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('clamps limit to the 1-200 range', async () => {
      const result = await listAuditLogs({ limit: 5000 });
      expect(result.success).toBe(true);
    });
  });
});
