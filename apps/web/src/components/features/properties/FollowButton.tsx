'use client';

/**
 * FollowButton — lets a tenant follow or unfollow a host.
 *
 * Behaviour:
 *  - On mount, fetches the current follow status from the API.
 *  - Clicking toggles the follow state optimistically, then confirms with the
 *    API.  On API failure the optimistic update is rolled back.
 *  - While loading the initial status the button is disabled.
 *  - If no `hostId` is provided (e.g. property owner_id is unknown) the
 *    button is not rendered.
 *  - Authentication errors (401) cause the button to link to the login page
 *    rather than attempt the follow.
 */

import { useEffect, useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  /** UUID of the host to follow / unfollow. */
  hostId: string;
  /** Optional extra class names for layout adjustment by the parent. */
  className?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type Status = 'loading' | 'following' | 'not_following' | 'unauthenticated' | 'error';

export default function FollowButton({ hostId, className = '' }: FollowButtonProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [isMutating, setIsMutating] = useState(false);

  // ── Initial status fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hostId) return;

    let cancelled = false;

    async function fetchStatus() {
      try {
        const token = getToken();
        if (!token) {
          if (!cancelled) setStatus('unauthenticated');
          return;
        }

        const res = await fetch(`${API_BASE}/api/v1/follows/hosts/${hostId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (res.status === 401) {
          setStatus('unauthenticated');
          return;
        }

        if (!res.ok) {
          setStatus('error');
          return;
        }

        const body = await res.json() as { following: boolean };
        setStatus(body.following ? 'following' : 'not_following');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [hostId]);

  // ── Toggle follow ───────────────────────────────────────────────────────────
  async function toggle() {
    if (isMutating || status === 'loading') return;

    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const isFollowing = status === 'following';
    // Optimistic update
    setStatus(isFollowing ? 'not_following' : 'following');
    setIsMutating(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/follows/hosts/${hostId}`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // Roll back on failure
        setStatus(isFollowing ? 'following' : 'not_following');
      }
    } catch {
      // Roll back on network error
      setStatus(isFollowing ? 'following' : 'not_following');
    } finally {
      setIsMutating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!hostId) return null;

  if (status === 'unauthenticated') {
    return (
      <a
        href="/login"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 text-sm font-medium transition ${className}`}
      >
        <UserPlus size={16} aria-hidden="true" />
        Follow host
      </a>
    );
  }

  if (status === 'error') return null;

  const isLoading   = status === 'loading';
  const isFollowing = status === 'following';

  return (
    <button
      onClick={toggle}
      disabled={isLoading || isMutating}
      aria-label={isFollowing ? 'Unfollow this host' : 'Follow this host'}
      aria-pressed={isFollowing}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition
        ${isFollowing
          ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
          : 'border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}`}
    >
      {isLoading || isMutating ? (
        <Loader2 size={16} aria-hidden="true" className="animate-spin" />
      ) : isFollowing ? (
        <UserCheck size={16} aria-hidden="true" />
      ) : (
        <UserPlus size={16} aria-hidden="true" />
      )}
      {isLoading ? 'Loading…' : isFollowing ? 'Following' : 'Follow host'}
    </button>
  );
}

// ── Auth token helper ─────────────────────────────────────────────────────────

/**
 * Read the JWT from localStorage.
 * Replace with your actual auth hook/context if you have one centralised.
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}
