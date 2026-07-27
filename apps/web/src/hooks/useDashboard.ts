'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Booking } from '@/types/booking';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
// Use the versioned API path
const BOOKINGS_URL = `${API_URL}/api/v1/bookings`;

/**
 * useDashboard — fetches the current user's bookings with cursor-based
 * pagination so the list stays consistent under concurrent writes.
 *
 * Call `loadMore()` to append the next page. `hasMore` indicates whether
 * another page is available.
 */
export function useDashboard(pageSize = 20) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const initialFetched = useRef(false);

  const fetchPage = useCallback(
    async (cursor: string | null, isFirst: boolean) => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        if (isFirst) setIsLoading(false);
        return;
      }

      if (isFirst) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(`${BOOKINGS_URL}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const body = await res.json();

        // Handle both cursor response { data, nextCursor } and legacy flat array
        if (Array.isArray(body)) {
          setBookings(body as Booking[]);
          setNextCursor(null);
          setHasMore(false);
        } else {
          const page = body as { data: Booking[]; nextCursor: string | null };
          if (isFirst) {
            setBookings(page.data);
          } else {
            setBookings((prev) => {
              const existingIds = new Set(prev.map((b) => b.id));
              const fresh = page.data.filter((b) => !existingIds.has(b.id));
              return [...prev, ...fresh];
            });
          }
          setNextCursor(page.nextCursor);
          setHasMore(page.nextCursor !== null);
        }
      } catch {
        setError('Failed to load bookings');
      } finally {
        if (isFirst) setIsLoading(false);
        else setIsLoadingMore(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;
    fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchPage(nextCursor, false);
  }, [hasMore, isLoadingMore, nextCursor, fetchPage]);

  const refetch = useCallback(() => {
    initialFetched.current = false;
    fetchPage(null, true);
  }, [fetchPage]);

  return { bookings, isLoading, isLoadingMore, hasMore, error, loadMore, refetch };
}
