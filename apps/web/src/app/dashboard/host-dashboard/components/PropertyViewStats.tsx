'use client';

/**
 * PropertyViewStats
 *
 * Displays the view count and a simple 30-day sparkline for a single property.
 * Only fetched and visible to the host (the API enforces this — anonymous
 * users receive 403, so we never show view data publicly).
 */

import { useEffect, useState } from 'react';
import { Eye, TrendingUp } from 'lucide-react';

interface DailyCount {
  date:  string;
  count: number;
}

interface ViewStats {
  total:             number;
  totalFromProperty: number;
  daily:             DailyCount[];
}

interface PropertyViewStatsProps {
  propertyId: string;
  /** Days horizon for the sparkline. Defaults to 30. */
  days?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function useViewStats(propertyId: string, days: number) {
  const [stats,   setStats]   = useState<ViewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/v1/properties/${propertyId}/views?days=${days}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load view stats');
        return r.json() as Promise<ViewStats>;
      })
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [propertyId, days]);

  return { stats, loading, error };
}

/** Tiny SVG sparkline from daily counts. */
function Sparkline({ daily }: { daily: DailyCount[] }) {
  if (daily.length < 2) return null;

  const counts = daily.map((d) => d.count);
  const max    = Math.max(...counts, 1);
  const W      = 120;
  const H      = 32;
  const step   = W / (counts.length - 1);

  const points = counts
    .map((c, i) => `${(i * step).toFixed(1)},${(H - (c / max) * H).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      width={W}
      height={H}
      aria-hidden="true"
      className="text-blue-500"
      viewBox={`0 0 ${W} ${H}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PropertyViewStats({
  propertyId,
  days = 30,
}: PropertyViewStatsProps) {
  const { stats, loading, error } = useViewStats(propertyId, days);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-20" aria-label="Loading view stats" />
    );
  }

  if (error) {
    // Silently hide rather than showing an ugly error — stats are non-critical
    return null;
  }

  if (!stats) return null;

  const displayCount = stats.totalFromProperty ?? stats.total;

  return (
    <div
      className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4"
      aria-label={`Property has been viewed ${displayCount} times in the last ${days} days`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg" aria-hidden="true">
          <Eye size={18} className="text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Views (last {days}d)</p>
          <p className="text-2xl font-bold text-gray-900">{displayCount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <TrendingUp size={12} aria-hidden="true" />
          <span>{days}-day trend</span>
        </div>
        <Sparkline daily={stats.daily} />
      </div>
    </div>
  );
}
