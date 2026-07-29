import type { Request, Response } from 'express';
import { rateLimitStore } from '@/services/rateLimitStore.service.js';
import { setFeatured, clearFeatured, FEATURED_CAP } from '@/services/property.service.js';
import { getTopQueries, getZeroResultQueries, getDailySearchVolume } from '@/services/searchAnalytics.service.js';
import { listAuditLogs } from '@/services/auditLog.service.js';
import { z } from 'zod';

// ─── Featured listings ────────────────────────────────────────────────────────

/** Zod schema for the set-featured request body. */
const setFeaturedSchema = z.object({
  /**
   * ISO 8601 datetime until which the property is featured.
   * Must be a future timestamp.
   */
  featured_until: z
    .string()
    .datetime({ message: 'featured_until must be a valid ISO 8601 datetime string' }),

  /**
   * Optional ordering tiebreaker (higher = shown first among featured listings).
   * Defaults to 0.  Capped at 100 to keep the range sensible.
   */
  weight: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(0),
});

/**
 * PUT /api/v1/admin/properties/:id/featured
 *
 * Mark a property as featured for a given time window.
 *
 * Body:
 *   featured_until  — ISO 8601 datetime (required, must be future)
 *   weight          — integer 0–100, ordering tiebreaker (optional, default 0)
 *
 * Response: the updated property row.
 */
export async function setFeaturedHandler(req: Request, res: Response): Promise<void> {
  const propertyId = req.params.id;
  if (!propertyId) {
    res.status(400).json({ error: 'Property ID is required' });
    return;
  }

  const parsed = setFeaturedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { featured_until, weight } = parsed.data;

  const result = await setFeatured(propertyId, featured_until, weight);
  if (!result.success) {
    // setFeatured returns a user-readable error for bad inputs (past date, not found)
    const status = result.error?.includes('required')
      ? 400
      : result.error?.includes('future')
        ? 422
        : 400;
    res.status(status).json({ error: result.error });
    return;
  }

  res.json({
    data: result.data,
    meta: {
      featured_cap: FEATURED_CAP,
      message: `Property will be featured until ${featured_until}.`,
    },
  });
}

/**
 * DELETE /api/v1/admin/properties/:id/featured
 *
 * Remove the featured status from a property immediately.
 * Sets featured_until to NULL and featured_weight to 0.
 *
 * Response: the updated property row.
 */
export async function clearFeaturedHandler(req: Request, res: Response): Promise<void> {
  const propertyId = req.params.id;
  if (!propertyId) {
    res.status(400).json({ error: 'Property ID is required' });
    return;
  }

  const result = await clearFeatured(propertyId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    data: result.data,
    meta: { message: 'Featured status removed.' },
  });
}

// ─── Search analytics dashboard ──────────────────────────────────────────────

const analyticsQuerySchema = z.object({
  start_date: z.string().datetime({ message: 'start_date must be a valid ISO 8601 datetime' }),
  end_date: z.string().datetime({ message: 'end_date must be a valid ISO 8601 datetime' }),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/v1/admin/analytics/search/top-queries
 *
 * Returns the most frequently searched terms within a date range.
 *
 * Query params: start_date (ISO datetime), end_date (ISO datetime), limit (default 20, max 100)
 */
export async function getTopQueriesHandler(req: Request, res: Response): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { start_date, end_date, limit } = parsed.data;

  if (new Date(end_date) <= new Date(start_date)) {
    res.status(400).json({ error: 'end_date must be after start_date' });
    return;
  }

  const result = await getTopQueries(start_date, end_date, limit);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json({ data: result.data, meta: { start_date, end_date, limit } });
}

/**
 * GET /api/v1/admin/analytics/search/zero-results
 *
 * Returns the most frequently searched terms that yielded zero results.
 *
 * Query params: start_date (ISO datetime), end_date (ISO datetime), limit (default 20, max 100)
 */
export async function getZeroResultQueriesHandler(req: Request, res: Response): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { start_date, end_date, limit } = parsed.data;

  if (new Date(end_date) <= new Date(start_date)) {
    res.status(400).json({ error: 'end_date must be after start_date' });
    return;
  }

  const result = await getZeroResultQueries(start_date, end_date, limit);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json({ data: result.data, meta: { start_date, end_date, limit } });
}

/**
 * GET /api/v1/admin/analytics/search/volume
 *
 * Returns daily search volume within a date range.
 *
 * Query params: start_date (ISO datetime), end_date (ISO datetime)
 */
export async function getSearchVolumeHandler(req: Request, res: Response): Promise<void> {
  const schema = analyticsQuerySchema.omit({ limit: true });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { start_date, end_date } = parsed.data;

  if (new Date(end_date) <= new Date(start_date)) {
    res.status(400).json({ error: 'end_date must be after start_date' });
    return;
  }

  const result = await getDailySearchVolume(start_date, end_date);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json({ data: result.data, meta: { start_date, end_date } });
}

// ─── Rate-limit summary ───────────────────────────────────────────────────────

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

// ─── Audit log ────────────────────────────────────────────────────────────────

const auditLogQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * GET /api/v1/admin/audit-logs
 *
 * List/filter the append-only audit trail of sensitive admin/moderator actions.
 * No corresponding update/delete endpoint exists — entries are immutable.
 *
 * Query params: actorId, action, targetType, targetId (all optional filters), limit (default 50, max 200)
 */
export async function getAuditLogsHandler(req: Request, res: Response): Promise<void> {
  const parsed = auditLogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid parameters', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { actorId, action, targetType, targetId, limit } = parsed.data;
  const result = await listAuditLogs({ actorId, action, targetType, targetId, limit });

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json({ data: result.data, meta: { limit } });
}
