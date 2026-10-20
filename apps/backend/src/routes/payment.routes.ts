/**
 * Payment routes.
 *
 * Authenticated routes (tenant-facing):
 *   POST   /api/v1/payments/submit      — Submit signed XDR
 *   GET    /api/v1/payments/:id/status  — Poll status
 *   POST   /api/v1/payments/:id/retry   — Retry failed payment
 *
 * Unauthenticated webhook (provider-facing, #610):
 *   POST   /api/v1/payments/callback    — Receive provider callbacks
 *
 * The callback route captures raw bytes before Express JSON-parses the body
 * so that HMAC signature verification operates on the exact wire content.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { json } from 'express';
import { authenticate } from '@/middleware/auth.middleware.js';
import { bookingRateLimiter } from '@/middleware/rateLimiter.js';
import { submitPayment, getStatus, retryPayment } from '@/controllers/payment.controller.js';
import { handlePaymentCallback } from '@/controllers/paymentCallback.controller.js';

const router = Router();

// ── Webhook (unauthenticated, raw-body capture) ───────────────────────────────

/** Maximum accepted callback payload size (bytes). */
const CALLBACK_BODY_LIMIT = '64kb';

/**
 * Middleware: capture raw request body as a Buffer and attach to `req.rawBody`
 * before handing off to the JSON body-parser.  Required for HMAC verification.
 *
 * Enforces a hard size limit so oversized/forged payloads are rejected before
 * any parsing or signature work happens.
 */
function captureRawBody(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let aborted = false;

  req.on('data', (chunk: Buffer) => {
    if (aborted) return;
    size += chunk.length;
    if (size > 64 * 1024) {
      aborted = true;
      res.status(413).json({ error: 'payload_too_large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on('error', (err) => {
    if (aborted) return;
    aborted = true;
    next(err);
  });
}

// NOTE: registered before `router.use(authenticate)` below so the provider
// webhook stays unauthenticated. Raw bytes are captured first, then JSON-parsed.
router.post(
  '/callback',
  captureRawBody,
  json({ limit: CALLBACK_BODY_LIMIT, verify: (req, _res, buf) => {
    // Ensure the parsed body always has access to the exact wire bytes.
    (req as Request & { rawBody: Buffer }).rawBody = buf;
  } }),
  handlePaymentCallback,
);

// ── Authenticated tenant routes ───────────────────────────────────────────────

router.use(authenticate);

/**
 * POST /api/v1/payments/submit
 * Submit a signed XDR to Stellar and create a tracked payment intent.
 */
router.post('/submit', bookingRateLimiter, submitPayment);

/**
 * GET /api/v1/payments/:id/status
 * Poll current payment status. Frontend polls every 3s while status=submitted.
 */
router.get('/:id/status', getStatus);

/**
 * POST /api/v1/payments/:id/retry
 * Retry a failed or timed-out payment safely (double-spend protected).
 */
router.post('/:id/retry', bookingRateLimiter, retryPayment);

export default router;
