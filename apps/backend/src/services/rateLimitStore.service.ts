/**
 * Rate-limit rejection store.
 *
 * Records every rate-limit rejection with route, method, scope, hashed identity,
 * and a Unix timestamp.  Provides aggregated summary queries by route and time window.
 *
 * Storage strategy:
 * - With Redis: sorted sets keyed by scope+route for O(log N) range queries.
 * - Without Redis (in-memory fallback): a capped ring buffer per key.
 *
 * Privacy: raw IPs / userIds must be hashed BEFORE calling record().
 * The store never has access to un-hashed identities.
 */

import { redisClient } from '@/config/redis.js';

export interface RejectionRecord {
  route: string;
  method: string;
  scope: string;
  hashedIdentity: string;
  timestamp: number; // Unix ms
}

export interface RouteStats {
  route: string;
  method: string;
  scope: string;
  count: number;
}

export interface SummaryWindow {
  windowSeconds: number;
  since: string; // ISO timestamp
  byRoute: RouteStats[];
  total: number;
}

const REDIS_KEY_PREFIX = 'rl_reject';
/** Maximum age of records kept in Redis sorted sets (7 days in seconds). */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// ── In-memory fallback ────────────────────────────────────────────────────────

interface InMemoryBucket {
  records: RejectionRecord[];
}

const inMemoryStore = new Map<string, InMemoryBucket>();
/** Cap per route bucket to avoid unbounded growth. */
const MAX_IN_MEMORY_PER_KEY = 10_000;

// ─────────────────────────────────────────────────────────────────────────────

class RateLimitStoreService {
  private get useRedis(): boolean {
    return !!process.env.REDIS_URL;
  }

  /**
   * Record a single rate-limit rejection.
   * Called from the rate limiter middleware — must not throw.
   */
  async record(entry: RejectionRecord): Promise<void> {
    try {
      if (this.useRedis) {
        await this.recordRedis(entry);
      } else {
        this.recordMemory(entry);
      }
    } catch (err) {
      // Never crash the middleware — log and continue
      console.error('[RateLimitStore] record error:', err);
    }
  }

  /**
   * Return an aggregated summary of rejections over the given time window.
   * Results are sorted by count descending (hottest routes first).
   */
  async getSummary(windowSeconds = 3600): Promise<SummaryWindow> {
    try {
      if (this.useRedis) {
        return await this.getSummaryRedis(windowSeconds);
      }
      return this.getSummaryMemory(windowSeconds);
    } catch (err) {
      console.error('[RateLimitStore] getSummary error:', err);
      return {
        windowSeconds,
        since: new Date(Date.now() - windowSeconds * 1000).toISOString(),
        byRoute: [],
        total: 0,
      };
    }
  }

  // ── Redis implementation ────────────────────────────────────────────────────

  private redisKey(scope: string, route: string, method: string): string {
    // Sanitize route for use in a Redis key (replace slashes and special chars)
    const safeRoute = route.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${REDIS_KEY_PREFIX}:${scope}:${method}:${safeRoute}`;
  }

  private async recordRedis(entry: RejectionRecord): Promise<void> {
    const key = this.redisKey(entry.scope, entry.route, entry.method);
    const score = entry.timestamp;
    // Store as JSON member in a sorted set scored by timestamp
    const member = JSON.stringify({
      id: entry.hashedIdentity,
      ts: entry.timestamp,
    });

    await redisClient.zAdd(key, { score, value: member });

    // Trim entries older than MAX_AGE_SECONDS to bound storage
    const cutoff = Date.now() - MAX_AGE_SECONDS * 1000;
    await redisClient.zRemRangeByScore(key, 0, cutoff);

    // Set key TTL so Redis cleans up idle keys automatically
    await redisClient.expire(key, MAX_AGE_SECONDS);
  }

  private async getSummaryRedis(windowSeconds: number): Promise<SummaryWindow> {
    const since = Date.now() - windowSeconds * 1000;
    const pattern = `${REDIS_KEY_PREFIX}:*`;

    const keys: string[] = [];
    let cursor = 0;
    do {
      const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 200 });
      cursor = reply.cursor;
      keys.push(...reply.keys);
    } while (cursor !== 0);

    const byRoute: RouteStats[] = [];
    let total = 0;

    for (const key of keys) {
      const count = await redisClient.zCount(key, since, '+inf');
      if (count === 0) continue;

      // Parse scope, method, route from key: rl_reject:<scope>:<method>:<route>
      const parts = key.slice(REDIS_KEY_PREFIX.length + 1).split(':');
      const [scope, method, ...routeParts] = parts;
      const route = routeParts.join(':').replace(/_/g, '/');

      byRoute.push({ route, method, scope, count });
      total += count;
    }

    byRoute.sort((a, b) => b.count - a.count);

    return {
      windowSeconds,
      since: new Date(since).toISOString(),
      byRoute,
      total,
    };
  }

  // ── In-memory implementation ────────────────────────────────────────────────

  private bucketKey(entry: RejectionRecord): string {
    return `${entry.scope}:${entry.method}:${entry.route}`;
  }

  private recordMemory(entry: RejectionRecord): void {
    const key = this.bucketKey(entry);
    let bucket = inMemoryStore.get(key);
    if (!bucket) {
      bucket = { records: [] };
      inMemoryStore.set(key, bucket);
    }
    bucket.records.push(entry);
    // Cap to avoid unbounded growth
    if (bucket.records.length > MAX_IN_MEMORY_PER_KEY) {
      bucket.records.splice(0, bucket.records.length - MAX_IN_MEMORY_PER_KEY);
    }
  }

  private getSummaryMemory(windowSeconds: number): SummaryWindow {
    const since = Date.now() - windowSeconds * 1000;
    const byRoute: RouteStats[] = [];
    let total = 0;

    for (const [key, bucket] of inMemoryStore.entries()) {
      const count = bucket.records.filter((r) => r.timestamp >= since).length;
      if (count === 0) continue;

      const [scope, method, ...routeParts] = key.split(':');
      const route = routeParts.join(':');
      byRoute.push({ route, method, scope, count });
      total += count;
    }

    byRoute.sort((a, b) => b.count - a.count);

    return {
      windowSeconds,
      since: new Date(since).toISOString(),
      byRoute,
      total,
    };
  }

  /** Exposed for testing — clears the in-memory store. */
  _clearMemoryStore(): void {
    inMemoryStore.clear();
  }
}

export const rateLimitStore = new RateLimitStoreService();
