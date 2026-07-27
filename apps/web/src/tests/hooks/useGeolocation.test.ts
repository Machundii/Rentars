import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';

// ── Mock reverseGeocodeCoords ────────────────────────────────────────────────
vi.mock('@/hooks/useLocationSearch', () => ({
  reverseGeocodeCoords: vi.fn(),
}));

import { reverseGeocodeCoords } from '@/hooks/useLocationSearch';
const mockReverseGeocode = vi.mocked(reverseGeocodeCoords);

// ── Geolocation API mock helpers ─────────────────────────────────────────────
function mockGeolocationSuccess(lat = 51.505, lng = -0.09) {
  const getCurrentPosition = vi.fn((onSuccess: PositionCallback) => {
    onSuccess({
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    writable: true,
    configurable: true,
  });
  return getCurrentPosition;
}

function mockGeolocationError(code: number, message: string) {
  const getCurrentPosition = vi.fn(
    (_: PositionCallback, onError: PositionErrorCallback) => {
      onError({ code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    },
  );
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    writable: true,
    configurable: true,
  });
}

function removeGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with null position, null label, null error, not loading', () => {
      const { result } = renderHook(() => useGeolocation());
      expect(result.current.position).toBeNull();
      expect(result.current.label).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('successful location + reverse geocode', () => {
    it('resolves position and label, calls onLocation callback', async () => {
      mockGeolocationSuccess(51.505, -0.09);
      mockReverseGeocode.mockResolvedValue({ label: 'London, England, United Kingdom' });

      const onLocation = vi.fn();
      const { result } = renderHook(() => useGeolocation({ onLocation }));

      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.position).toEqual({ lat: 51.505, lng: -0.09 });
      expect(result.current.label).toBe('London, England, United Kingdom');
      expect(result.current.error).toBeNull();
      expect(onLocation).toHaveBeenCalledOnce();
      expect(onLocation).toHaveBeenCalledWith(
        { lat: 51.505, lng: -0.09 },
        'London, England, United Kingdom',
      );
    });

    it('calls reverseGeocodeCoords with the obtained coordinates', async () => {
      mockGeolocationSuccess(48.8566, 2.3522);
      mockReverseGeocode.mockResolvedValue({ label: 'Paris, Île-de-France, France' });

      const { result } = renderHook(() => useGeolocation());
      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockReverseGeocode).toHaveBeenCalledWith(48.8566, 2.3522);
    });

    it('sets label to null and still calls onLocation when reverse geocode returns null', async () => {
      mockGeolocationSuccess(0, 0);
      mockReverseGeocode.mockResolvedValue(null);

      const onLocation = vi.fn();
      const { result } = renderHook(() => useGeolocation({ onLocation }));

      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.position).toEqual({ lat: 0, lng: 0 });
      expect(result.current.label).toBeNull();
      expect(onLocation).toHaveBeenCalledWith({ lat: 0, lng: 0 }, null);
    });

    it('sets label to null when reverse geocode rejects', async () => {
      mockGeolocationSuccess(10, 10);
      mockReverseGeocode.mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() => useGeolocation());

      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.position).toEqual({ lat: 10, lng: 10 });
      // reverseGeocodeCoords itself swallows errors and returns null —
      // confirm the hook surfaces null rather than throwing.
      expect(result.current.label).toBeNull();
    });
  });

  describe('permission denial', () => {
    it('sets a friendly error message and no position', async () => {
      mockGeolocationError(1, 'User denied Geolocation');

      const { result } = renderHook(() => useGeolocation());
      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.position).toBeNull();
      expect(result.current.label).toBeNull();
      expect(result.current.error).toMatch(/denied/i);
      expect(result.current.error).toMatch(/permission/i);
    });
  });

  describe('position unavailable', () => {
    it('sets a friendly unavailable message', async () => {
      mockGeolocationError(2, 'Position unavailable');

      const { result } = renderHook(() => useGeolocation());
      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toMatch(/unavailable/i);
    });
  });

  describe('timeout', () => {
    it('sets a friendly timeout message', async () => {
      mockGeolocationError(3, 'Timeout');

      const { result } = renderHook(() => useGeolocation());
      act(() => { result.current.locate(); });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toMatch(/timed out/i);
    });
  });

  describe('geolocation unsupported', () => {
    it('sets an unsupported error without calling getCurrentPosition', () => {
      removeGeolocation();

      const { result } = renderHook(() => useGeolocation());
      act(() => { result.current.locate(); });

      expect(result.current.error).toMatch(/not supported/i);
      expect(result.current.loading).toBe(false);
      expect(mockReverseGeocode).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('is true while waiting for geolocation', () => {
      // getCurrentPosition never resolves — simulates pending state.
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: vi.fn() },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useGeolocation());
      act(() => { result.current.locate(); });

      expect(result.current.loading).toBe(true);
    });
  });
});
