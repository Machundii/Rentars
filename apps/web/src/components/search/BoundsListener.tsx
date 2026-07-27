'use client';

import { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import type { LatLngBounds } from 'leaflet';

interface BoundsListenerProps {
  onBoundsChanged: (bounds: LatLngBounds) => void;
  debounceMs?: number;
}

export default function BoundsListener({
  onBoundsChanged,
  debounceMs = 400,
}: BoundsListenerProps) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBoundsRef = useRef<LatLngBounds | null>(null);

  const handleBoundsChange = (bounds: LatLngBounds) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!lastBoundsRef.current || !boundsEqual(lastBoundsRef.current, bounds)) {
        lastBoundsRef.current = bounds;
        onBoundsChanged(bounds);
      }
    }, debounceMs);
  };

  useMapEvents({
    moveend: (e) => handleBoundsChange(e.target.getBounds()),
    zoomend: (e) => handleBoundsChange(e.target.getBounds()),
  });

  return null;
}

function boundsEqual(a: LatLngBounds, b: LatLngBounds): boolean {
  const tolerance = 0.0001;
  return (
    Math.abs(a.getNorth() - b.getNorth()) < tolerance &&
    Math.abs(a.getSouth() - b.getSouth()) < tolerance &&
    Math.abs(a.getEast() - b.getEast()) < tolerance &&
    Math.abs(a.getWest() - b.getWest()) < tolerance
  );
}
