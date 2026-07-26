import type { Request, Response } from 'express';
import { rateLimitStore } from '@/services/rateLimitStore.service.js';

/**
 * GET /api/v1/admin/rate-limits
 *
 * Returns a summary of rate-limit rejections over a requested time window.
 * Requires admin authentication (handled by the route middleware).
 *
 * Query params:
 *   window  - time window in seconds (default 3600 = 1 hour; max 604800 = 7 days)
 *
 * Response shape:
 * {
 *   windowSeconds: number,
 *   since: ISO string,
 *   total: number,
 *   byRoute: [{ route, method, scope, count }]  // sorted by count desc
 * }
 */
export async function getRateLimitSummary(req: Request, res: Response): Promise<void> {
  const MAX_WINDOW = 60 * 60 * 24 * 7; // 7 days

  const rawWindow = req.query.window;
  let windowSeconds = 3600;

  if (rawWindow !== undefined) {
    const parsed = Number(rawWindow);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      res.status(400).json({ error: 'Query parameter "window" must be a positive integer (seconds).' });
      return;
    }
    windowSeconds = Math.min(parsed, MAX_WINDOW);
  }

  const summary = await rateLimitStore.getSummary(windowSeconds);

  res.json({
    ...summary,
    // Alerting hint: expose a threshold flag operators can wire to external alerting
    alert: summary.total > Number(process.env.RATE_LIMIT_ALERT_THRESHOLD || '100'),
  });
}
