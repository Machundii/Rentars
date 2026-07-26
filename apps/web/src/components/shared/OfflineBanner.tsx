'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Non-intrusive sticky offline banner.
 *
 * - Appears at the top of the page when the browser goes offline.
 * - Briefly shows a "back online" confirmation then auto-dismisses.
 * - Does not render anything while online (zero DOM footprint).
 * - Accessible: role=status, aria-live=polite, dismissible.
 */
export function OfflineBanner() {
  const { isOnline, justReconnected } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // When the connection is restored show the "back online" toast briefly
  useEffect(() => {
    if (justReconnected) {
      setShowReconnected(true);
      setDismissed(false);
      const id = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(id);
    }
  }, [justReconnected]);

  // Reset dismiss state when going offline again
  useEffect(() => {
    if (!isOnline) setDismissed(false);
  }, [isOnline]);

  // Nothing to render when fully online and no reconnect toast
  if (isOnline && !showReconnected) return null;
  if (dismissed) return null;

  const isReconnectedToast = isOnline && showReconnected;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="offline-banner"
      className={`
        fixed top-0 inset-x-0 z-[9999]
        flex items-center justify-between
        px-4 py-3 text-sm font-medium
        transition-all duration-300
        ${isReconnectedToast
          ? 'bg-green-600 text-white'
          : 'bg-amber-500 text-white dark:bg-amber-600'
        }
      `}
    >
      <div className="flex items-center gap-2">
        {isReconnectedToast ? (
          <Wifi size={16} aria-hidden="true" />
        ) : (
          <WifiOff size={16} aria-hidden="true" />
        )}
        <span>
          {isReconnectedToast
            ? "You're back online."
            : "You're offline — some features may be unavailable."}
        </span>
      </div>

      {!isReconnectedToast && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline notification"
          className="ml-4 p-1 rounded hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-white"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
