/**
 * Request correlation-id propagation test.
 *
 * Verifies that the correlation id assigned by `requestIdMiddleware`:
 *   1. Is echoed back in the `X-Request-Id` response header.
 *   2. Is available — via the AsyncLocalStorage-backed request context in
 *      `logging.service.ts` — to log calls made deep in the stack with no
 *      direct access to `req` (controllers, services, etc.).
 *   3. Stays consistent across every log line emitted during the same request,
 *      whether generated fresh or inherited from an inbound `X-Request-Id` header.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { requestIdMiddleware, structuredLog } from '../middleware/logging.middleware.js';
import { getRequestContext } from '../services/logging.service.js';

// Simulates a service function several layers below the route handler that
// has no access to `req` and must rely on the async-local request context.
function deepServiceLog(): void {
  const context = getRequestContext();
  structuredLog({
    level: 'info',
    message: 'deep service log',
    timestamp: new Date().toISOString(),
    method: context?.method,
    path: context?.path,
  });
}

interface ParsedLogLine {
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function parseLoggedLines(spy: ReturnType<typeof vi.spyOn>): ParsedLogLine[] {
  return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string) as ParsedLogLine);
}

function makeApp() {
  const app = express();
  app.use(requestIdMiddleware);

  app.get('/log', (_req: Request, res: Response) => {
    structuredLog({
      level: 'info',
      message: 'handler start',
      timestamp: new Date().toISOString(),
    });
    deepServiceLog();
    res.status(200).json({ ok: true });
  });

  return app;
}

describe('Request correlation id propagation', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('propagates the generated id to every log line and the response header', async () => {
    const app = makeApp();
    const res = await request(app).get('/log');

    const headerId = res.headers['x-request-id'];
    expect(headerId).toBeDefined();
    expect(typeof headerId).toBe('string');

    const loggedLines = parseLoggedLines(logSpy);
    expect(loggedLines.length).toBeGreaterThanOrEqual(2);
    expect(loggedLines.some((line) => line.message === 'handler start')).toBe(true);
    expect(loggedLines.some((line) => line.message === 'deep service log')).toBe(true);

    for (const line of loggedLines) {
      expect(line.requestId).toBe(headerId);
    }
  });

  it('reuses a client-supplied X-Request-Id consistently across all logs', async () => {
    const app = makeApp();
    const clientId = 'client-correlation-42';
    const res = await request(app).get('/log').set('X-Request-Id', clientId);

    expect(res.headers['x-request-id']).toBe(clientId);

    const loggedLines = parseLoggedLines(logSpy);
    expect(loggedLines.length).toBeGreaterThanOrEqual(2);
    for (const line of loggedLines) {
      expect(line.requestId).toBe(clientId);
    }
  });

  it('isolates correlation ids between concurrent requests', async () => {
    const app = makeApp();
    const [resA, resB] = await Promise.all([
      request(app).get('/log'),
      request(app).get('/log'),
    ]);

    const idA = resA.headers['x-request-id'];
    const idB = resB.headers['x-request-id'];
    expect(idA).not.toBe(idB);

    const loggedLines = parseLoggedLines(logSpy);
    const idsSeen = new Set(loggedLines.map((line) => line.requestId));
    expect(idsSeen).toEqual(new Set([idA, idB]));
  });
});
