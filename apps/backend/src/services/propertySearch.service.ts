import { supabase } from '@/config/supabase.js';
import type { ServiceResponse } from './index.js';
import type { Property } from './property.service.js';

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

export async function searchPropertiesByQuery(query: string): Promise<ServiceResponse<Property[]>> {
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

  // Score using denormalized rating aggregates for reputation boost
  // Score = avg_rating * log(1 + review_count); unreviewed properties score 0
  const scored = properties.map((p) => {
    const score = p.average_rating && p.review_count && p.review_count > 0
      ? (p.average_rating as number) * Math.log1p(p.review_count as number)
      : 0;
    return { property: p, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return { success: true, data: scored.map((s) => s.property) };
}

