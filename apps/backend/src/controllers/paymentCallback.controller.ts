/**
 * Payment callback controller (#610).
 *
 * Receives POST webhooks from TrustlessWork / Stellar escrow providers.
 * Raw request bytes are read before Express JSON-parsing so the HMAC is
 * computed over the exact wire bytes.
 *
 * Route:  POST /api/v1/payments/callback
 * Header: X-TrustlessWork-Signature: <hmac-sha256-hex>
 */

import type { Request, Response } from 'express';
import {
  processProviderCallback,
  buildCallbackResponse,
} from '@/services/paymentCallback.service.js';

/** Minimum time (ms) to spend on failure paths to blunt timing oracles. */
const FAILURE_DELAY_MS = 250;

/** Provider-compatible generic failure body — never reveals internals. */
function genericFailureBody(): { status: 'error'; message: string } {
  return { status: 'error', message: 'Callback rejected' };
}

/** Sleep helper used to normalise failure-path timing. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/v1/payments/callback
 *
 * Expects the raw body to be stored on `req.rawBody` by the body-parser
 * middleware configured in the router (see payment.routes.ts).
 *
 * Never exposes internal error messages in the response.
 */
export async function handlePaymentCallback(req: Request, res: Response): Promise<void> {
  const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
  const rawSignature = req.headers['x-trustlesswork-signature'];
  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;

  const webhookSecret = process.env.TRUSTLESS_WORK_WEBHOOK_SECRET ?? '';
  const expectedProviderId = process.env.TRUSTLESS_WORK_PROVIDER_ID ?? '';

  if (!webhookSecret) {
    // Misconfiguration — fail closed: reject all callbacks without leaking why.
    await delay(FAILURE_DELAY_MS);
    res.status(500).json(genericFailureBody());
    return;
  }

  // Missing raw bytes or signature header can never be verified.
  if (rawBody.length === 0 || !signature) {
    await delay(FAILURE_DELAY_MS);
    res.status(400).json(genericFailureBody());
    return;
  }

  let result: Awaited<ReturnType<typeof processProviderCallback>>;
  try {
    result = await processProviderCallback(
      rawBody,
      signature,
      req.body,
      webhookSecret,
      expectedProviderId,
    );
  } catch {
    // Never surface internal errors; normalise timing on the failure path.
    await delay(FAILURE_DELAY_MS);
    res.status(400).json(genericFailureBody());
    return;
  }

  if (!result.success || !result.data) {
    await delay(FAILURE_DELAY_MS);
    res.status(result.statusCode ?? 400).json(genericFailureBody());
    return;
  }

  const responseBody = buildCallbackResponse(result.data);
  res.status(result.statusCode ?? 200).json(responseBody);
}
