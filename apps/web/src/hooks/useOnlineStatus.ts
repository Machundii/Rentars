'use client';

import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatus {
  /** Whether the browser reports an active network connection. */
  isOnline: boolean;
  /**
   * True for the brief window just after reconnecting.
   * Components can use this to trigger data refetches.
   */
  justReconnected: boolean;
}

/**
 * Tracks browser online/offline status via the `navigator.onLine` property
 * and the `online` / `offline` window events.
 *
 * `justReconnected` is true for a single render cycle after coming back online,
 * then resets automatically so downstream effects run exactly once.
 *
 * SSR-safe: defaults to `true` on the server (navigator is unavailable).
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [justReconnected, setJustReconnected] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setJustReconnected(true);
    // Reset the flag after one tick so effects fire exactly once
    setTimeout(() => setJustReconnected(false), 0);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setJustReconnected(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, justReconnected };
}
