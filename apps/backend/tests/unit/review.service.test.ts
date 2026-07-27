/**
 * Unit tests for review service.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

const PAST_CHECKOUT = '2024-01-01';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSingle = mock(async () => ({ data: null, error: null }));
const mockSelect = mock(() => ({ eq: mockEq, single: mockSingle }));
const mockEq2 = mock(() => ({ single: mockSingle }));
const mockEq = mock(() => ({ eq: mockEq2, single: mockSingle }));
const mockInsert = mock(() => ({ select: () => ({ single: mockSingle }) }));

const mockSupabase = {
  from: mock((_: string) => ({
    select: mockSelect,
    insert: mockInsert,
  })),
};

// Stub the supabase module
const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

import {
  submitReview,
  getReviewsForProperty,
  getReviewsForUser,
  getAverageRating,
  addHostResponse,
} from '../../src/services/review.service.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('review.service', () => {
  beforeEach(() => {
    mockSingle.mockClear();
    mockInsert.mockClear();
    (mockSupabase.from as any).mockClear?.();
  });

  // ── submitReview ────────────────────────────────────────────────────────────

  describe('submitReview', () => {
    it('should reject rating below 1', async () => {
      const result = await submitReview('b1', 'u1', 'u2', 0, 'ok');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rating must be between 1 and 5');
    });

    it('should reject rating above 5', async () => {
      const result = await submitReview('b1', 'u1', 'u2', 6, 'ok');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rating must be between 1 and 5');
    });

    it('should return error when booking is not owned by reviewer', async () => {
      (mockSupabase.from as any).mockImplementation((_: string) => ({
        select: mock(() => ({
          eq: mock(() => ({
            eq: mock(() => ({
              single: mock(async () => ({ data: null, error: { message: 'Not found' } })),
            })),
          })),
        })),
        insert: mockInsert,
      }));

      const result = await submitReview('b-not-owned', 'reviewer-1', 'target-1', 4, 'Great!');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Booking not found');
    });

    it('should create a review when booking is valid', async () => {
      const mockReview = {
        id: 'rev-1',
        booking_id: 'b1',
        reviewer_id: 'u1',
        target_id: 'u2',
        rating: 5,
        comment: 'Excellent!',
        created_at: '2026-06-01T00:00:00Z',
      };

      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'bookings') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                eq: mock(() => ({
                  single: mock(async () => ({
                    data: { id: 'b1', status: 'Completed', check_out: PAST_CHECKOUT },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {
          insert: mock(() => ({
            select: mock(() => ({
              single: mock(async () => ({ data: mockReview, error: null })),
            })),
          })),
        };
      });

      const result = await submitReview('b1', 'u1', 'u2', 5, 'Excellent!');
      expect(result.success).toBe(true);
      expect(result.data?.rating).toBe(5);
    });

    it('should propagate insert error from Supabase', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'bookings') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                eq: mock(() => ({
                  single: mock(async () => ({
                    data: { id: 'b1', status: 'Completed', check_out: PAST_CHECKOUT },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {
          insert: mock(() => ({
            select: mock(() => ({
              single: mock(async () => ({
                data: null,
                error: { message: 'Duplicate review' },
              })),
            })),
          })),
        };
      });

      const result = await submitReview('b1', 'u1', 'u2', 4, 'Good');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Duplicate review');
    });

    it('should reject review when booking is not completed', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            eq: mock(() => ({
              single: mock(async () => ({
                data: { id: 'b1', status: 'Confirmed', check_out: PAST_CHECKOUT },
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await submitReview('b1', 'u1', 'u2', 4, 'Good');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only review after the stay is completed');
    });

    it('should reject review when booking is cancelled', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            eq: mock(() => ({
              single: mock(async () => ({
                data: { id: 'b1', status: 'Cancelled', check_out: PAST_CHECKOUT },
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await submitReview('b1', 'u1', 'u2', 4, 'Good');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot review a cancelled booking');
    });

    it('should reject review when checkout date has not passed', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            eq: mock(() => ({
              single: mock(async () => ({
                data: { id: 'b1', status: 'Completed', check_out: futureDateStr },
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await submitReview('b1', 'u1', 'u2', 4, 'Good');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot review before the checkout date has passed');
    });
  });

  // ── getReviewsForProperty ───────────────────────────────────────────────────

  describe('getReviewsForProperty', () => {
    it('should return reviews list', async () => {
      const reviews = [{ id: 'r1', property_id: 'p1', rating: 5 }];

      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(async () => ({ data: reviews, error: null })),
          })),
        })),
      }));

      const result = await getReviewsForProperty('p1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return empty array when no reviews exist', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(async () => ({ data: null, error: null })),
          })),
        })),
      }));

      const result = await getReviewsForProperty('p-no-reviews');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return error on database failure', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(async () => ({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      }));

      const result = await getReviewsForProperty('p1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  // ── getReviewsForUser ───────────────────────────────────────────────────────

  describe('getReviewsForUser', () => {
    it('should return reviews for user', async () => {
      const reviews = [{ id: 'r1', target_id: 'u1', rating: 4 }];

      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(() => ({
            order: mock(async () => ({ data: reviews, error: null })),
          })),
        })),
      }));

      const result = await getReviewsForUser('u1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── addHostResponse ─────────────────────────────────────────────────────────

  describe('addHostResponse', () => {
    it('should allow owner to create a response', async () => {
      const mockUpdated = {
        id: 'rev-1',
        host_response: 'Thank you!',
        host_response_at: '2026-07-01T00:00:00Z',
      };

      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { id: 'rev-1', target_id: 'host-1', property_id: 'prop-1' },
                  error: null,
                })),
              })),
            })),
            update: mock(() => ({
              eq: mock(() => ({
                select: mock(() => ({
                  single: mock(async () => ({ data: mockUpdated, error: null })),
                })),
              })),
            })),
          };
        }
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { owner_id: 'host-1' },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await addHostResponse('rev-1', 'host-1', 'Thank you!');
      expect(result.success).toBe(true);
      expect(result.data?.host_response).toBe('Thank you!');
    });

    it('should allow owner to edit an existing response (upsert)', async () => {
      const mockUpdated = {
        id: 'rev-1',
        host_response: 'Updated response',
        host_response_at: '2026-07-02T00:00:00Z',
      };

      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { id: 'rev-1', target_id: 'host-1', property_id: 'prop-1' },
                  error: null,
                })),
              })),
            })),
            update: mock(() => ({
              eq: mock(() => ({
                select: mock(() => ({
                  single: mock(async () => ({ data: mockUpdated, error: null })),
                })),
              })),
            })),
          };
        }
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { owner_id: 'host-1' },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await addHostResponse('rev-1', 'host-1', 'Updated response');
      expect(result.success).toBe(true);
      expect(result.data?.host_response).toBe('Updated response');
    });

    it('should block non-owner with an ownership error', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'reviews') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { id: 'rev-1', target_id: 'host-1', property_id: 'prop-1' },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { owner_id: 'different-host' },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await addHostResponse('rev-1', 'intruder', 'Sneaky response');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Only the property owner');
    });

    it('should reject a response that exceeds 1000 characters', async () => {
      const tooLong = 'x'.repeat(1001);
      const result = await addHostResponse('rev-1', 'host-1', tooLong);
      expect(result.success).toBe(false);
      expect(result.error).toContain('1000 characters');
    });
  });

  // ── getAverageRating ────────────────────────────────────────────────────────

  describe('getAverageRating', () => {
    it('should compute average correctly', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(async () => ({
            data: [{ rating: 4 }, { rating: 5 }, { rating: 3 }],
            error: null,
          })),
        })),
      }));

      const result = await getAverageRating('u1');
      expect(result.success).toBe(true);
      expect(result.data).toBe(4); // (4+5+3)/3 = 4.0
    });

    it('should return 0 when no reviews', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(async () => ({ data: [], error: null })),
        })),
      }));

      const result = await getAverageRating('u1');
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should return error on DB failure', async () => {
      (mockSupabase.from as any).mockImplementation(() => ({
        select: mock(() => ({
          eq: mock(async () => ({ data: null, error: { message: 'Query failed' } })),
        })),
      }));

      const result = await getAverageRating('u1');
      expect(result.success).toBe(false);
    });
  });
});
