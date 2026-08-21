/**
 * Unit tests for the createUserRateLimiter factory.
 *
 * Verifies:
 *  - Requests within the configured limit are allowed (next() called).
 *  - Requests beyond the limit are rejected with HTTP 429 + Retry-After header.
 *  - The key is scoped to the authenticated user id, not the IP.
 *  - Two different users sharing the same IP do not interfere with each other.
 *  - When no user is authenticated the limiter falls back to IP.
 *  - The 429 body uses the standard { error: { code, message, details } } shape.
 *
 * Uses bun:test — compatible with the backend's bun test runner.
 * Redis is disabled via REDIS_URL='' so RateLimiterMemory is used.
 */

import { describe, it, expect, mock } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';

// ── Ensure Redis is NOT used ──────────────────────────────────────────────────
process.env.REDIS_URL = '';

// ── Provide required env vars so env.ts validation passes ────────────────────
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-value';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars!!';

// ── Mock the redis module entirely (redis v6 exports are read-only) ──────────
mock.module('redis', () => ({
  createClient: () => ({
    on: () => {},
    connect: mock(async () => {}),
    zAdd: mock(async () => {}),
    zRemRangeByScore: mock(async () => {}),
    expire: mock(async () => {}),
    scan: mock(async () => ({ cursor: 0, keys: [] })),
    zCount: mock(async () => 0),
  }),
}));

// ── Mock the logging service to avoid real I/O ───────────────────────────────
mock.module('../../src/services/logging.service.js', () => ({
  loggingService: {
    logBlockchainOperation: mock(async () => {}),
  },
}));

// ── Mock the rateLimitStore service ──────────────────────────────────────────
mock.module('../../src/services/rateLimitStore.service.js', () => ({
  rateLimitStore: {
    record: mock(async () => {}),
  },
}));

