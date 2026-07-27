/**
 * Unit tests for pricing service.
 */

import { describe, it, expect, mock } from 'bun:test';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSingle = mock(async () => ({ data: null, error: null }));

const mockSupabase = {
  from: mock((_: string) => ({
    select: mock(() => ({
      eq: mock(() => ({
        lte: mock(() => ({
          gte: mock(async () => ({ data: [], error: null })),
        })),
        single: mockSingle,
      })),
      single: mockSingle,
    })),
    insert: mock(() => ({ select: () => ({ single: mockSingle }) })),
    delete: mock(() => ({ eq: mock(() => ({ eq: mock(async () => ({ error: null })) })) })),
  })),
};

const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

import {
  createSeasonalPricing,
  createSpecialEvent,
  previewPricing,
  calculateRangePrice,
  getPropertyQuote,
} from '../../src/services/pricing.service.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('pricing.service', () => {
  // ── Rule validation ──────────────────────────────────────────────────────────

  describe('createSeasonalPricing — rule validation', () => {
    it('should reject price_multiplier below 0.1', async () => {
      const result = await createSeasonalPricing('prop-1', 'owner-1', {
        name: 'Winter',
        start_date: '2026-12-01',
        end_date: '2027-01-01',
        price_multiplier: 0.05,
        id: '',
        property_id: 'prop-1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('price_multiplier');
    });

    it('should reject price_multiplier above 10', async () => {
      const result = await createSeasonalPricing('prop-1', 'owner-1', {
        name: 'Peak',
        start_date: '2026-07-01',
        end_date: '2026-08-01',
        price_multiplier: 15,
        id: '',
        property_id: 'prop-1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('price_multiplier');
    });

    it('should reject when start_date is not before end_date', async () => {
      const result = await createSeasonalPricing('prop-1', 'owner-1', {
        name: 'Bad dates',
        start_date: '2026-08-01',
        end_date: '2026-07-01',
        price_multiplier: 1.2,
        id: '',
        property_id: 'prop-1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('start_date must be before end_date');
    });

    it('should reject equal start and end dates', async () => {
      const result = await createSeasonalPricing('prop-1', 'owner-1', {
        name: 'Same day',
        start_date: '2026-08-01',
        end_date: '2026-08-01',
        price_multiplier: 1.5,
        id: '',
        property_id: 'prop-1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('start_date must be before end_date');
    });
  });

  describe('createSpecialEvent — rule validation', () => {
    it('should reject price_multiplier above 10', async () => {
      const result = await createSpecialEvent('prop-1', 'owner-1', {
        name: 'Festival',
        start_date: '2026-09-01',
        end_date: '2026-09-07',
        price_multiplier: 20,
        is_blocked: false,
        id: '',
        property_id: 'prop-1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('price_multiplier');
    });

    it('should reject when start_date is not before end_date', async () => {
      const result = await createSpecialEvent('prop-1', 'owner-1', {
        name: 'Bad event',
        start_date: '2026-09-10',
        end_date: '2026-09-01',
        is_blocked: true,
        id: '',
        property_id: 'prop-1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('start_date must be before end_date');
    });
  });

  // ── calculateRangePrice ──────────────────────────────────────────────────────

  describe('calculateRangePrice', () => {
    it('should return per-day prices applying the seasonal multiplier', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { base_price_per_night: 100 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'seasonal_pricing') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({
                    data: [
                      {
                        start_date: '2026-08-01',
                        end_date: '2026-08-31',
                        price_multiplier: 1.5,
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'special_events') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await calculateRangePrice('prop-1', '2026-08-01', '2026-08-03');
      expect(result.success).toBe(true);
      // 2 nights × 100 × 1.5 = 300
      expect(result.data!.total).toBe(300);
      expect(result.data!.breakdown).toHaveLength(2);
      expect(result.data!.breakdown[0].price).toBe(150);
    });

    it('should mark blocked dates as unavailable', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { base_price_per_night: 100 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'seasonal_pricing') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        if (table === 'special_events') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({
                    data: [
                      {
                        name: 'Maintenance',
                        start_date: '2026-08-01',
                        end_date: '2026-08-03',
                        is_blocked: true,
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await calculateRangePrice('prop-1', '2026-08-01', '2026-08-03');
      expect(result.success).toBe(true);
      expect(result.data!.breakdown.every((d) => !d.is_available)).toBe(true);
      expect(result.data!.total).toBe(0);
    });
  });

  // ── previewPricing ───────────────────────────────────────────────────────────

  describe('previewPricing', () => {
    it('should cap prices to MAX_NIGHTLY_PRICE', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { base_price_per_night: 5000 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'seasonal_pricing') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({
                    data: [
                      {
                        start_date: '2026-09-01',
                        end_date: '2026-09-30',
                        price_multiplier: 3,
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'special_events') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await previewPricing('prop-1', '2026-09-01', '2026-09-02');
      expect(result.success).toBe(true);
      // 5000 × 3 = 15000, capped to 10000
      expect(result.data!.breakdown[0].price).toBe(10000);
    });

    it('should raise prices to MIN_NIGHTLY_PRICE', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { base_price_per_night: 10 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'seasonal_pricing') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({
                    data: [
                      {
                        start_date: '2026-09-01',
                        end_date: '2026-09-30',
                        price_multiplier: 0.05,
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'special_events') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await previewPricing('prop-1', '2026-09-01', '2026-09-02');
      expect(result.success).toBe(true);
      // 10 × 0.05 = 0.5, raised to MIN_NIGHTLY_PRICE = 1
      expect(result.data!.breakdown[0].price).toBe(1);
    });
  });

  // ── getPropertyQuote ─────────────────────────────────────────────────────────

  describe('getPropertyQuote', () => {
    it('should return correct breakdown math with platform fee', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { base_price_per_night: 100 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'seasonal_pricing') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        if (table === 'special_events') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await getPropertyQuote('prop-1', '2026-08-01', '2026-08-04');
      expect(result.success).toBe(true);
      const q = result.data!;
      // 3 nights × $100 base = $300 subtotal, no dynamic adj, 5% fee = $15, total = $315
      expect(q.nights).toBe(3);
      expect(q.base_nightly_rate).toBe(100);
      expect(q.subtotal).toBe(300);
      expect(q.dynamic_adjustments).toBe(0);
      expect(q.platform_fee_pct).toBe(0.05);
      expect(q.platform_fee).toBe(15);
      expect(q.total).toBe(315);
    });

    it('total equals dynamic_total + platform_fee', async () => {
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                single: mock(async () => ({
                  data: { base_price_per_night: 200 },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'seasonal_pricing') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({
                    data: [
                      {
                        start_date: '2026-10-01',
                        end_date: '2026-10-31',
                        price_multiplier: 1.25,
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'special_events') {
          return {
            select: mock(() => ({
              eq: mock(() => ({
                lte: mock(() => ({
                  gte: mock(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await getPropertyQuote('prop-1', '2026-10-01', '2026-10-03');
      expect(result.success).toBe(true);
      const q = result.data!;
      // 2 nights × 200 × 1.25 = 500 dynamic total; 5% fee = 25; total = 525
      const expectedDynamicTotal = 500;
      const expectedFee = Math.round(expectedDynamicTotal * 0.05 * 100) / 100;
      expect(q.platform_fee).toBe(expectedFee);
      expect(q.total).toBe(Math.round((expectedDynamicTotal + expectedFee) * 100) / 100);
    });
  });
});
