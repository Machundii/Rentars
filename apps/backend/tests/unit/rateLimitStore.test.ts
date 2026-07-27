/**
 * Unit tests for the rate-limit store service and the admin summary endpoint.
 * Uses bun:test — runs with `bun test`.
 *
 * All tests use the in-memory store path (REDIS_URL unset).
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';

// ── Ensure Redis is disabled so in-memory store is used ───────────────────────
process.env.REDIS_URL = '';

// ── Stub redis and logging before importing any services ──────────────────────
const redisMod = await import('../../src/config/redis.js');
(redisMod as any).redisClient = null;
(redisMod as any).connectRedis = mock(async () => {});

const loggingMod = await import('../../src/services/logging.service.js');
(loggingMod as any).loggingService = { logBlockchainOperation: mock(async () => {}) };

// ── Import the service under test ─────────────────────────────────────────────
const { rateLimitStore } = await import('../../src/services/rateLimitStore.service.js');
const { hashIdentity } = await import('../../src/middleware/rateLimiter.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<Parameters<typeof rateLimitStore.record>[0]> = {}) {
  return {
    route: '/api/v1/properties',
    method: 'GET',
    scope: 'general',
    hashedIdentity: hashIdentity('192.168.1.1'),
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// hashIdentity
// ─────────────────────────────────────────────────────────────────────────────
describe('hashIdentity', () => {
  it('returns a 16-char hex string', () => {
    const h = hashIdentity('127.0.0.1');
    expect(typeof h).toBe('string');
    expect(h).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it('is deterministic — same input produces same hash', () => {
    expect(hashIdentity('user-abc')).toBe(hashIdentity('user-abc'));
  });

  it('different inputs produce different hashes', () => {
    expect(hashIdentity('192.168.1.1')).not.toBe(hashIdentity('10.0.0.1'));
  });

  it('does not contain the raw input value', () => {
    const raw = '192.168.1.99';
    expect(hashIdentity(raw)).not.toContain(raw);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rateLimitStore — record + getSummary (in-memory path)
// ─────────────────────────────────────────────────────────────────────────────
describe('rateLimitStore (in-memory)', () => {
  beforeEach(() => {
    rateLimitStore._clearMemoryStore();
  });

  it('records a rejection and counts it in the summary', async () => {
    await rateLimitStore.record(makeRecord());
    const summary = await rateLimitStore.getSummary(3600);
    expect(summary.total).toBe(1);
    expect(summary.byRoute).toHaveLength(1);
  });

  it('aggregates multiple rejections for the same route', async () => {
    const route = '/api/v1/bookings';
    for (let i = 0; i < 5; i++) {
      await rateLimitStore.record(makeRecord({ route, scope: 'booking' }));
    }
    const summary = await rateLimitStore.getSummary(3600);
    const routeStats = summary.byRoute.find((r) => r.route === route);
    expect(routeStats).toBeDefined();
    expect(routeStats!.count).toBe(5);
    expect(summary.total).toBe(5);
  });

  it('separates counts by route', async () => {
    await rateLimitStore.record(makeRecord({ route: '/api/v1/auth/login', scope: 'auth' }));
    await rateLimitStore.record(makeRecord({ route: '/api/v1/properties', scope: 'general' }));
    await rateLimitStore.record(makeRecord({ route: '/api/v1/properties', scope: 'general' }));

    const summary = await rateLimitStore.getSummary(3600);
    expect(summary.total).toBe(3);

    const authRoute = summary.byRoute.find((r) => r.route === '/api/v1/auth/login');
    const propRoute = summary.byRoute.find((r) => r.route === '/api/v1/properties');

    expect(authRoute?.count).toBe(1);
    expect(propRoute?.count).toBe(2);
  });

  it('sorts byRoute by count descending', async () => {
    await rateLimitStore.record(makeRecord({ route: '/a', scope: 'general' }));
    for (let i = 0; i < 3; i++) {
      await rateLimitStore.record(makeRecord({ route: '/b', scope: 'general' }));
    }

    const summary = await rateLimitStore.getSummary(3600);
    expect(summary.byRoute[0].count).toBeGreaterThanOrEqual(summary.byRoute[1].count);
  });

  it('excludes rejections outside the time window', async () => {
    const old = Date.now() - 7200 * 1000; // 2 hours ago
    await rateLimitStore.record(makeRecord({ timestamp: old }));
    await rateLimitStore.record(makeRecord()); // now — within 1-hour window

    const summary = await rateLimitStore.getSummary(3600); // 1-hour window
    expect(summary.total).toBe(1);
  });

  it('returns total=0 and empty byRoute when store is empty', async () => {
    const summary = await rateLimitStore.getSummary(3600);
    expect(summary.total).toBe(0);
    expect(summary.byRoute).toHaveLength(0);
  });

  it('includes the since timestamp in the response', async () => {
    const before = new Date(Date.now() - 3600 * 1000);
    const summary = await rateLimitStore.getSummary(3600);
    const since = new Date(summary.since);
    // since should be within ±2s of expected
    expect(Math.abs(since.getTime() - before.getTime())).toBeLessThan(2000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin controller
// ─────────────────────────────────────────────────────────────────────────────
describe('getRateLimitSummary controller', () => {
  const { getRateLimitSummary } = await import('../../src/controllers/admin.controller.js');

  beforeEach(() => {
    rateLimitStore._clearMemoryStore();
  });

  function makeReq(query: Record<string, string> = {}): Request {
    return { query } as unknown as Request;
  }

  function makeRes() {
    const res: any = {};
    res.status = mock(() => res);
    res.json = mock((data: unknown) => {
      res._body = data;
      return res;
    });
    return res as Response & { _body: unknown };
  }

  it('returns 400 for invalid window param', async () => {
    const req = makeReq({ window: 'invalid' });
    const res = makeRes();
    await getRateLimitSummary(req, res);
    expect((res.status as ReturnType<typeof mock>).mock.calls[0][0]).toBe(400);
  });

  it('returns 400 for negative window', async () => {
    const req = makeReq({ window: '-100' });
    const res = makeRes();
    await getRateLimitSummary(req, res);
    expect((res.status as ReturnType<typeof mock>).mock.calls[0][0]).toBe(400);
  });

  it('returns summary for default window', async () => {
    await rateLimitStore.record(makeRecord());
    const req = makeReq();
    const res = makeRes();
    await getRateLimitSummary(req, res);

    const body = res._body as any;
    expect(body.windowSeconds).toBe(3600);
    expect(body.total).toBe(1);
    expect(Array.isArray(body.byRoute)).toBe(true);
  });

  it('respects a custom window param', async () => {
    const req = makeReq({ window: '7200' });
    const res = makeRes();
    await getRateLimitSummary(req, res);
    const body = res._body as any;
    expect(body.windowSeconds).toBe(7200);
  });

  it('caps window at 7 days', async () => {
    const req = makeReq({ window: '9999999' });
    const res = makeRes();
    await getRateLimitSummary(req, res);
    const body = res._body as any;
    expect(body.windowSeconds).toBe(60 * 60 * 24 * 7);
  });

  it('includes the alert flag in the response', async () => {
    const req = makeReq();
    const res = makeRes();
    await getRateLimitSummary(req, res);
    const body = res._body as any;
    expect(typeof body.alert).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireAdmin middleware
// ─────────────────────────────────────────────────────────────────────────────
describe('requireAdmin middleware', () => {
  const { requireAdmin } = await import('../../src/middleware/admin.middleware.js');
  const jwt = await import('jsonwebtoken');

  const secret = process.env.JWT_SECRET || 'mock-jwt-secret-min-32-characters-long';

  function makeAdminToken() {
    return jwt.default.sign({ userId: 'admin-1', role: 'admin' }, secret, { expiresIn: '1h' });
  }

  function makeUserToken() {
    return jwt.default.sign({ userId: 'user-1', role: 'user' }, secret, { expiresIn: '1h' });
  }

  function makeReq(authHeader?: string): Request {
    return {
      headers: authHeader ? { authorization: `Bearer ${authHeader}` } : {},
    } as unknown as Request;
  }

  function makeRes() {
    const res: any = {};
    res.status = mock(() => res);
    res.json = mock(() => res);
    return res as Response & { status: ReturnType<typeof mock>; json: ReturnType<typeof mock> };
  }

  it('calls next() for a valid admin token', () => {
    const req = makeReq(makeAdminToken());
    const res = makeRes();
    const next = mock(() => {});
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when no token is provided', () => {
    const req = makeReq();
    const res = makeRes();
    const next = mock(() => {});
    requireAdmin(req, res, next);
    expect((res.status as ReturnType<typeof mock>).mock.calls[0][0]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token has user role', () => {
    const req = makeReq(makeUserToken());
    const res = makeRes();
    const next = mock(() => {});
    requireAdmin(req, res, next);
    expect((res.status as ReturnType<typeof mock>).mock.calls[0][0]).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid/tampered token', () => {
    const req = makeReq('not.a.valid.jwt.at.all');
    const res = makeRes();
    const next = mock(() => {});
    requireAdmin(req, res, next);
    expect((res.status as ReturnType<typeof mock>).mock.calls[0][0]).toBe(401);
  });
});
