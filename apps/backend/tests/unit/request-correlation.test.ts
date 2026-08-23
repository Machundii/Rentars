/**
 * Unit tests for request correlation id propagation.
 * Verifies requestIdMiddleware binds the id (and method/path/userId) to an
 * AsyncLocalStorage-backed context that structuredLog and the logging
 * service can read without `req` being passed through every call.
 */

import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware, structuredLog } from '../../src/middleware/logging.middleware.js';
import { getRequestContext, setRequestContextUserId } from '../../src/services/logging.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers, method: 'GET', path: '/log' } as unknown as Request;
}

function makeRes(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response & { headers: Record<string, string> };
}

interface ParsedLogLine {
  message: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

function parseLoggedLines(spy: ReturnType<typeof spyOn>): ParsedLogLine[] {
  return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string) as ParsedLogLine);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('requestIdMiddleware — correlation id binding', () => {
  it('generates a UUID, sets X-Request-Id, and exposes it via getRequestContext inside the request', () => {
    const req = makeReq();
    const res = makeRes();
    let contextRequestId: string | undefined;

    requestIdMiddleware(req, res, (() => {
      contextRequestId = getRequestContext()?.requestId;
    }) as NextFunction);

    expect(res.headers['X-Request-Id']).toBeDefined();
    expect(contextRequestId).toBe(res.headers['X-Request-Id']);
  });

  it('reuses an inbound X-Request-Id header instead of generating a new one', () => {
    const clientId = 'client-correlation-42';
    const req = makeReq({ 'x-request-id': clientId });
    const res = makeRes();
    let contextRequestId: string | undefined;

    requestIdMiddleware(req, res, (() => {
      contextRequestId = getRequestContext()?.requestId;
    }) as NextFunction);

    expect(res.headers['X-Request-Id']).toBe(clientId);
    expect(contextRequestId).toBe(clientId);
  });

  it('does not leak context outside the request — getRequestContext() is undefined after next() returns', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req, res, (() => {}) as NextFunction);

    expect(getRequestContext()).toBeUndefined();
  });

  it('keeps two sequential requests from leaking correlation ids into each other', () => {
    const seenIds: (string | undefined)[] = [];

    requestIdMiddleware(makeReq(), makeRes(), (() => {
      seenIds.push(getRequestContext()?.requestId);
    }) as NextFunction);

    requestIdMiddleware(makeReq(), makeRes(), (() => {
      seenIds.push(getRequestContext()?.requestId);
    }) as NextFunction);

    expect(seenIds[0]).toBeDefined();
    expect(seenIds[1]).toBeDefined();
    expect(seenIds[0]).not.toBe(seenIds[1]);
  });
});

describe('structuredLog — auto-fills correlation fields from context', () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('injects requestId from the async-local context when the caller omits it', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req, res, (() => {
      // Simulates a service call deep in the stack with no access to `req`.
      structuredLog({ level: 'info', message: 'deep service log', timestamp: new Date().toISOString() });
    }) as NextFunction);

    const [line] = parseLoggedLines(logSpy);
    expect(line.message).toBe('deep service log');
    expect(line.requestId).toBe(res.headers['X-Request-Id']);
  });

  it('picks up userId once auth middleware attaches it via setRequestContextUserId', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req, res, (() => {
      setRequestContextUserId('user-42');
      structuredLog({ level: 'info', message: 'authenticated log', timestamp: new Date().toISOString() });
    }) as NextFunction);

    const [line] = parseLoggedLines(logSpy);
    expect(line.userId).toBe('user-42');
    expect(line.requestId).toBe(res.headers['X-Request-Id']);
  });

  it('prefers an explicitly-passed requestId/userId over the context', () => {
    const req = makeReq();
    const res = makeRes();

    requestIdMiddleware(req, res, (() => {
      setRequestContextUserId('context-user');
      structuredLog({
        level: 'info',
        message: 'explicit fields win',
        timestamp: new Date().toISOString(),
        requestId: 'explicit-id',
        userId: 'explicit-user',
      });
    }) as NextFunction);

    const [line] = parseLoggedLines(logSpy);
    expect(line.requestId).toBe('explicit-id');
    expect(line.userId).toBe('explicit-user');
  });

  it('is a no-op fallback outside any request context (no crash, fields stay undefined)', () => {
    structuredLog({ level: 'info', message: 'no context log', timestamp: new Date().toISOString() });

    const [line] = parseLoggedLines(logSpy);
    expect(line.message).toBe('no context log');
    expect(line.requestId).toBeUndefined();
  });
});
