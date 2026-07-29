/**
 * Unit tests for report service — submission, duplicate prevention, resolution.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockSingle = mock(async () => ({ data: null, error: null }));
const mockInsert = mock(() => ({ select: () => ({ single: mockSingle }) }));
const mockEqUpdate = mock(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = mock(() => ({ eq: mockEqUpdate }));
const mockOrder = mock(async () => ({ data: [], error: null }));

// select() returns a builder whose .eq() re-returns itself and whose
// .order() is the terminal, awaitable call — mirrors the real query shape.
const selectBuilder: any = { order: mockOrder };
selectBuilder.eq = mock(() => selectBuilder);
const mockSelect = mock(() => selectBuilder);

const mockSupabase = {
  from: mock((_: string) => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
};

mock.module('../../src/config/supabase.js', () => ({ supabase: mockSupabase }));
mock.module('../../src/services/notification.service.js', () => ({
  createNotification: mock(async () => ({ success: true, data: {} })),
  shouldSendInApp: mock(async () => true),
}));
// auditLog.service.js is intentionally left unmocked here: it shares the same
// mocked supabase client above (mockSupabase.from() is table-agnostic), so the
// real record() runs and audit calls show up as extra mockInsert invocations.
// This avoids mock.module colliding with auditLog.service.test.ts, which needs
// the real module (bun runs all test files in one process without --isolate).

const { submitReport, resolveReport, listReports } = await import(
  '../../src/services/report.service.js'
);

describe('report.service', () => {
  beforeEach(() => {
    mockSingle.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();
    mockEqUpdate.mockClear();
  });

  describe('submitReport', () => {
    it('rejects an invalid target type', async () => {
      const result = await submitReport('user-1', 'foo' as any, 'target-1', 'spam');
      expect(result.success).toBe(false);
      expect(result.error).toContain('target_type');
    });

    it('rejects an invalid reason', async () => {
      const result = await submitReport('user-1', 'property', 'target-1', 'nonsense' as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('reason');
    });

    it('creates a report on valid input', async () => {
      mockSingle.mockImplementationOnce(async () => ({
        data: {
          id: 'report-1',
          target_type: 'property',
          target_id: 'target-1',
          reporter_id: 'user-1',
          reason: 'spam',
          status: 'pending',
        },
        error: null,
      }));

      const result = await submitReport('user-1', 'property', 'target-1', 'spam', 'looks fake');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('report-1');
    });

    it('surfaces a duplicate report as a 409 conflict', async () => {
      mockSingle.mockImplementationOnce(async () => ({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }));

      const result = await submitReport('user-1', 'property', 'target-1', 'spam');
      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.statusCode).toBe(409);
    });
  });

  describe('resolveReport', () => {
    it('rejects an invalid status', async () => {
      const result = await resolveReport('report-1', 'admin-1', 'pending' as any);
      expect(result.success).toBe(false);
    });

    it('resolves a report with a valid status', async () => {
      mockSingle.mockImplementationOnce(async () => ({
        data: { id: 'report-1', status: 'resolved', resolved_by: 'admin-1' },
        error: null,
      }));

      const result = await resolveReport('report-1', 'admin-1', 'resolved', 'handled');
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('resolved');

      // The real auditLog.service.record() ran against the same mocked
      // supabase client — confirm it inserted a matching audit entry.
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'admin-1',
          action: 'report.resolved',
          target_type: 'report',
          target_id: 'report-1',
          metadata: { resolutionNote: 'handled' },
        }),
      );
    });

    it('returns not found when no report matches', async () => {
      mockSingle.mockImplementationOnce(async () => ({ data: null, error: null }));

      const result = await resolveReport('missing', 'admin-1', 'dismissed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Report not found');
    });
  });

  describe('listReports', () => {
    it('returns an empty list when there are no reports', async () => {
      const result = await listReports();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
