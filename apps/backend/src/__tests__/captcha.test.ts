/**
 * Tests for the CAPTCHA verification middleware.
 *
 * Mocks the hCaptcha siteverify endpoint and asserts:
 *  - Requests with valid tokens pass through
 *  - Requests with invalid/missing tokens are rejected with 422
 *  - HCAPTCHA_ENABLED=false bypasses verification (dev mode)
 *  - Missing secret key in production rejects all requests (fail-closed)
 *  - Network errors in production reject requests (fail-closed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { captchaMiddleware } from '../middleware/captcha.middleware.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, _json: json, _status: status } as unknown as Response & {
    _json: typeof json;
    _status: typeof status;
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('captchaMiddleware', () => {
  const originalEnv = { ...process.env };
  const next = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: enabled with a fake secret key
    process.env.HCAPTCHA_ENABLED = 'true';
    process.env.HCAPTCHA_SECRET_KEY = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore env
    process.env.HCAPTCHA_ENABLED = originalEnv.HCAPTCHA_ENABLED;
    process.env.HCAPTCHA_SECRET_KEY = originalEnv.HCAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    vi.restoreAllMocks();
  });

  // ── Dev bypass ──────────────────────────────────────────────────────────────

  it('bypasses verification when HCAPTCHA_ENABLED=false', async () => {
    process.env.HCAPTCHA_ENABLED = 'false';
    const req = makeReq();
    const res = makeRes();

    captchaMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Missing token ───────────────────────────────────────────────────────────

  it('rejects with 422 when captchaToken is missing from body', async () => {
    const req = makeReq({ email: 'user@example.com' }); // no captchaToken
    const res = makeRes();

    captchaMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 422 when captchaToken is empty string', () => {
    const req = makeReq({ captchaToken: '   ' });
    const res = makeRes();

    captchaMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  // ── hCaptcha API responses ──────────────────────────────────────────────────

  it('calls next() when hCaptcha returns success:true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const req = makeReq({ captchaToken: 'valid-token' });
    const res = makeRes();

    captchaMiddleware(req, res, next);

    // wait for the async promise
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledOnce();
    // Token should be stripped from body
    expect((req as Request).body.captchaToken).toBeUndefined();
  });

  it('rejects with 422 when hCaptcha returns success:false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response);

    const req = makeReq({ captchaToken: 'bad-token' });
    const res = makeRes();

    captchaMiddleware(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Fail-closed: no secret key ──────────────────────────────────────────────

  it('rejects with 503 when HCAPTCHA_SECRET_KEY is not set (fail-closed)', () => {
    delete process.env.HCAPTCHA_SECRET_KEY;
    const req = makeReq({ captchaToken: 'some-token' });
    const res = makeRes();

    captchaMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Fail-closed: network error in production ────────────────────────────────

  it('rejects with 503 on network error in production', async () => {
    process.env.NODE_ENV = 'production';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const req = makeReq({ captchaToken: 'some-token' });
    const res = makeRes();

    captchaMiddleware(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through on network error outside production (dev/test)', async () => {
    process.env.NODE_ENV = 'test';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const req = makeReq({ captchaToken: 'some-token' });
    const res = makeRes();

    captchaMiddleware(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    // In test/dev mode, network errors don't block the request
    expect(next).toHaveBeenCalledOnce();
  });

  // ── Response body shape ─────────────────────────────────────────────────────

  it('includes a CAPTCHA_INVALID code on invalid token response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    } as Response);

    const jsonCaptor = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonCaptor }),
    } as unknown as Response;

    captchaMiddleware(makeReq({ captchaToken: 'bad' }), res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(jsonCaptor).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CAPTCHA_INVALID' }),
    );
  });

  it('includes a CAPTCHA_TOKEN_MISSING code when token absent', () => {
    const jsonCaptor = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonCaptor }),
    } as unknown as Response;

    captchaMiddleware(makeReq({}), res, next);

    expect(jsonCaptor).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CAPTCHA_TOKEN_MISSING' }),
    );
  });
});
