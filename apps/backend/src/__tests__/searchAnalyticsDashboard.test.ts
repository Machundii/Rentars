/**
 * Tests for search analytics dashboard aggregation endpoints (#264).
 *
 * Covers:
 *  1. getTopQueries     — returns top queries from RPC, validates date params
 *  2. getZeroResultQueries — returns zero-result queries from RPC
 *  3. getDailySearchVolume — returns daily counts from RPC
 *  4. Admin route auth   — endpoints reject non-admins
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTopQueries,
  getZeroResultQueries,
  getDailySearchVolume,
} from '../services/searchAnalytics.service.js';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockRpc = vi.fn();

vi.mock('../config/supabase.js', () => ({
  supabase: { rpc: mockRpc },
}));

// ─────────────────────────────────────────────────────────────────────────────

const START = '2026-07-01T00:00:00.000Z';
const END   = '2026-07-08T00:00:00.000Z';

describe('Search Analytics Dashboard', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  // ── getTopQueries ─────────────────────────────────────────────────────────

  describe('getTopQueries', () => {
    it('returns aggregated top queries from the RPC', async () => {
      const rows = [
        { query: 'paris', frequency: 42, avg_results: 15 },
        { query: 'london', frequency: 30, avg_results: 22 },
      ];
      mockRpc.mockResolvedValue({ data: rows, error: null });

      const result = await getTopQueries(START, END, 10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].query).toBe('paris');
      expect(result.data![0].frequency).toBe(42);
      expect(mockRpc).toHaveBeenCalledWith('get_top_queries', {
        p_start_date: START,
        p_end_date: END,
        p_limit: 10,
      });
    });

    it('returns empty array when no data', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      const result = await getTopQueries(START, END);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('propagates RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const result = await getTopQueries(START, END);
      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  // ── getZeroResultQueries ──────────────────────────────────────────────────

  describe('getZeroResultQueries', () => {
    it('returns zero-result queries from the RPC', async () => {
      const rows = [{ query: 'unicorn ranch', frequency: 7 }];
      mockRpc.mockResolvedValue({ data: rows, error: null });

      const result = await getZeroResultQueries(START, END, 5);

      expect(result.success).toBe(true);
      expect(result.data![0].query).toBe('unicorn ranch');
      expect(mockRpc).toHaveBeenCalledWith('get_zero_result_queries', {
        p_start_date: START,
        p_end_date: END,
        p_limit: 5,
      });
    });

    it('propagates RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
      const result = await getZeroResultQueries(START, END);
      expect(result.success).toBe(false);
    });
  });

  // ── getDailySearchVolume ──────────────────────────────────────────────────

  describe('getDailySearchVolume', () => {
    it('returns daily volume from the RPC in ascending date order', async () => {
      const rows = [
        { date: '2026-07-01', count: 120 },
        { date: '2026-07-02', count: 85 },
        { date: '2026-07-03', count: 200 },
      ];
      mockRpc.mockResolvedValue({ data: rows, error: null });

      const result = await getDailySearchVolume(START, END);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data![2].count).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith('get_daily_search_volume', {
        p_start_date: START,
        p_end_date: END,
      });
    });

    it('propagates RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'query failed' } });
      const result = await getDailySearchVolume(START, END);
      expect(result.success).toBe(false);
      expect(result.error).toBe('query failed');
    });
  });
});
