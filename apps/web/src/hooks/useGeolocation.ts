'use client';

import { useCallback, useState } from 'react';
import { reverseGeocodeCoords } from './useLocationSearch';

export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface GeolocationState {
  position: GeoPosition | null;
  /** Human-readable place label resolved by reverse geocoding, or null. */
  label: string | null;
  error: string | null;
  loading: boolean;
}

export interface UseGeolocationOptions {
  /**
   * Called once coordinates AND a resolved label are available.
   * `label` is null when reverse geocoding failed (position is still valid).
   */
  onLocation?: (position: GeoPosition, label: string | null) => void;
}

/** Map browser GeolocationPositionError codes to friendly messages. */
function friendlyGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location access was denied. Please allow location permission in your browser settings.';
    case err.POSITION_UNAVAILABLE:
      return 'Your location is currently unavailable. Please try again later.';
    case err.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return err.message || 'Unable to determine your location.';
  }
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const { onLocation } = options;

  const [state, setState] = useState<GeolocationState>({
    position: null,
    label: null,
    error: null,
    loading: false,
  });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        error: 'Geolocation is not supported by your browser.',
      }));
      return;
    }

    setState({ position: null, label: null, error: null, loading: true });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const position: GeoPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        // Optimistically set position while reverse geocoding runs.
        setState({ position, label: null, error: null, loading: true });

        const result = await reverseGeocodeCoords(position.lat, position.lng);
        const label = result?.label ?? null;

        setState({ position, label, error: null, loading: false });
        onLocation?.(position, label);
      },
      (err) => {
        setState({
          position: null,
          label: null,
          error: friendlyGeoError(err),
          loading: false,
        });
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [onLocation]);

  return { ...state, locate };
}
