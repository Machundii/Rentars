/**
 * Tests for the API deprecation header middleware.
 *
 * Covers:
 *  1. autoDeprecationHeaders — verifies Deprecation, Sunset, and Link headers
 *     are emitted for endpoints listed in DEPRECATED_ENDPOINTS.
 *  2. deprecationHeaders(key) — per-route factory variant.
 *  3. Non-deprecated routes — confirms no headers are injected.
 *  4. toHttpDate format — validates HTTP-date string formatting.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import {
  autoDeprecationHeaders,
  deprecationHeaders,
  DEPRECATED_ENDPOINTS,
  type DeprecatedEndpoint,
} from '../middleware/deprecation.middleware.js';

// ─── Test app factory ─────────────────────────────────────────────────────────

/**
 * Build a minimal Express app with a controlled registry snapshot so tests
 * are not coupled to the live DEPRECATED_ENDPOINTS array.
 *
 * We temporarily splice the provided entries into the registry, run the test,
 * then restore the original array contents.
 */
function makeApp(entries: DeprecatedEndpoint[]) {
  // Save and replace registry contents for the duration of this test app
  const original = DEPRECATED_ENDPOINTS.splice(0, DEPRECATED_ENDPOINTS.length);
  DEPRECATED_ENDPOINTS.push(...entries);

  const app = express();

  // ── Route: GET /api/v1/stub — uses router-level auto middleware ──
  const apiV1 = express.Router();
  apiV1.use(autoDeprecationHeaders);
  apiV1.get('/stub', (_req: Request, res: Response) => res.json({ ok: true }));
  apiV1.get('/other', (_req: Request, res: Response) => res.json({ ok: true }));
  app.use('/api/v1', apiV1);

  // ── Route: GET /api/v1/per-route — uses per-route factory ──
  const perRouteRouter = express.Router();
  perRouteRouter.get(
    '/per-route',
    deprecationHeaders('GET /api/v1/per-route'),
    (_req: Request, res: Response) => res.json({ ok: true }),
  );
  app.use('/api/v1', perRouteRouter);

  // Restore registry after the app is built so other tests are not affected
  process.nextTick(() => {
    DEPRECATED_ENDPOINTS.splice(0, DEPRECATED_ENDPOINTS.length);
    DEPRECATED_ENDPOINTS.push(...original);
  });

  return app;
}

// ─── Registry fixture ─────────────────────────────────────────────────────────

const FIXTURE_ENTRY: DeprecatedEndpoint = {
  key:          'GET /api/v1/stub',
  deprecatedAt: '2025-01-15T00:00:00Z',
  sunsetAt:     '2025-07-15T00:00:00Z',
  successor:    '/api/v2/stub',
};

const FIXTURE_NO_SUNSET: DeprecatedEndpoint = {
  key:          'GET /api/v1/stub',
  deprecatedAt: '2025-03-01T00:00:00Z',
  // sunsetAt intentionally omitted
};

const FIXTURE_PER_ROUTE: DeprecatedEndpoint = {
  key:          'GET /api/v1/per-route',
  deprecatedAt: '2025-02-01T00:00:00Z',
  sunsetAt:     '2025-08-01T00:00:00Z',
  successor:    '/api/v2/per-route',
};

// ─── autoDeprecationHeaders ───────────────────────────────────────────────────

