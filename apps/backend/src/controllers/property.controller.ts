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
  getFeaturedProperties,
  type AdvancedSearchFilters,
  type Property,
} from '@/services/property.service.js';
import {
  getAvailabilityRanges,
  setAvailabilityRanges,
} from '@/services/availability.service.js';
import { trackSearch, getSearchSuggestions, getTrendingSearches } from '@/services/searchAnalytics.service.js';
import { supabase } from '@/config/supabase.js';
import { redactExactCoordinates } from '@/utils/locationPrivacy.js';
import type { AuthRequest } from '@/middleware/auth.middleware.js';

// ─── Location-privacy helpers ─────────────────────────────────────────────────

/**
 * Check whether a viewer is entitled to see exact coordinates for a property.
 *
 * Returns true when the viewer is:
 *  1. The property's owner/host
 *  2. A tenant with a Confirmed booking on the property
 */
async function viewerHasExactLocationAccess(
  propertyId: string,
  ownerId: string | undefined,
  viewerUserId: string | undefined,
): Promise<boolean> {
  if (!viewerUserId) return false;
  if (ownerId && viewerUserId === ownerId) return true;

  // Check for a confirmed booking
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('property_id', propertyId)
    .eq('tenant_id', viewerUserId)
    .eq('status', 'Confirmed')
    .limit(1);

  return Array.isArray(data) && data.length > 0;
}

/**
 * Apply location privacy to a single property.
 * Exact coordinates are removed unless the viewer has access.
 */
async function applyLocationPrivacy(
  property: Property,
  viewerUserId: string | undefined,
): Promise<Record<string, unknown>> {
  const hasAccess = await viewerHasExactLocationAccess(
    property.id,
    property.owner_id,
    viewerUserId,
  );

  if (hasAccess) {
    return property as unknown as Record<string, unknown>;
  }

  return redactExactCoordinates(property as Property & { latitude?: number; longitude?: number }) as unknown as Record<string, unknown>;
}

/**
 * Apply location privacy to an array of properties.
 * For public list endpoints we always redact (no per-item check needed).
 */
function applyLocationPrivacyToList(properties: Property[]): Record<string, unknown>[] {
  return properties.map((p) =>
    redactExactCoordinates(p as Property & { latitude?: number; longitude?: number }) as unknown as Record<string, unknown>,
  );
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getProperties(req: Request, res: Response): Promise<void> {
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

    res.json(applyLocationPrivacyToList(result.data));
    return;
  }

  const result = await getAllProperties();
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(applyLocationPrivacyToList(result.data));
}

// ─── Featured ─────────────────────────────────────────────────────────────────

export async function getFeatured(_req: Request, res: Response): Promise<void> {
  const result = await getFeaturedProperties();
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }
  res.json(applyLocationPrivacyToList(result.data));
}

// ─── Single property ──────────────────────────────────────────────────────────

export async function getProperty(req: Request, res: Response): Promise<void> {
  const viewerUserId = (req as AuthRequest).userId;

  const result = await getPropertyById(req.params.id);
  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }

  const masked = await applyLocationPrivacy(result.data, viewerUserId);
  res.json(masked);
}

export async function createPropertyHandler(req: AuthRequest, res: Response): Promise<void> {
  const result = await createProperty(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  // Owner always gets exact coordinates on their own property
  res.status(201).json(result.data);
}

export async function updatePropertyHandler(req: AuthRequest, res: Response): Promise<void> {
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
    amenities: req.query.amenities
      ? Array.isArray(req.query.amenities)
        ? (req.query.amenities as string[])
        : [req.query.amenities as string]
      : undefined,
    latitude: req.query.latitude ? Number(req.query.latitude) : undefined,
    longitude: req.query.longitude ? Number(req.query.longitude) : undefined,
    radius_km: req.query.radius_km ? Number(req.query.radius_km) : undefined,
    checkIn: req.query.checkIn as string,
    checkOut: req.query.checkOut as string,
    sortBy: req.query.sortBy as AdvancedSearchFilters['sortBy'],
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  };

  const result = await advancedSearch(filters);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  await trackSearch(filters.query || '', result.data.length, undefined, filters);

  // Search results are always public — redact coordinates
  const redacted = result.data.map((p) =>
    redactExactCoordinates(p as { id: string; latitude?: number; longitude?: number }) as unknown as Record<string, unknown>,
  );

  res.json({ data: redacted, count: redacted.length, page: filters.page });
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
    const ranges = await setAvailabilityRanges(req.params.id, req.userId!, req.body.ranges);
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

export async function duplicatePropertyHandler(req: AuthRequest, res: Response): Promise<void> {
  const requesterId = req.userId;
  if (!requesterId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const copyImages = req.query.copyImages === 'true';
  const result = await duplicateProperty(req.params.id, requesterId, { copyImages });

  if (!result.success) {
    const status = result.error?.startsWith('Forbidden')
      ? 403
      : result.error === 'Property not found'
        ? 404
        : 400;
    res.status(status).json({ error: result.error });
    return;
  }

  res.status(201).json(result.data);
}
