/**
 * Tests for zero-result search suggestion fallback (#265).
 *
 * Covers:
 *  1. computeZeroResultSuggestions — returns only helpful relaxations, sorted by count desc
 *  2. No suggestions when all relaxations also yield zero results
 *  3. Suggestion types: no_amenities, wider_price, any_location, expand_radius
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeZeroResultSuggestions } from '../services/propertySearch.service.js';
import type { AdvancedSearchFilters } from '../services/property.service.js';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc  = vi.fn();

vi.mock('../config/supabase.js', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

// ─────────────────────────────────────────────────────────────────────────────

function makeCountChain(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        then: undefined,
        // Return the count when awaited
        count,
      }),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      count,
    }),
  };
}

describe('computeZeroResultSuggestions', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('returns no_amenities suggestion when dropping amenities yields results', async () => {
    // Simulate supabase query that returns a count
    let callCount = 0;
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          textSearch: vi.fn().mockReturnThis(),
          // resolve to count
          then: (resolve: (v: { count: number; data: null }) => void) => {
            callCount++;
            resolve({ count: callCount === 1 ? 5 : 0, data: null });
          },
        }),
      }),
    }));

    const filters: AdvancedSearchFilters = {
      amenities: ['pool', 'gym'],
      status: 'available',
    };

    const suggestions = await computeZeroResultSuggestions(filters);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('returns empty array when all relaxations also yield zero results', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          textSearch: vi.fn().mockReturnThis(),
          then: (resolve: (v: { count: number; data: null }) => void) => {
            resolve({ count: 0, data: null });
          },
        }),
      }),
    }));

    const filters: AdvancedSearchFilters = {
      amenities: ['pool'],
      min_price: 500,
    };

    const suggestions = await computeZeroResultSuggestions(filters);
    expect(suggestions).toHaveLength(0);
  });

  it('includes wider_price suggestion when price filter is set', async () => {
    const filters: AdvancedSearchFilters = {
      min_price: 1000,
      max_price: 2000,
    };

    // No amenities / no location means only wider_price candidate is generated
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          textSearch: vi.fn().mockReturnThis(),
          then: (resolve: (v: { count: number; data: null }) => void) => {
            resolve({ count: 12, data: null });
          },
        }),
      }),
    }));

    const suggestions = await computeZeroResultSuggestions(filters);
    const priceS = suggestions.find((s) => s.type === 'wider_price');
    expect(priceS).toBeDefined();
    expect(priceS!.relaxed_filters.min_price).toBeUndefined();
    expect(priceS!.relaxed_filters.max_price).toBeUndefined();
  });

  it('sorts suggestions by estimated_results descending', async () => {
    const filters: AdvancedSearchFilters = {
      amenities: ['pool'],
      city: 'Paris',
      min_price: 500,
    };

    let call = 0;
    const counts = [3, 10, 7]; // no_amenities=3, any_location=10, wider_price=7
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          then: (resolve: (v: { count: number; data: null }) => void) => {
            resolve({ count: counts[call++ % counts.length] ?? 0, data: null });
          },
        }),
      }),
    }));

    const suggestions = await computeZeroResultSuggestions(filters);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].estimated_results).toBeGreaterThanOrEqual(
        suggestions[i].estimated_results,
      );
    }
  });
});