describe('autoDeprecationHeaders', () => {
  describe('registered endpoint', () => {
    let app: ReturnType<typeof express>;

    beforeAll(() => {
      app = makeApp([FIXTURE_ENTRY]);
    });

    it('emits the Deprecation header', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.status).toBe(200);
      expect(res.headers['deprecation']).toBeDefined();
    });

    it('Deprecation header is an HTTP-date string', async () => {
      const res = await request(app).get('/api/v1/stub');
      const header = res.headers['deprecation'] as string;
      // RFC 7231 HTTP-date: "Wed, 15 Jan 2025 00:00:00 GMT"
      expect(new Date(header).toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });

    it('emits the Sunset header', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.headers['sunset']).toBeDefined();
    });

    it('Sunset header is an HTTP-date string matching sunsetAt', async () => {
      const res = await request(app).get('/api/v1/stub');
      const header = res.headers['sunset'] as string;
      expect(new Date(header).toISOString()).toBe('2025-07-15T00:00:00.000Z');
    });

    it('emits a Link header pointing to the successor', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.headers['link']).toBe('</api/v2/stub>; rel="successor-version"');
    });

    it('returns 200 — endpoint still works while deprecated', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('registered endpoint without sunsetAt or successor', () => {
    let app: ReturnType<typeof express>;

    beforeAll(() => {
      app = makeApp([FIXTURE_NO_SUNSET]);
    });

    it('still emits the Deprecation header', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.headers['deprecation']).toBeDefined();
    });

    it('does NOT emit a Sunset header', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.headers['sunset']).toBeUndefined();
    });

    it('does NOT emit a Link header', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.headers['link']).toBeUndefined();
    });
  });

  describe('non-deprecated endpoint', () => {
    let app: ReturnType<typeof express>;

    beforeAll(() => {
      // Only /stub is deprecated; /other is not in the registry
      app = makeApp([FIXTURE_ENTRY]);
    });

    it('does NOT emit a Deprecation header on a clean route', async () => {
      const res = await request(app).get('/api/v1/other');
      expect(res.headers['deprecation']).toBeUndefined();
    });

    it('does NOT emit a Sunset header on a clean route', async () => {
      const res = await request(app).get('/api/v1/other');
      expect(res.headers['sunset']).toBeUndefined();
    });

    it('does NOT emit a Link header on a clean route', async () => {
      const res = await request(app).get('/api/v1/other');
      expect(res.headers['link']).toBeUndefined();
    });
  });

  describe('empty registry', () => {
    let app: ReturnType<typeof express>;

    beforeAll(() => {
      app = makeApp([]); // no deprecated endpoints
    });

    it('does not inject any deprecation headers', async () => {
      const res = await request(app).get('/api/v1/stub');
      expect(res.headers['deprecation']).toBeUndefined();
      expect(res.headers['sunset']).toBeUndefined();
      expect(res.headers['link']).toBeUndefined();
    });
  });
});

// ─── deprecationHeaders (per-route factory) ───────────────────────────────────

describe('deprecationHeaders() factory', () => {
  let app: ReturnType<typeof express>;

  beforeAll(() => {
    app = makeApp([FIXTURE_PER_ROUTE]);
  });

  it('emits Deprecation header on the annotated route', async () => {
    const res = await request(app).get('/api/v1/per-route');
    expect(res.headers['deprecation']).toBeDefined();
  });

  it('emits Sunset header on the annotated route', async () => {
    const res = await request(app).get('/api/v1/per-route');
    expect(res.headers['sunset']).toBeDefined();
    expect(new Date(res.headers['sunset'] as string).toISOString()).toBe(
      '2025-08-01T00:00:00.000Z',
    );
  });

  it('emits Link header on the annotated route', async () => {
    const res = await request(app).get('/api/v1/per-route');
    expect(res.headers['link']).toBe('</api/v2/per-route>; rel="successor-version"');
  });

  it('returns 200 — endpoint still works', async () => {
    const res = await request(app).get('/api/v1/per-route');
    expect(res.status).toBe(200);
  });
});

// ─── HTTP-date formatting ─────────────────────────────────────────────────────

describe('HTTP-date header formatting', () => {
  /**
   * Mirror the private toHttpDate helper by round-tripping through Date.
   * We test observable behaviour (the response header) rather than internals.
   */
  it('Deprecation value is parseable as a valid Date', async () => {
    const app = makeApp([FIXTURE_ENTRY]);
    const res = await request(app).get('/api/v1/stub');
    const header = res.headers['deprecation'] as string;
    expect(Number.isNaN(new Date(header).getTime())).toBe(false);
  });

  it('Sunset value is parseable as a valid Date', async () => {
    const app = makeApp([FIXTURE_ENTRY]);
    const res = await request(app).get('/api/v1/stub');
    const header = res.headers['sunset'] as string;
    expect(Number.isNaN(new Date(header).getTime())).toBe(false);
  });

  it('Deprecation date matches the registered deprecatedAt', async () => {
    const app = makeApp([FIXTURE_ENTRY]);
    const res = await request(app).get('/api/v1/stub');
    const header = res.headers['deprecation'] as string;
    // Normalise both to ms since epoch for a timezone-agnostic comparison
    expect(new Date(header).getTime()).toBe(
      new Date(FIXTURE_ENTRY.deprecatedAt).getTime(),
    );
  });

  it('Sunset date matches the registered sunsetAt', async () => {
    const app = makeApp([FIXTURE_ENTRY]);
    const res = await request(app).get('/api/v1/stub');
    const header = res.headers['sunset'] as string;
    expect(new Date(header).getTime()).toBe(
      new Date(FIXTURE_ENTRY.sunsetAt!).getTime(),
    );
  });
});
