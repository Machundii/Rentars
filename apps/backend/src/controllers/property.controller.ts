import type { Request, Response } from 'express';
import type { Request, Response } from 'express';
import {
  createProperty,
  deleteProperty,
  getAllProperties,
  getPropertyById,
  searchProperties,
  updateProperty,
  advancedSearch,
  duplicateProperty,
  type AdvancedSearchFilters,
} from '@/services/property.service.js';
import { trackSearch, getSearchSuggestions, getTrendingSearches } from '@/services/searchAnalytics.service.js';
import {
  recordPropertyView,
  getPropertyViewCount,
  getPropertyViewStats,
  isBot,
} from '@/services/propertyView.service.js';
import crypto from 'node:crypto';

export async function getProperties(req: Request, res: Response): Promise<void> {
  // If any search filter query params are present, delegate to searchProperties
  const { city, country, min_price, max_price, bedrooms, status } = req.query;

  const hasFilters = city || country || min_price || max_price || bedrooms || status;

  if (hasFilters) {
    const result = await searchProperties({
      city: city as string | undefined,
      country: country as string | undefined,
      min_price: min_price ? Number(min_price) : undefined,
      max_price: max_price ? Number(max_price) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      status: status as string | undefined,
    });

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json(result.data);
    return;
  }

  const result = await getAllProperties();

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

// ─── Featured ─────────────────────────────────────────────────────────────────

export async function getFeatured(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getFeaturedProperties();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

// ─── Single property ──────────────────────────────────────────────────────────

export async function getProperty(req: Request, res: Response): Promise<void> {
  const result = await getPropertyById(req.params.id);

  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function createPropertyHandler(req: Request, res: Response): Promise<void> {
  const result = await createProperty(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json(result.data);
}

export async function updatePropertyHandler(req: Request, res: Response): Promise<void> {
  const result = await updateProperty(req.params.id, req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function deletePropertyHandler(req: Request, res: Response): Promise<void> {
  const result = await deleteProperty(req.params.id);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(204).send();
}

// ─── Advanced Search ──────────────────────────────────────────────────────────

export async function advancedSearchHandler(req: Request, res: Response): Promise<void> {
  const filters: AdvancedSearchFilters = {
    query: req.query.q as string,
    city: req.query.city as string,
    country: req.query.country as string,
    min_price: req.query.min_price ? Number(req.query.min_price) : undefined,
    max_price: req.query.max_price ? Number(req.query.max_price) : undefined,
    bedrooms: req.query.bedrooms ? Number(req.query.bedrooms) : undefined,
    guests: req.query.guests ? Number(req.query.guests) : undefined,
    amenities: req.query.amenities ? (Array.isArray(req.query.amenities) ? (req.query.amenities as string[]) : [req.query.amenities as string]) : undefined,
    latitude: req.query.latitude ? Number(req.query.latitude) : undefined,
    longitude: req.query.longitude ? Number(req.query.longitude) : undefined,
    radius_km: req.query.radius_km ? Number(req.query.radius_km) : undefined,
    checkIn: req.query.checkIn as string,
    checkOut: req.query.checkOut as string,
    sortBy: req.query.sortBy as any,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  };

  const result = await advancedSearch(filters);

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  // Track search analytics
  await trackSearch(filters.query || '', result.data.length, undefined, filters);

  res.json({
    data: result.data,
    count: result.data.length,
    page: filters.page,
  });
}

export async function searchSuggestionsHandler(req: Request, res: Response): Promise<void> {
  const prefix = req.query.q as string;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const result = await getSearchSuggestions(prefix, limit);

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function trendingSearchesHandler(_req: Request, res: Response): Promise<void> {
  const result = await getTrendingSearches(10);

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function getAvailability(req: Request, res: Response): Promise<void> {
  try {
    const ranges = await getAvailabilityRanges(req.params.id);
    res.json(ranges);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function setAvailability(req: AuthRequest, res: Response): Promise<void> {
  try {
    const ranges = await setAvailabilityRanges(
      req.params.id,
      req.userId!,
      req.body.ranges,
    );
    res.json(ranges);
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('Forbidden') || message === 'Property not found') {
      res.status(message.startsWith('Forbidden') ? 403 : 404).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/properties/:id/duplicate
 *
 * Creates a draft copy of a host-owned property.
 * Query param `?copyImages=true` opts in to copying image URLs.
 * Returns 201 with the new draft property.
 */
export async function duplicatePropertyHandler(req: Request, res: Response): Promise<void> {
  const requesterId = (req as Request & { user?: { id: string } }).user?.id;

  if (!requesterId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const copyImages = req.query.copyImages === 'true';

  const result = await duplicateProperty(req.params.id, requesterId, { copyImages });

  if (!result.success) {
    const status = result.error?.startsWith('Forbidden') ? 403
      : result.error === 'Property not found' ? 404
      : 400;
    res.status(status).json({ error: result.error });
    return;
  }

  res.status(201).json(result.data);
}

// ─── Property view tracking ───────────────────────────────────────────────────

/**
 * POST /api/v1/properties/:id/view
 *
 * Records a deduplicated property view. Called by the frontend when the
 * property detail page loads.  No auth required — anonymous views are
 * tracked via a fingerprint derived from the request.
 */
export async function recordViewHandler(req: Request, res: Response): Promise<void> {
  const userAgent = req.headers['user-agent'];

  // Silently succeed for bots — no need to return an error
  if (isBot(userAgent)) {
    res.status(204).send();
    return;
  }

  const authUser = (req as Request & { user?: { id: string } }).user;
  const userId   = authUser?.id;

  // Anonymous fingerprint: hash of IP + UA (no PII stored directly)
  const ip  = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
              ?? req.socket?.remoteAddress
              ?? 'unknown';
  const fingerprint = !userId
    ? crypto.createHash('sha256').update(`${ip}:${userAgent ?? ''}`).digest('hex').slice(0, 16)
    : undefined;

  // ipHash stored for analytics — hash the IP separately
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  const result = await recordPropertyView({
    propertyId:  req.params.id,
    userId,
    fingerprint,
    userAgent,
    ipHash,
  });

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.status(204).send();
}

/**
 * GET /api/v1/properties/:id/views
 *
 * Returns the view count and daily breakdown for the property.
 * Only accessible by the property's owner (host).
 */
export async function getViewStatsHandler(req: Request, res: Response): Promise<void> {
  const authUser = (req as Request & { user?: { id: string } }).user;
  if (!authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Ownership check
  const propResult = await getPropertyById(req.params.id);
  if (!propResult.success || !propResult.data) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }
  if (propResult.data.owner_id !== authUser.id) {
    res.status(403).json({ error: 'Forbidden: only the property owner can view stats' });
    return;
  }

  const days   = req.query.days ? Number(req.query.days) : 30;
  const result = await getPropertyViewStats(req.params.id, days);

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  // Also include the denormalized total from the property row
  const countResult = await getPropertyViewCount(req.params.id);
  const totalFromProperty = countResult.success ? countResult.data?.viewCount : undefined;

  res.json({ ...result.data, totalFromProperty });
}

// ─── Occupancy heatmap ────────────────────────────────────────────────────────

import { getOccupancyHeatmap } from '@/services/occupancy.service.js';

/**
 * GET /api/v1/properties/:id/occupancy-heatmap
 *
 * Returns daily booked/blocked/available status over a selectable horizon.
 * Host-only: only the property owner may call this.
 *
 * Query params:
 *   from  - ISO date (YYYY-MM-DD), defaults to today
 *   to    - ISO date (YYYY-MM-DD), defaults to 3 months from today
 */
export async function getOccupancyHeatmapHandler(req: Request, res: Response): Promise<void> {
  const authUser = (req as Request & { user?: { id: string } }).user;
  if (!authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Ownership check
  const propResult = await getPropertyById(req.params.id);
  if (!propResult.success || !propResult.data) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }
  if (propResult.data.owner_id !== authUser.id) {
    res.status(403).json({ error: 'Forbidden: only the property owner can view occupancy data' });
    return;
  }

  // Default horizon: today → +90 days
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultTo = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 90);
    return d.toISOString().slice(0, 10);
  })();

  const from = (req.query.from as string | undefined) ?? todayStr;
  const to   = (req.query.to   as string | undefined) ?? defaultTo;

  const result = await getOccupancyHeatmap(req.params.id, from, to);

  if (!result.success) {
    const status = result.error?.includes('required') || result.error?.includes('Invalid') ? 422 : 500;
    res.status(status).json({ error: result.error });
    return;
  }

  res.json(result.data);
}
