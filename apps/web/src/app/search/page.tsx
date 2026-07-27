'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchBar from '@/components/features/search/SearchBar';
import FilterSidebar, { type FilterState } from '@/components/search/FilterSidebar';
import SortOptions from '@/components/search/SortOptions';
import PropertyMap from '@/components/search/PropertyMap';
import PropertyGrid from '@/components/search/PropertyGrid';
import { useProperties } from '@/hooks/useProperties';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { useGeolocation, type GeoPosition } from '@/hooks/useGeolocation';
import { useNearbyProperties, geocodeAddress } from '@/hooks/useLocationSearch';
import { useTranslations } from '@/lib/i18n/useTranslations';
import type { LatLngBounds } from 'leaflet';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const t = useTranslations('search');

  const [filters, setFilters] = useState<FilterState>({
    priceMin: 0,
    priceMax: 1000,
    amenities: [],
    guests: 1,
    propertyType: '',
  });
  const [sortBy, setSortBy] = useState('recommended');
  const [showMap, setShowMap] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string | undefined>();
  const [mapBounds, setMapBounds] = useState<{
    west: number; south: number; east: number; north: number;
  } | undefined>();

  /** Controlled value for the search input — updated when reverse geocoding resolves. */
  const [searchValue, setSearchValue] = useState('');

  const q = searchParams.get('q') || searchParams.get('location') || undefined;

  const { properties: searched, isLoading: isSearching, error: searchError } = usePropertySearch(q);
  const { properties: filtered, isLoading: isFiltering, error } = useProperties({
    location: searchParams.get('location') || undefined,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    amenities: filters.amenities,
    guests: filters.guests,
    propertyType: filters.propertyType,
    sortBy,
    bounds: mapBounds,
  });

  const [nearbyParams, setNearbyParams] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const { properties: nearbyProps, isLoading: nearbyLoading } = useNearbyProperties(nearbyParams);

  /**
   * Called by PropertyMap when the user's location is resolved.
   * Populates the search field with the readable label and triggers a radius search.
   */
  const handleUserLocation = useCallback((position: GeoPosition, label: string | null) => {
    if (label) setSearchValue(label);
    setNearbyParams({ lat: position.lat, lng: position.lng, radius: 10 });
    setShowMap(true);
  }, []);

  // Separate geolocation instance for the "near me" toolbar button (outside the map).
  const handleToolbarLocation = useCallback((position: GeoPosition, label: string | null) => {
    if (label) setSearchValue(label);
    setNearbyParams({ lat: position.lat, lng: position.lng, radius: 10 });
    setShowMap(true);
  }, []);

  const {
    loading: geoLoading,
    error: geoError,
    locate,
  } = useGeolocation({ onLocation: handleToolbarLocation });

  const properties = nearbyParams
    ? nearbyProps
    : q
    ? searched
    : filtered;
  const isLoading = nearbyParams ? nearbyLoading : q ? isSearching : isFiltering;
  const apiError = q ? searchError : error;

  const handleSearch = useCallback(async (query: string) => {
    setSearchValue(query);
    const geo = await geocodeAddress(query);
    if (geo) {
      setNearbyParams({ lat: geo.lat, lng: geo.lng, radius: 15 });
    }
    const params = new URLSearchParams();
    params.set('q', query);
    window.history.pushState(null, '', `/search?${params.toString()}`);
  }, []);

  const handleBoundsChanged = useCallback((bounds: LatLngBounds) => {
    setMapBounds({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }, []);

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
          <SearchBar
            onSearch={handleSearch}
            placeholder={t('placeholder')}
            value={searchValue}
          />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {isLoading
                ? t('searching')
                : t('propertiesCount', { count: properties.length })}
            </span>
            <SortOptions onSortChange={setSortBy} currentSort={sortBy} />
          </div>

          <div className="flex items-center gap-2">
            {/* "Near me" toolbar button — uses its own geolocation instance */}
            <button
              onClick={() => locate()}
              disabled={geoLoading}
              aria-label={geoLoading ? 'Finding your location…' : 'Find properties near me'}
              className="px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7z" />
                <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
              </svg>
              {geoLoading ? t('locating') : t('nearMe')}
            </button>

            <button
              onClick={() => setShowMap(false)}
              className={`px-4 py-2 border rounded-lg text-sm font-semibold transition ${
                !showMap ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {t('list')}
            </button>
            <button
              onClick={() => setShowMap(true)}
              className={`px-4 py-2 border rounded-lg text-sm font-semibold transition ${
                showMap ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {t('map')}
            </button>
          </div>
        </div>

        {/* Geo-error from toolbar button */}
        {geoError && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3"
          >
            {geoError}
          </div>
        )}

        {showMap && (
          <div className="mb-8">
            <PropertyMap
              properties={properties}
              activePropertyId={activePropertyId}
              onPropertyClick={(id) => { window.location.href = `/property/${id}`; }}
              onBoundsChanged={handleBoundsChanged}
              onUserLocation={handleUserLocation}
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-8">
          <div className="col-span-1">
            <FilterSidebar onFilterChange={setFilters} />
          </div>

          <div className="col-span-3">
            <div onMouseLeave={() => setActivePropertyId(undefined)}>
              <PropertyGrid
                properties={properties}
                loading={isLoading}
                error={apiError}
                onRetry={() => {
                  if (q) handleSearch(q);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
