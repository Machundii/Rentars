import type { Request, Response } from 'express';
import { z } from 'zod';
import { loggingService } from '@/services/logging.service.js';

/**
 * Zod schema for the client-error payload.
 * Strict typing ensures we only persist what we expect and
 * reject any attempt to inject oversized or malformed data.
 */
const clientErrorSchema = z.object({
  message: z.string().max(300),
  href: z.string().url().max(2048).optional().or(z.literal('')),
  digest: z.string().max(64).optional(),
  context: z.string().max(100).optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * POST /api/v1/client-errors
 *
 * Receives sanitised client-side error reports from the browser.
 * This endpoint is unauthenticated (errors can occur before login).
 *
 * Security guarantees:
 * - Payload is validated and strictly bounded before persistence.
 * - No raw stack traces are accepted — only the pre-sanitised message.
 * - Rate limiting is applied by the general limiter in the middleware chain.
 * - Always returns 204 so attackers cannot probe the system via response differences.
 */
export async function receiveClientError(req: Request, res: Response): Promise<void> {
  const parsed = clientErrorSchema.safeParse(req.body);

  if (!parsed.success) {
    // Silently accept — return 204 so clients don't retry unnecessarily
    res.status(204).end();
    return;
  }

  const { message, href, digest, context, timestamp } = parsed.data;

  // Persist via the existing logging service (same table as blockchain logs)
  await loggingService.logBlockchainOperation(
    'client_error',
    {
      source: 'browser',
      context: context ?? 'unknown',
      href: href ?? '',
      digest: digest ?? '',
      reportedAt: timestamp ?? new Date().toISOString(),
    },
    undefined,
    message,
  );

  // Always 204 — no body needed, and consistent response prevents enumeration
  res.status(204).end();
}
