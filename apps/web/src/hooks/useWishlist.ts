'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEBOUNCE_DELAY = 300;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

interface PendingToggle {
  propertyId: string;
  shouldBeInWishlist: boolean;
}

export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTogglesRef = useRef<Map<string, PendingToggle>>(new Map());
  const lastStateRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_URL}/api/wishlists`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: { property_id: string }[]) => {
        const ids = new Set(data.map((item) => item.property_id));
        setWishlistIds(ids);
        lastStateRef.current = new Set(ids);
      })
      .catch(() => {
        setError('Failed to load wishlists');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const processPendingToggles = useCallback(async () => {
    if (pendingTogglesRef.current.size === 0) return;

    const token = getToken();
    if (!token) return;

    const pendingArray = Array.from(pendingTogglesRef.current.values());
    pendingTogglesRef.current.clear();

    for (const toggle of pendingArray) {
      try {
        const response = await fetch(`${API_URL}/api/wishlists/${toggle.propertyId}`, {
          method: toggle.shouldBeInWishlist ? 'POST' : 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to ${toggle.shouldBeInWishlist ? 'add to' : 'remove from'} wishlist`);
        }

        lastStateRef.current = new Set(wishlistIds);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to update wishlist';
        setError(errorMsg);
        toast.error(errorMsg);

        setWishlistIds((prev) => new Set(lastStateRef.current));
      }
    }
  }, [wishlistIds]);

  const toggle = useCallback(
    (propertyId: string) => {
      const token = getToken();
      if (!token) {
        toast.error('Please log in to use wishlist');
        return;
      }

      const isInWishlist = wishlistIds.has(propertyId);
      const shouldBeInWishlist = !isInWishlist;

      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (shouldBeInWishlist) {
          next.add(propertyId);
        } else {
          next.delete(propertyId);
        }
        return next;
      });

      pendingTogglesRef.current.set(propertyId, {
        propertyId,
        shouldBeInWishlist,
      });

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        processPendingToggles();
      }, DEBOUNCE_DELAY);
    },
    [wishlistIds, processPendingToggles],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    wishlistIds,
    isLoading,
    error,
    toggle,
    isInWishlist: (id: string) => wishlistIds.has(id),
    getWishlistCount: () => wishlistIds.size,
  };
}
