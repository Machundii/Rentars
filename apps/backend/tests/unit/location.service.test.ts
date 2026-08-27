import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { LocationService } from '../../src/services/location.service.js';
import * as cache from '../../src/services/cache.service.js';
import * as supabaseMod from '../../src/config/supabase.js';

const mockCacheGet = mock(async <T>(_key: string): Promise<T | null> => null);
const mockCacheSet = mock(async (_key: string, _value: unknown, _ttlSeconds: number) => {});
const mockCacheDel = mock(async (_key: string) => {});

(cache as any).get = mockCacheGet;
(cache as any).set = mockCacheSet;
(cache as any).del = mockCacheDel;

const mockFetch = mock(async (_url: string) => {
  return new Response(JSON.stringify([{ lat: '40.7128', lon: '-74.0060', display_name: 'New York, NY' }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

(global as any).fetch = mockFetch;

// ─── Supabase mock (used by searchNearby) ────────────────────────────────────

const mockRpc = mock(async () => ({ data: [], error: null }));
(supabaseMod as any).supabase = { rpc: mockRpc };

// ─── LocationService.searchNearby — coordinate validation ────────────────────

describe('LocationService.searchNearby coordinate validation', () => {
  const service = new LocationService();

  it('rejects NaN latitude', async () => {
    const result = await service.searchNearby(NaN, 0, 10);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects NaN longitude', async () => {
    const result = await service.searchNearby(0, NaN, 10);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects Infinity latitude', async () => {
    const result = await service.searchNearby(Infinity, 0, 10);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects Infinity longitude', async () => {
    const result = await service.searchNearby(0, Infinity, 10);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects latitude 91 (out of range)', async () => {
    const result = await service.searchNearby(91, 0, 10);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/latitude/i);
    expect(result.statusCode).toBe(400);
  });

  it('rejects longitude 181 (out of range)', async () => {
    const result = await service.searchNearby(0, 181, 10);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/longitude/i);
    expect(result.statusCode).toBe(400);
  });

  it('accepts valid zero coordinates (0, 0)', async () => {
    const result = await service.searchNearby(0, 0, 10);
    expect(result.statusCode).not.toBe(400);
  });

  it('accepts boundary latitudes -90 and 90', async () => {
    const r1 = await service.searchNearby(-90, 0, 10);
    expect(r1.statusCode).not.toBe(400);
    const r2 = await service.searchNearby(90, 0, 10);
    expect(r2.statusCode).not.toBe(400);
  });

  it('accepts boundary longitudes -180 and 180', async () => {
    const r1 = await service.searchNearby(0, -180, 10);
    expect(r1.statusCode).not.toBe(400);
    const r2 = await service.searchNearby(0, 180, 10);
    expect(r2.statusCode).not.toBe(400);
  });
});

// ─── LocationService geocode caching ─────────────────────────────────────────

describe('LocationService geocode caching', () => {
  beforeEach(() => {
    mockCacheGet.mockClear();
    mockCacheSet.mockClear();
    mockFetch.mockClear();
  });

  it('caches geocode results on first call', async () => {
    const service = new LocationService();
    const result = await service.geocode('New York, NY');
    expect(result.success).toBe(true);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns cached result on second call', async () => {
    mockCacheGet.mockResolvedValueOnce({ latitude: 40.7128, longitude: -74.006, address: 'New York, NY' });
    const service = new LocationService();
    const result = await service.geocode('New York, NY');
    expect(result.success).toBe(true);
    expect(result.data?.address).toBe('New York, NY');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
