import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockRpc = mock(async () => ({ data: null, error: null }));
const mockFrom = mock((_: string) => ({}));

const mockSupabase = { rpc: mockRpc, from: mockFrom };
const supabaseMod = await import('../../src/config/supabase.js');
(supabaseMod as any).supabase = mockSupabase;

import { searchPropertiesNearby } from '../../src/services/propertySearch.service.js';

// ─────────────────────────────────────────────────────────────────────────────

const BASE_RESULT = {
  id: 'p1',
  title: 'Beach House',
  price_per_night: 120,
  city: 'Miami',
  country: 'US',
  bedrooms: 2,
  amenities: ['wifi', 'pool'],
};

describe('searchPropertiesNearby', () => {
  beforeEach(() => {
    mockRpc.mockClear();
  });

  it('returns properties within the radius ordered by distance', async () => {
    const nearby = [
      { ...BASE_RESULT, id: 'p1', distance_km: 3 },
      { ...BASE_RESULT, id: 'p2', distance_km: 8 },
    ];
    mockRpc.mockImplementation(async () => ({ data: nearby, error: null }));

    const result = await searchPropertiesNearby({ lat: 25.77, lng: -80.19, radiusKm: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].distance_km).toBeLessThan(result.data![1].distance_km);
  });

  it('excludes properties outside the radius', async () => {
    // DB function already filters; service returns only what the RPC gives back
    const insideBoundary = [{ ...BASE_RESULT, id: 'p1', distance_km: 9.9 }];
    mockRpc.mockImplementation(async () => ({ data: insideBoundary, error: null }));

    const result = await searchPropertiesNearby({ lat: 25.77, lng: -80.19, radiusKm: 10 });

    expect(result.success).toBe(true);
    expect(result.data!.every((p) => p.distance_km <= 10)).toBe(true);
  });

  it('returns empty array when no properties are within the radius', async () => {
    mockRpc.mockImplementation(async () => ({ data: [], error: null }));

    const result = await searchPropertiesNearby({ lat: 0, lng: 0, radiusKm: 1 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('returns distance_km with each result', async () => {
    const nearby = [{ ...BASE_RESULT, id: 'p1', distance_km: 5.2 }];
    mockRpc.mockImplementation(async () => ({ data: nearby, error: null }));

    const result = await searchPropertiesNearby({ lat: 25.77, lng: -80.19, radiusKm: 20 });

    expect(result.success).toBe(true);
    expect(typeof result.data![0].distance_km).toBe('number');
  });

  it('forwards rpc error as failure', async () => {
    mockRpc.mockImplementation(async () => ({
      data: null,
      error: { message: 'PostGIS unavailable' },
    }));

    const result = await searchPropertiesNearby({ lat: 25.77, lng: -80.19, radiusKm: 10 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('PostGIS unavailable');
  });

  it('calls the search_nearby_properties rpc with correct params', async () => {
    mockRpc.mockImplementation(async () => ({ data: [], error: null }));

    await searchPropertiesNearby({ lat: 48.85, lng: 2.35, radiusKm: 25 });

    expect(mockRpc).toHaveBeenCalledWith('search_nearby_properties', {
      lat: 48.85,
      lng: 2.35,
      radius_km: 25,
    });
  });
});
