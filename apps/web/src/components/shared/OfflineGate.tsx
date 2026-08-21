'use client';

import { type ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface OfflineGateProps {
  children: ReactNode;
  /**
   * Custom message shown when offline.
   * Defaults to the generic "requires internet connection" message.
   */
  message?: string;
  /**
   * When true the children are still rendered but wrapped in a
   * visually-disabled container (for cases where you want to show
   * the UI but indicate it's non-interactive).
   * When false (default) children are replaced by the offline message.
   */
  overlay?: boolean;
}

/**
 * Wraps network-dependent actions so they are disabled and explained
 * when the user is offline.
 *
 * Usage:
 * ```tsx
 * <OfflineGate message="Booking requires an internet connection.">
 *   <BookingForm … />
 * </OfflineGate>
 * ```
 */
export function OfflineGate({ children, message, overlay = false }: OfflineGateProps) {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return <>{children}</>;

  const offlineMessage = message ?? "This action requires an internet connection.";

  if (overlay) {
    return (
      <div className="relative" data-testid="offline-gate">
        {/* Render children but mask them */}
        <div className="pointer-events-none opacity-40 select-none" aria-hidden="true">
          {children}
        </div>
        <div
          className="
            absolute inset-0 flex flex-col items-center justify-center
            bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg
            z-10 gap-3 p-6
          "
          role="status"
          aria-label="Offline — action unavailable"
        >
          <WifiOff size={28} className="text-amber-500" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center max-w-xs">
            {offlineMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        flex flex-col items-center justify-center gap-3
        p-6 rounded-lg border border-amber-200 dark:border-amber-800
        bg-amber-50 dark:bg-amber-900/20
      "
      role="status"
      aria-label="Offline — action unavailable"
      data-testid="offline-gate"
    >
      <WifiOff size={24} className="text-amber-500" aria-hidden="true" />
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300 text-center">
        {offlineMessage}
      </p>
    </div>
  );
}