// ── Import factory AFTER mocks are registered ─────────────────────────────────
const { createUserRateLimiter } = await import('../../src/middleware/rateLimiter.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

type FakeRes = Response & {
  status: ReturnType<typeof mock>;
  json: ReturnType<typeof mock>;
  setHeader: ReturnType<typeof mock>;
};

function makeReq(overrides: Record<string, unknown> = {}): Request {
  return {
    ip: '192.168.1.1',
    path: '/api/v1/bookings',
    method: 'POST',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): FakeRes {
  const res: any = {};
  res.status = mock(() => res);
  res.json = mock(() => res);
  res.setHeader = mock(() => res);
  return res as FakeRes;
}

/**
 * Run a single middleware call and resolve when next() is called OR
 * after a safety timeout (in case the request is rate-limited).
 */
function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
  res: FakeRes,
): Promise<void> {
  return new Promise<void>((resolve) => {
    middleware(req, res, () => resolve());
    setTimeout(resolve, 400);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('createUserRateLimiter — allowed requests', () => {
  it('calls next() on the first request within the limit', async () => {
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 5,
      keyPrefix: `rl:test:first:${Date.now()}`,
    });

    const res = makeRes();
    const next = mock(() => {});

    await new Promise<void>((resolve) => {
      limiter(makeReq({ user: { id: `user-first-${Date.now()}` } }) as any, res, () => {
        next();
        resolve();
      });
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets X-RateLimit-Remaining header on allowed request', async () => {
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 10,
      keyPrefix: `rl:test:remaining:${Date.now()}`,
    });

    const res = makeRes();

    await new Promise<void>((resolve) => {
      limiter(makeReq({ user: { id: `user-rem-${Date.now()}` } }) as any, res, () => resolve());
    });

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
  });

  it('sets X-RateLimit-Reset header on allowed request', async () => {
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 10,
      keyPrefix: `rl:test:reset:${Date.now()}`,
    });

    const res = makeRes();

    await new Promise<void>((resolve) => {
      limiter(makeReq({ user: { id: `user-reset-${Date.now()}` } }) as any, res, () => resolve());
    });

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('createUserRateLimiter — blocking behaviour', () => {
  it('returns 429 after the per-user limit is exhausted', async () => {
    const max = 2;
    const userId = `user-block-${Date.now()}`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max,
      keyPrefix: `rl:test:block:${Date.now()}`,
    });

    // Exhaust quota
    for (let i = 0; i < max; i++) {
      await new Promise<void>((resolve) => {
        limiter(makeReq({ user: { id: userId } }) as any, makeRes(), () => resolve());
      });
    }

    // Next request must be blocked
    const res = makeRes();
    const next = mock(() => {});
    await runMiddleware(limiter as any, makeReq({ user: { id: userId } }), res);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('sets Retry-After header on 429 response', async () => {
    const userId = `user-retry-${Date.now()}`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyPrefix: `rl:test:retry:${Date.now()}`,
    });

    // Exhaust quota (1 request)
    await new Promise<void>((resolve) => {
      limiter(makeReq({ user: { id: userId } }) as any, makeRes(), () => resolve());
    });

    const res = makeRes();
    await runMiddleware(limiter as any, makeReq({ user: { id: userId } }), res);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('returns standard error envelope { error: { code, message, details } } on 429', async () => {
    const userId = `user-shape-${Date.now()}`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyPrefix: `rl:test:shape:${Date.now()}`,
    });

    // Exhaust quota
    await new Promise<void>((resolve) => {
      limiter(makeReq({ user: { id: userId } }) as any, makeRes(), () => resolve());
    });

    const res = makeRes();
    await runMiddleware(limiter as any, makeReq({ user: { id: userId } }), res);

    const jsonCalls = (res.json as ReturnType<typeof mock>).mock.calls;
    expect(jsonCalls.length).toBeGreaterThan(0);

    const body = jsonCalls[0]?.[0] as any;
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
    expect(body.error).toHaveProperty('message');
    expect(typeof body.error.message).toBe('string');
    expect(body.error).toHaveProperty('details');
    expect(body.error.details).toHaveProperty('retryAfter');
    expect(typeof body.error.details.retryAfter).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('createUserRateLimiter — per-user scoping', () => {
  it('does not block user B when user A has exhausted their quota (shared IP)', async () => {
    const max = 2;
    const sharedIp = '10.0.0.1';
    const userA = `user-a-${Date.now()}`;
    const userB = `user-b-${Date.now()}`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max,
      keyPrefix: `rl:test:scope:${Date.now()}`,
    });

    // Exhaust user A's quota
    for (let i = 0; i < max; i++) {
      await new Promise<void>((resolve) => {
        limiter(makeReq({ user: { id: userA }, ip: sharedIp }) as any, makeRes(), () => resolve());
      });
    }

    // User A must be blocked
    const resA = makeRes();
    const nextA = mock(() => {});
    await runMiddleware(limiter as any, makeReq({ user: { id: userA }, ip: sharedIp }), resA);
    expect(nextA).not.toHaveBeenCalled();
    expect(resA.status).toHaveBeenCalledWith(429);

    // User B on the SAME IP must still be allowed
    const resB = makeRes();
    const nextB = mock(() => {});
    await new Promise<void>((resolve) => {
      limiter(makeReq({ user: { id: userB }, ip: sharedIp }) as any, resB, () => {
        nextB();
        resolve();
      });
    });
    expect(nextB).toHaveBeenCalledTimes(1);
    expect(resB.status).not.toHaveBeenCalled();
  });

  it('prefers req.user.id over req.userId as the rate-limit key', async () => {
    const userId = `preferred-${Date.now()}`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyPrefix: `rl:test:prefer:${Date.now()}`,
    });

    // Exhaust using req.user.id
    await new Promise<void>((resolve) => {
      limiter(
        makeReq({ user: { id: userId }, userId: 'other-legacy-id' }) as any,
        makeRes(),
        () => resolve(),
      );
    });

    // Second request with the same req.user.id must be blocked
    const res = makeRes();
    const next = mock(() => {});
    await runMiddleware(
      limiter as any,
      makeReq({ user: { id: userId }, userId: 'other-legacy-id' }),
      res,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('falls back to req.userId when req.user is absent', async () => {
    const userId = `legacy-${Date.now()}`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyPrefix: `rl:test:fallback-uid:${Date.now()}`,
    });

    // Exhaust via req.userId (no req.user)
    await new Promise<void>((resolve) => {
      limiter(makeReq({ userId }) as any, makeRes(), () => resolve());
    });

    const res = makeRes();
    const next = mock(() => {});
    await runMiddleware(limiter as any, makeReq({ userId }), res);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('falls back to IP when neither req.user nor req.userId is present', async () => {
    const ip = `10.1.${Date.now() % 200}.77`;
    const limiter = createUserRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyPrefix: `rl:test:fallback-ip:${Date.now()}`,
    });

    // Exhaust via IP only
    await new Promise<void>((resolve) => {
      limiter(makeReq({ ip }) as any, makeRes(), () => resolve());
    });

    const res = makeRes();
    const next = mock(() => {});
    await runMiddleware(limiter as any, makeReq({ ip }), res);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
