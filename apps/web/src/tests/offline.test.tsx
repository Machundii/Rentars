/**
 * Tests for offline detection and handling.
 *
 * Covers:
 * 1. useOnlineStatus hook — initial state, offline/online events, justReconnected flag.
 * 2. OfflineBanner — hidden when online, visible when offline, dismissible,
 *    shows reconnect toast, auto-dismisses reconnect toast.
 * 3. OfflineGate — renders children when online, shows offline message when offline,
 *    overlay mode masks children.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  renderHook,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { OfflineGate } from '@/components/shared/OfflineGate';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — simulate browser online/offline events
// ─────────────────────────────────────────────────────────────────────────────

function goOffline() {
  Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  fireEvent(window, new Event('offline'));
}

function goOnline() {
  Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
  fireEvent(window, new Event('online'));
}

// Restore to online between tests
beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. useOnlineStatus hook
// ─────────────────────────────────────────────────────────────────────────────

describe('useOnlineStatus', () => {
  it('is true when browser is online', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.justReconnected).toBe(false);
  });

  it('becomes false when the offline event fires', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => goOffline());

    expect(result.current.isOnline).toBe(false);
  });

  it('becomes true again when the online event fires', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => goOffline());
    expect(result.current.isOnline).toBe(false);

    act(() => goOnline());
    expect(result.current.isOnline).toBe(true);
  });

  it('sets justReconnected=true immediately after coming back online', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => goOffline());
    act(() => goOnline());

    expect(result.current.justReconnected).toBe(true);
  });

  it('resets justReconnected to false after the next tick', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOnlineStatus());

    act(() => goOffline());
    act(() => goOnline());

    expect(result.current.justReconnected).toBe(true);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.justReconnected).toBe(false);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OfflineBanner
// ─────────────────────────────────────────────────────────────────────────────

describe('OfflineBanner', () => {
  // Use real timers for most tests; individual tests opt into fake timers
  const user = userEvent.setup();

  it('renders nothing when online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the offline banner when the browser goes offline', () => {
    render(<OfflineBanner />);

    act(() => goOffline());

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });

  it('has role="status" and aria-live="polite" for accessibility', () => {
    render(<OfflineBanner />);
    act(() => goOffline());
    const banner = screen.getByTestId('offline-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('can be dismissed with the close button', () => {
    render(<OfflineBanner />);
    act(() => goOffline());

    const dismissBtn = screen.getByRole('button', { name: /dismiss offline/i });
    // Use fireEvent to avoid userEvent's internal timer dependency
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('shows green reconnected banner after coming back online', async () => {
    render(<OfflineBanner />);

    act(() => goOffline());
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();

    act(() => goOnline());
    await waitFor(() => {
      expect(screen.getByText(/you're back online/i)).toBeInTheDocument();
    });
  });

  it('auto-dismisses the reconnected toast after 3 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render(<OfflineBanner />);

      act(() => goOffline());
      act(() => goOnline());

      // The banner should show the reconnected state
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
      expect(screen.getByText(/you're back online/i)).toBeInTheDocument();

      // Advance past the 3-second dismiss timer
      act(() => vi.advanceTimersByTime(3100));

      // Banner should now be gone
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets dismiss state and shows banner again when going offline a second time', () => {
    render(<OfflineBanner />);

    // First offline → dismiss
    act(() => goOffline());
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    // Come back online briefly
    act(() => goOnline());

    // Go offline again — banner should re-appear
    act(() => goOffline());
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. OfflineGate
// ─────────────────────────────────────────────────────────────────────────────

describe('OfflineGate', () => {
  it('renders children transparently when online', () => {
    render(
      <OfflineGate>
        <button>Book Now</button>
      </OfflineGate>,
    );
    expect(screen.getByRole('button', { name: /book now/i })).toBeInTheDocument();
    expect(screen.queryByTestId('offline-gate')).not.toBeInTheDocument();
  });

  it('replaces children with an offline message when offline', () => {
    act(() => goOffline());
    render(
      <OfflineGate message="Booking requires a connection.">
        <button>Book Now</button>
      </OfflineGate>,
    );
    expect(screen.queryByRole('button', { name: /book now/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('offline-gate')).toBeInTheDocument();
    expect(screen.getByText(/booking requires a connection/i)).toBeInTheDocument();
  });

  it('uses the default message when none is provided', () => {
    act(() => goOffline());
    render(
      <OfflineGate>
        <span>content</span>
      </OfflineGate>,
    );
    expect(screen.getByText(/requires an internet connection/i)).toBeInTheDocument();
  });

  it('overlay mode renders children AND the offline overlay', () => {
    act(() => goOffline());
    render(
      <OfflineGate overlay message="Offline">
        <button>Book Now</button>
      </OfflineGate>,
    );
    // Children still in DOM (but aria-hidden)
    const childWrapper = document.querySelector('[aria-hidden="true"]');
    expect(childWrapper).toBeInTheDocument();
    // Overlay present
    expect(screen.getByTestId('offline-gate')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('overlay mode marks children with pointer-events-none', () => {
    act(() => goOffline());
    render(
      <OfflineGate overlay>
        <button>Click me</button>
      </OfflineGate>,
    );
    const hiddenWrapper = document.querySelector('.pointer-events-none');
    expect(hiddenWrapper).toBeInTheDocument();
  });

  it('gate has accessible role="status" and aria-label', () => {
    act(() => goOffline());
    render(<OfflineGate><span>x</span></OfflineGate>);
    const gate = screen.getByTestId('offline-gate');
    expect(gate).toHaveAttribute('role', 'status');
    expect(gate).toHaveAttribute('aria-label', expect.stringContaining('Offline'));
  });
});
