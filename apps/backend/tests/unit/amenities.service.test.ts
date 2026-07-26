import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CANONICAL_AMENITIES } from '../../src/types/amenities.js';

// ── Supabase + cache mock ─────────────────────────────────────────────────────

const mockFrom = mock((_: string) => ({}));
const mockSupabase = { from: mockFrom };
const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

const cacheMod = await import('../../src/services/cache.service.js');
(cacheMod as any).get = mock(async () => null);
(cacheMod as any).set = mock(async () => {});
(cacheMod as any).del = mock(async () => {});

import { createProperty, updateProperty, searchProperties } from '../../src/services/property.service.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('amenities', () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  // ── canonical list ──────────────────────────────────────────────────────────

  describe('CANONICAL_AMENITIES', () => {
    it('contains expected amenities', () => {
      expect(CANONICAL_AMENITIES).toContain('wifi');
      expect(CANONICAL_AMENITIES).toContain('pool');
      expect(CANONICAL_AMENITIES).toContain('pet_friendly');
    });
  });

  // ── createProperty amenity validation ──────────────────────────────────────

  describe('createProperty – amenity validation', () => {
    it('rejects an unknown amenity', async () => {
      const result = await createProperty({ title: 'Test', amenities: ['jacuzzi'] as any });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown amenities/);
      expect(result.error).toMatch(/jacuzzi/);
    });

    it('rejects a mix of valid and invalid amenities', async () => {
      const result = await createProperty({
        title: 'Test',
        amenities: ['wifi', 'hot_tube'] as any,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/hot_tube/);
    });

    it('accepts all canonical amenities', async () => {
      mockFrom.mockImplementation(() => ({
        insert: mock(() => ({
          select: mock(() => ({
            single: mock(async () => ({
              data: { id: 'p1', title: 'Test', amenities: CANONICAL_AMENITIES },
              error: null,
            })),
          })),
        })),
      }));

      const result = await createProperty({
        title: 'Test',
        amenities: [...CANONICAL_AMENITIES],
      });
      expect(result.success).toBe(true);
    });

    it('accepts an empty amenities array', async () => {
      mockFrom.mockImplementation(() => ({
        insert: mock(() => ({
          select: mock(() => ({
            single: mock(async () => ({
              data: { id: 'p1', title: 'Test', amenities: [] },
              error: null,
            })),
          })),
        })),
      }));

      const result = await createProperty({ title: 'Test', amenities: [] });
      expect(result.success).toBe(true);
    });
  });

  // ── updateProperty amenity validation ──────────────────────────────────────

  describe('updateProperty – amenity validation', () => {
    it('rejects an unknown amenity on update', async () => {
      const result = await updateProperty('p1', { amenities: ['rooftop'] as any });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unknown amenities/);
    });

    it('accepts a valid amenity update', async () => {
      mockFrom.mockImplementation(() => ({
        update: mock(() => ({
          eq: mock(() => ({
            select: mock(() => ({
              single: mock(async () => ({
                data: { id: 'p1', title: 'Test', amenities: ['wifi', 'pool'] },
                error: null,
              })),
            })),
          })),
        })),
      }));

      const result = await updateProperty('p1', { amenities: ['wifi', 'pool'] });
      expect(result.success).toBe(true);
    });
  });

  // ── multi-amenity filtering (searchProperties) ─────────────────────────────

  describe('searchProperties – amenity filter', () => {
    it('returns properties containing all required amenities', async () => {
      const matching = [
        { id: 'p1', title: 'Villa', amenities: ['wifi', 'pool', 'gym'] },
      ];

      mockFrom.mockImplementation(() => ({
        select: mock(() => ({
          contains: mock(() => ({
            order: mock(async () => ({ data: matching, error: null })),
          })),
        })),
      }));

      const result = await searchProperties({ amenities: ['wifi', 'pool'] } as any);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(matching);
    });
  });
});
