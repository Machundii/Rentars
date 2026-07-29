/**
 * Unit tests for review moderation audit logging (#66/#281).
 * Confirms approveReview/rejectReview/moderateReview record an audit entry
 * with the acting moderator's id when an actorId is supplied.
 *
 * auditLog.service.js is intentionally left unmocked: it shares the same
 * mocked supabase client below (table-agnostic mock), so the real record()
 * runs and shows up as an extra mockInsert call. This avoids mock.module
 * colliding with auditLog.service.test.ts, which needs the real module (bun
 * runs all test files in one process without --isolate).
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockReviewSingle = mock(async () => ({
  data: { id: 'review-1', moderation_status: 'approved' },
  error: null,
}));
const mockEq = mock(() => ({ select: () => ({ single: mockReviewSingle }) }));
const mockUpdate = mock(() => ({ eq: mockEq }));

const mockAuditSingle = mock(async () => ({ data: null, error: null }));
const mockInsert = mock(() => ({ select: () => ({ single: mockAuditSingle }) }));

const mockSupabase = {
  from: mock((_: string) => ({ update: mockUpdate, insert: mockInsert })),
};

mock.module('../../src/config/supabase.js', () => ({ supabase: mockSupabase }));

const { approveReview, rejectReview, moderateReview } = await import(
  '../../src/services/review.service.js'
);

describe('review.service moderation — audit logging', () => {
  beforeEach(() => {
    mockInsert.mockClear();
  });

  it('approveReview records an audit entry when an actorId is given', async () => {
    await approveReview('review-1', 'admin-1');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'admin-1',
        action: 'review.approve',
        target_type: 'review',
        target_id: 'review-1',
      }),
    );
  });

  it('approveReview skips audit logging when no actorId is given', async () => {
    await approveReview('review-1');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejectReview records an audit entry with the rejection reason', async () => {
    await rejectReview('review-1', 'spam content', 'admin-1');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'admin-1',
        action: 'review.reject',
        target_type: 'review',
        target_id: 'review-1',
        metadata: { reason: 'spam content' },
      }),
    );
  });

  it('moderateReview(approve=true) threads actorId through to approveReview', async () => {
    await moderateReview('review-1', true, 'admin-2');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'admin-2', action: 'review.approve' }),
    );
  });

  it('moderateReview(approve=false) threads actorId through to rejectReview', async () => {
    await moderateReview('review-1', false, 'admin-2');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'admin-2',
        action: 'review.reject',
        metadata: { reason: 'Rejected by moderator' },
      }),
    );
  });
});
