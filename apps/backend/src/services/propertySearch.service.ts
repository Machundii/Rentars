import { supabase } from '@/config/supabase.js';
import type { ServiceResponse } from './index.js';
import { isFeaturedNow, FEATURED_CAP, type Property, type AdvancedSearchFilters } from './property.service.js';

// ─── Nearby search ────────────────────────────────────────────────────────────

export interface NearbySearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface NearbySearchResult {
  id: string;
  title: string;
  price_per_night?: number;
  city?: string;
  country?: string;
  bedrooms?: number;
  amenities?: string[];
  distance_km: number;
  /** True when the property is currently within its feature window. */
  is_featured?: boolean;
}

/**
 * Return properties within `radiusKm` of the given point, ordered by
 * distance ascending.  Delegates to the `search_nearby_properties` SQL
 * function which uses a PostGIS GIST-indexed ST_DWithin predicate for an
 * efficient bounding-box pre-filter followed by precise distance calculation.
 */
export async function searchPropertiesNearby(
  params: NearbySearchParams,
): Promise<ServiceResponse<NearbySearchResult[]>> {
  const { lat, lng, radiusKm } = params;

  const { data, error } = await supabase.rpc('search_nearby_properties', {
    lat,
    lng,
    radius_km: radiusKm,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as NearbySearchResult[] };
}

// ─── Text-search helpers ──────────────────────────────────────────────────────

function toTsQuery(input: string) {
  // Convert spaces to prefix tsquery tokens and sanitize basic characters.
  // Example: "new york" -> "new:* & york:*"
  const tokens = input
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9_-]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return '';
  return tokens.map((t) => `${t}:*`).join(' & ');
}

// ─── Featured promotion helpers ───────────────────────────────────────────────

/**
 * Given a flat list of properties from a search query, promote up to
 * `cap` currently-featured properties to the front of the list.
 *
 * Properties that are featured but did NOT match the search query are NOT
 * injected — this function only re-orders what was already returned.  That
 * keeps pagination counts accurate and avoids showing irrelevant results.
 *
 * The returned list is:
 *   [ ...featured (≤ cap, sorted by featured_weight DESC), ...organic ]
 *
 * Each featured property gets `is_featured: true` appended so the frontend
 * can render the badge without a second request.
 *
 * @param properties - Full result set from the search query.
 * @param cap        - Maximum number of featured slots (defaults to FEATURED_CAP).
 */
export function promoteFeatureToTop(
  properties: Property[],
  cap = FEATURED_CAP,
): (Property & { is_featured: boolean })[] {
  const effectiveCap = Math.min(Math.max(0, cap), FEATURED_CAP);

  const featured: (Property & { is_featured: boolean })[] = [];
  const organic:  (Property & { is_featured: boolean })[] = [];

  for (const p of properties) {
    if (featured.length < effectiveCap && isFeaturedNow(p)) {
      featured.push({ ...p, is_featured: true });
    } else {
      organic.push({ ...p, is_featured: false });
    }
  }

  // Sort the featured slot by weight descending so higher-weight listings
  // always appear first regardless of the order they came out of the query.
  featured.sort((a, b) => (b.featured_weight ?? 0) - (a.featured_weight ?? 0));

  return [...featured, ...organic];
}

// ─── Text-based property search ───────────────────────────────────────────────

export async function searchPropertiesByQuery(
  query: string,
): Promise<ServiceResponse<(Property & { is_featured: boolean })[]>> {
  const q = query.trim();
  if (!q) return { success: true, data: [] };

  const tsQuery = toTsQuery(q);
  if (!tsQuery) return { success: true, data: [] };

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    // Uses generated column search_vector + GIN index
    .textSearch('search_vector', tsQuery, { config: 'english' })
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const properties = (data ?? []) as Property[];
  if (properties.length === 0) return { success: true, data: [] };

  // Score using denormalized rating aggregates for reputation boost.
  // Score = avg_rating * log(1 + review_count); unreviewed properties score 0.
  const scored = properties.map((p) => {
    const score =
      p.average_rating && p.review_count && p.review_count > 0
        ? (p.average_rating as number) * Math.log1p(p.review_count as number)
        : 0;
    return { property: p, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const sorted = scored.map((s) => s.property);

  // Promote featured listings to the top (capped at FEATURED_CAP).
  return { success: true, data: promoteFeatureToTop(sorted) };
}

// ─── Zero-result relaxed suggestions ──────────────────────────────────────────

export interface ZeroResultSuggestion {
  type: 'no_amenities' | 'wider_price' | 'expand_radius' | 'any_location';
  description: string;
  estimated_results: number;
  relaxed_filters: Partial<AdvancedSearchFilters>;
}

/**
 * When a search yields zero results, compute which single-filter relaxations
 * would yield results and how many. Returns only relaxations that help.
 */
export async function computeZeroResultSuggestions(
  filters: AdvancedSearchFilters,
): Promise<ZeroResultSuggestion[]> {
  const suggestions: ZeroResultSuggestion[] = [];

  const countWithFilters = async (overrides: Partial<AdvancedSearchFilters>): Promise<number> => {
    const merged = { ...filters, ...overrides };
    let q = supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'available');

    if (merged.query) {
      const tokens = merged.query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9_-]/g, ''))
        .filter(Boolean);
      if (tokens.length > 0) {
        q = q.textSearch('search_vector', tokens.map((t) => `${t}:*`).join(' & '), {
          config: 'english',
        });
      }
    }

    if (merged.city) q = q.ilike('city', `%${merged.city}%`);
    if (merged.country) q = q.ilike('country', `%${merged.country}%`);
    if (merged.min_price !== undefined) q = q.gte('price_per_night', merged.min_price);
    if (merged.max_price !== undefined) q = q.lte('price_per_night', merged.max_price);
    if (merged.bedrooms !== undefined) q = q.gte('bedrooms', merged.bedrooms);
    if (merged.guests !== undefined) q = q.gte('max_guests', merged.guests);
    if (merged.amenities && merged.amenities.length > 0) {
      q = q.contains('amenities', merged.amenities);
    }

    const { count } = await q;
    return count ?? 0;
  };

  const candidates: Array<{
    type: ZeroResultSuggestion['type'];
    description: string;
    overrides: Partial<AdvancedSearchFilters>;
  }> = [];

  if (filters.amenities && filters.amenities.length > 0) {
    candidates.push({
      type: 'no_amenities',
      description: 'Remove amenity filters',
      overrides: { amenities: [] },
    });
  }

  if (filters.min_price !== undefined || filters.max_price !== undefined) {
    candidates.push({
      type: 'wider_price',
      description: 'Remove price range filter',
      overrides: { min_price: undefined, max_price: undefined },
    });
  }

  if (filters.radius_km !== undefined && filters.latitude !== undefined) {
    candidates.push({
      type: 'expand_radius',
      description: `Expand search radius to ${(filters.radius_km ?? 50) * 2} km`,
      overrides: { radius_km: (filters.radius_km ?? 50) * 2 },
    });
  }

  if (filters.city || filters.country) {
    candidates.push({
      type: 'any_location',
      description: 'Search all locations',
      overrides: { city: undefined, country: undefined },
    });
  }

  await Promise.all(
    candidates.map(async (c) => {
      const count = await countWithFilters(c.overrides);
      if (count > 0) {
        suggestions.push({
          type: c.type,
          description: c.description,
          estimated_results: count,
          relaxed_filters: c.overrides,
        });
      }
    }),
  );

  return suggestions.sort((a, b) => b.estimated_results - a.estimated_results);
}
