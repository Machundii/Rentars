'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngBounds, Map as LeafletMap } from 'leaflet';
import type { Property } from '@/types/property';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const MarkerClusterGroup = dynamic(() => import('react-leaflet-cluster'), { ssr: false });
const PriceMarker = dynamic(() => import('./PriceMarker'), { ssr: false });
const BoundsListener = dynamic(() => import('./BoundsListener'), { ssr: false });

interface SearchMapProps {
  properties: Property[];
  onPropertyClick: (id: string) => void;
  onBoundsChanged?: (bounds: LatLngBounds) => void;
  activePropertyId?: string;
}

export default function Map({
  properties,
  onPropertyClick,
  onBoundsChanged,
  activePropertyId,
}: SearchMapProps) {
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.006]);
  const [mapKey, setMapKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validProperties = useMemo(
    () =>
      properties.filter(
        (p): p is Property & { lat: number; lng: number } =>
          typeof (p as any).lat === 'number' && typeof (p as any).lng === 'number',
      ),
    [properties],
  );

  useEffect(() => {
    if (validProperties.length === 0) return;
    const lats = validProperties.map((p) => p.lat);
    const lngs = validProperties.map((p) => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    setCenter([midLat, midLng]);
    setMapKey((k) => k + 1);
  }, [validProperties]);

  const handleBoundsChanged = (bounds: LatLngBounds) => {
    if (!onBoundsChanged) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onBoundsChanged(bounds), 350);
  };

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-md bg-gray-200">
      <MapContainer
        key={mapKey}
        center={center}
        zoom={validProperties.length > 0 ? 11 : 3}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {onBoundsChanged && <BoundsListener onBoundsChanged={handleBoundsChanged} />}

        <MarkerClusterGroup chunkedLoading>
          {validProperties.map((property) => (
            <PriceMarker
              key={property.id}
              property={property}
              active={property.id === activePropertyId}
              onClick={() => onPropertyClick(property.id)}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {validProperties.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 text-gray-500 text-sm pointer-events-none">
          No properties with location data
        </div>
      )}
    </div>
  );
}
