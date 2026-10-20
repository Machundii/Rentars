import { connectRedis, redisClient } from '@/config/redis.js';
import {
  REDIS_KEY_PREFIX,
  boundedTtl,
  assertValueSize,
} from '@/config/redisKeys.js';
import { incCounter, cacheOperationsTotal } from '@/middleware/metrics.middleware.js';

/**
 * All cache keys are namespaced under `<env>:<service>:cache:` so keys cannot
 * collide across environments/services sharing a Redis instance.
 */
function namespaced(key: string): string {
  return `${REDIS_KEY_PREFIX}:cache:${key}`;
}

/**
 * Occupancy semantics used when building occupancy-aware cache keys.
 * Adults and children are tracked separately so a quote for 2 adults + 1 child
 * is never served for 3 adults (fees and capacity differ).
 */
export interface OccupancyKeyParts {
  adults: number;
  children?: number;
  infants?: number;
}

/**
 * Build a stable, collision-resistant hash fragment for an occupancy.
 * Values are normalised to non-negative integers so that `2`, `2.0`, and
 * `"2"`-like inputs map to the same key, while distinct guest counts never do.
 *
 * @param occupancy - Guest counts to encode
 * @returns A short deterministic string, e.g. `a2-c1-i0`
 * @example
 * occupancyHash({ adults: 2, children: 1 }); // 'a2-c1-i0'
 */
export function occupancyHash(occupancy: OccupancyKeyParts): string {
  const norm = (value: number | undefined): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.trunc(value));
  };
  return `a${norm(occupancy.adults)}-c${norm(occupancy.children)}-i${norm(occupancy.infants)}`;
}

/**
 * Build an occupancy-aware cache key so quotes and search results are keyed by
 * guest count and cannot be reused across different occupancies.
 *
 * @param namespace - Logical cache domain, e.g. `quote` or `search`
 * @param parts - Key segments (property id, date range, filters, ...)
 * @param occupancy - Guest counts that affect eligibility and price
 * @returns A namespaced cache key including the occupancy hash
 * @example
 * buildOccupancyKey('quote', ['prop_1', '2025-01-01:2025-01-05'], { adults: 2 });
 * // 'quote:prop_1:2025-01-01:2025-01-05:occ:a2-c0-i0'
 */
export function buildOccupancyKey(
  namespace: string,
  parts: ReadonlyArray<string | number>,
  occupancy: OccupancyKeyParts,
): string {
  const segments = [namespace, ...parts.map((part) => String(part)), 'occ', occupancyHash(occupancy)];
  return segments.join(':');
}

async function ensureConnected(): Promise<void> {
  try {
    await connectRedis();
  } catch {
    // Redis unavailable — cache operations will be no-ops
  }
}

/**
 * Retrieve a cached value by key.
 *
 * @template T - Expected type of the cached value
 * @param key - Cache key
 * @returns The cached value, or null if not found or Redis is unavailable
 * @example
 * const properties = await cache.get<Property[]>('properties:all');
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    await ensureConnected();
    const value = await redisClient.get(namespaced(key));
    // Use strict null check: Redis returns null for missing keys.
    // A stored value of 0, false, or "" serialises to a non-null string and must
    // not be discarded by JavaScript's falsy coercion.
    if (value === null || value === undefined) {
      incCounter(cacheOperationsTotal, { result: 'miss', domain: 'cache' });
      return null;
    }
    incCounter(cacheOperationsTotal, { result: 'hit', domain: 'cache' });
    return JSON.parse(value) as T;
  } catch {
    incCounter(cacheOperationsTotal, { result: 'error', domain: 'cache' });
    return null;
  }
}

/**
 * Store a value in the cache with a TTL.
 *
 * @param key - Cache key
 * @param value - Value to cache (must be JSON-serialisable)
 * @param ttlSeconds - Seconds until the key expires
 * @example
 * await cache.set('properties:all', properties, 60);
 */
export async function set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  // Guard: Redis EX requires a finite positive integer. Zero, negative, fractional,
  // and infinite values would either be rejected by Redis or silently discard data.
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || !Number.isInteger(ttlSeconds)) {
    throw new Error(
      `cache.set: ttlSeconds must be a finite positive integer, got ${ttlSeconds}`,
    );
  }
  try {
    await ensureConnected();
    const payload = JSON.stringify(value);
    assertValueSize(payload);
    await redisClient.set(namespaced(key), payload, { EX: boundedTtl(ttlSeconds) });
  } catch {
    // Cache miss is non-fatal
  }
}

/**
 * Delete a single key from the cache.
 *
 * @param key - Cache key to remove
 */
export async function del(key: string): Promise<void> {
  try {
    await ensureConnected();
    await redisClient.del(namespaced(key));
  } catch {
    // Ignore
  }
}

/**
 * Delete all keys matching a glob pattern.
 * Useful for bulk cache invalidation (e.g., `properties:*`).
 *
 * @param pattern - Redis KEYS glob pattern
 * @example
 * await cache.invalidatePattern('property:*');
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    await ensureConnected();
    const rawKeys = await redisClient.keys(namespaced(pattern));
    // Normalise to an empty array in case the client returns null/undefined
    // on a temporary response anomaly, preventing a runtime exception.
    const keys: string[] = Array.isArray(rawKeys) ? rawKeys : [];
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch {
    // Ignore
  }
}
