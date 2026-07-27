/**
 * CAPTCHA verification middleware using hCaptcha.
 *
 * Configuration via environment variables:
 *   HCAPTCHA_SECRET_KEY  — hCaptcha secret key (required in production)
 *   HCAPTCHA_ENABLED     — set to "false" to bypass verification in development
 *
 * The client must send the hCaptcha response token in the request body as
 * the field `captchaToken`. On verification failure the request is rejected
 * with HTTP 422 and a clear error message.
 *
 * Fail-closed: if the secret key is missing in production, all requests are
 * rejected to prevent accidental bypass.
 */

import type { NextFunction, Request, Response } from 'express';

const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';

interface HCaptchaVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verify a captcha token against hCaptcha's siteverify endpoint.
 * Returns true on success, throws on network error.
 */
async function verifyHCaptchaToken(token: string, secretKey: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: secretKey, response: token });

  const res = await fetch(HCAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`hCaptcha verify HTTP ${res.status}`);
  }

  const data = (await res.json()) as HCaptchaVerifyResponse;
  return data.success === true;
}

/**
 * Express middleware that verifies the `captchaToken` field in `req.body`.
 *
 * Behaviour matrix:
 *  - HCAPTCHA_ENABLED=false  → bypass (for local dev / CI)
 *  - No secret key + production → reject all (fail-closed)
 *  - Token missing or invalid → 422
 *  - Token valid → next()
 */
export function captchaMiddleware(req: Request, res: Response, next: NextFunction): void {
  const enabled = process.env.HCAPTCHA_ENABLED !== 'false';
  const secretKey = process.env.HCAPTCHA_SECRET_KEY;

  // Development bypass
  if (!enabled) {
    next();
    return;
  }

  // Fail-closed: no secret key in production
  if (!secretKey) {
    console.error('[CAPTCHA] HCAPTCHA_SECRET_KEY is not set — rejecting request (fail-closed)');
    res.status(503).json({
      error: 'Service temporarily unavailable',
      code: 'CAPTCHA_MISCONFIGURED',
    });
    return;
  }

  const token: unknown = req.body?.captchaToken;

  if (!token || typeof token !== 'string' || token.trim() === '') {
    res.status(422).json({
      error: 'CAPTCHA verification required',
      code: 'CAPTCHA_TOKEN_MISSING',
    });
    return;
  }

  verifyHCaptchaToken(token.trim(), secretKey)
    .then((valid) => {
      if (!valid) {
        res.status(422).json({
          error: 'CAPTCHA verification failed. Please try again.',
          code: 'CAPTCHA_INVALID',
        });
        return;
      }
      // Strip the token from the body so downstream handlers don't see it
      delete req.body.captchaToken;
      next();
    })
    .catch((err: unknown) => {
      console.error('[CAPTCHA] Verification error:', err);
      // Fail-closed in production; allow through in dev if explicitly configured
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({
          error: 'CAPTCHA verification service unavailable. Please try again.',
          code: 'CAPTCHA_SERVICE_ERROR',
        });
      } else {
        console.warn('[CAPTCHA] Non-production: bypassing due to verification error');
        next();
      }
    });
}
