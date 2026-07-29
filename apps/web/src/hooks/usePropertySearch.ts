import { useState, useCallback, useEffect, useRef } from 'react';
import type { LatLngBounds } from 'leaflet';
import type { FilterState } from '@/components/search/FilterSidebar';

export interface SearchResult {
  id: string;
  title: string;
  price_per_night?: number;
  city?: string;
  country?: string;
  bedrooms?: number;
  max_guests?: number;
  amenities?: string[];
  images?: string[];
  slug?: string;
  distance_km?: number;
  rating?: number;
  review_count?: number;
  is_featured?: boolean;
  /** Approximate latitude (coordinates redacted by server for non-owners) */
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface ZeroResultSuggestion {
  type: 'no_amenities' | 'wider_price' | 'expand_radius' | 'any_location';
  description: string;
  estimated_results: number;
  relaxed_filters: Partial<FilterState>;
}

export interface SearchPage {
  data: SearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface UseSearchOptions {
  debounceMs?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function usePropertySearch(options: UseSearchOptions = {}) {
  const { debounceMs = 300 } = options;

  const [results, setResults]     = useState<SearchResult[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [zeroResultSuggestions, setZeroResultSuggestions] = useState<ZeroResultSuggestion[]>([]);

  const abortRef      = useRef<AbortController | null>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef  = useRef<string>('');
  const lastFiltersRef = useRef<Partial<FilterState>>({});

  // ── Core search ────────────────────────────────────────────────────────────
  const search = useCallback(
    async (query: string, filters: Partial<FilterState> = {}, pageNum = 1) => {
      // Cancel in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);
      lastQueryRef.current   = query;
      lastFiltersRef.current = filters;

      try {
        const params = new URLSearchParams();
        if (query)                          params.set('q', query);
        if (filters.priceMin !== undefined) params.set('min_price', String(filters.priceMin));
        if (filters.priceMax !== undefined) params.set('max_price', String(filters.priceMax));
        if (filters.guests   !== undefined) params.set('guests',    String(filters.guests));
        if (filters.bedrooms !== undefined) params.set('bedrooms',  String(filters.bedrooms));
        if (filters.sortBy)                 params.set('sortBy',    filters.sortBy);
        if (filters.checkIn)                params.set('checkIn',   filters.checkIn);
        if (filters.checkOut)               params.set('checkOut',  filters.checkOut);
        filters.amenities?.forEach((a) => params.append('amenities', a));
        params.set('page',  String(pageNum));
        params.set('limit', '20');

        const res = await fetch(
          `${API_BASE}/api/v1/properties/search/advanced?${params}`,
          { signal: abortRef.current.signal },
        );

        if (!res.ok) throw new Error(`Search failed (${res.status})`);

        const json = await res.json();
        // Backend returns { data, total, page, limit, hasMore, _suggestions? }
        const serverData: SearchResult[] = json.data ?? [];
        const serverTotal: number  = json.total ?? serverData.length;
        const serverPage: number   = json.page  ?? pageNum;
        const serverHasMore: boolean = json.hasMore ?? false;

        // Append on "load more", replace on fresh search
        setResults((prev) => (pageNum > 1 ? [...prev, ...serverData] : serverData));
        setTotal(serverTotal);
        setPage(serverPage);
        setHasMore(serverHasMore);
        setZeroResultSuggestions(json._suggestions ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Search error');
        setResults([]);
        setTotal(0);
        setHasMore(false);
        setZeroResultSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── Load next page ─────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    search(lastQueryRef.current, lastFiltersRef.current, page + 1);
  }, [hasMore, loading, page, search]);

  // ── Map viewport search ────────────────────────────────────────────────────
  const searchByBounds = useCallback(
    (bounds: LatLngBounds, filters: Partial<FilterState> = {}) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
          const params = new URLSearchParams();
          params.set('north', String(bounds.getNorth()));
          params.set('south', String(bounds.getSouth()));
          params.set('east',  String(bounds.getEast()));
          params.set('west',  String(bounds.getWest()));
          if (filters.priceMin !== undefined) params.set('min_price', String(filters.priceMin));
          if (filters.priceMax !== undefined) params.set('max_price', String(filters.priceMax));
          if (filters.guests   !== undefined) params.set('guests',    String(filters.guests));
          if (filters.bedrooms !== undefined) params.set('bedrooms',  String(filters.bedrooms));
          if (filters.checkIn)                params.set('checkIn',   filters.checkIn);
          if (filters.checkOut)               params.set('checkOut',  filters.checkOut);
          filters.amenities?.forEach((a) => params.append('amenities', a));
          params.set('limit', '100');

          const res = await fetch(
            `${API_BASE}/api/v1/properties/search/bounds?${params}`,
            { signal: abortRef.current.signal },
          );

          if (!res.ok) throw new Error('Bounds search failed');

          const json = await res.json();
          setResults(json.data ?? []);
          setTotal(json.total ?? (json.data?.length ?? 0));
          setPage(1);
          setHasMore(false);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search error');
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  // ── Autocomplete suggestions ───────────────────────────────────────────────
  const getSuggestions = useCallback(async (prefix: string) => {
    if (prefix.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/properties/search/suggestions?q=${encodeURIComponent(prefix)}&limit=5`,
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSuggestions(data.map((item: { query?: string }) => item.query ?? '').filter(Boolean));
    } catch {
      setSuggestions([]);
    }
  }, []);

  // ── Trending ───────────────────────────────────────────────────────────────
  const getTrending = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/properties/search/trending`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSuggestions(data.map((item: { query?: string }) => item.query ?? '').filter(Boolean));
    } catch {
      setSuggestions([]);
    }
  }, []);

  // ── Zero-result suggestion click ───────────────────────────────────────────
  const applyZeroResultSuggestion = useCallback(
    async (suggestion: ZeroResultSuggestion, currentFilters: Partial<FilterState> = {}) => {
      fetch(`${API_BASE}/api/v1/properties/search/suggestion-accepted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_type: suggestion.type,
          original_query: lastQueryRef.current,
        }),
      }).catch(() => {});

      const relaxed = { ...currentFilters, ...suggestion.relaxed_filters };
      await search(lastQueryRef.current, relaxed, 1);
    },
    [search],
  );

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    results,
    total,
    page,
    hasMore,
    loading,
    error,
    suggestions,
    zeroResultSuggestions,
    search,
    loadMore,
    searchByBounds,
    getSuggestions,
    getTrending,
    applyZeroResultSuggestion,
  };
}
