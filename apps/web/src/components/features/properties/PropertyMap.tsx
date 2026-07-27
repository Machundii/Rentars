'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), {
  ssr: false,
});
const Circle = dynamic(() => import('react-leaflet').then((m) => m.Circle), { ssr: false });

interface POI {
  name: string;
  lat: number;
  lng: number;
  type: string;
  distance?: number; // km
}

interface PropertyMapProps {
  location: string;
  /** Exact latitude — present only for authorised viewers (host / confirmed tenant) */
  latitude?: number;
  /** Exact longitude — present only for authorised viewers (host / confirmed tenant) */
  longitude?: number;
  /** Approximate latitude returned for public viewers */
  approximate_latitude?: number;
  /** Approximate longitude returned for public viewers */
  approximate_longitude?: number;
  /** Uncertainty radius in metres for the approximate location circle */
  location_radius_m?: number;
  /** Show nearby POIs (requires resolved coordinates) */
  showPOIs?: boolean;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchPOIs(lat: number, lng: number): Promise<POI[]> {
  const delta = 0.02;
  const query = `[out:json][timeout:10];(
    node["amenity"~"restaurant|cafe|supermarket|hospital|pharmacy|bus_stop|subway_entrance"](${lat - delta},${lng - delta},${lat + delta},${lng + delta});
  );out 15;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements ?? []).slice(0, 15).map((el: { lat: number; lon: number; tags?: Record<string, string> }) => ({
      name: el.tags?.name || el.tags?.amenity || 'Point of interest',
      lat: el.lat,
      lng: el.lon,
      type: el.tags?.amenity || 'poi',
      distance: haversineKm(lat, lng, el.lat, el.lon),
    }));
  } catch {
    return [];
  }
}

const POI_COLORS: Record<string, string> = {
  restaurant: '#f97316',
  cafe: '#a16207',
  supermarket: '#16a34a',
  hospital: '#dc2626',
  pharmacy: '#9333ea',
  bus_stop: '#0284c7',
  subway_entrance: '#0284c7',
};

export default function PropertyMap({
  location,
  latitude,
  longitude,
  approximate_latitude,
  approximate_longitude,
  location_radius_m = 500,
  showPOIs = true,
}: PropertyMapProps) {
  const [pois, setPOIs] = useState<POI[]>([]);

  // Prefer exact coordinates; fall back to approximate
  const hasExact = typeof latitude === 'number' && typeof longitude === 'number';
  const hasApprox =
    typeof approximate_latitude === 'number' && typeof approximate_longitude === 'number';

  const hasCoords = hasExact || hasApprox;

  const displayLat = hasExact ? latitude! : approximate_latitude!;
  const displayLng = hasExact ? longitude! : approximate_longitude!;
  const center: [number, number] = hasCoords ? [displayLat, displayLng] : [40.7128, -74.006];

  useEffect(() => {
    if (!hasCoords || !showPOIs) return;
    fetchPOIs(displayLat, displayLng).then(setPOIs);
  }, [displayLat, displayLng, hasCoords, showPOIs]);

  if (!hasCoords) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
        Location: {location} (coordinates not available)
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Privacy notice for approximate locations */}
      {!hasExact && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          Approximate location shown. Exact address is shared after booking confirmation.
        </div>
      )}

      <div className="w-full h-96 rounded-xl overflow-hidden shadow-sm">
        <MapContainer
          center={center}
          zoom={hasExact ? 15 : 13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {hasExact ? (
            /* Exact pin for authorised viewers */
            <CircleMarker
              center={center}
              radius={12}
              pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.9, weight: 3 }}
            >
              <Popup>
                <strong>Property location</strong>
                <br />
                {location}
              </Popup>
            </CircleMarker>
          ) : (
            /* Uncertainty circle for public / unauthenticated viewers */
            <Circle
              center={center}
              radius={location_radius_m}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#93c5fd',
                fillOpacity: 0.25,
                weight: 2,
              }}
            >
              <Popup>
                <strong>Approximate area</strong>
                <br />
                Exact location shared after booking
              </Popup>
            </Circle>
          )}

          {/* POI pins — only shown when we have a reliable centre point */}
          {pois.map((poi, i) => (
            <CircleMarker
              key={i}
              center={[poi.lat, poi.lng]}
              radius={7}
              pathOptions={{
                color: POI_COLORS[poi.type] || '#6b7280',
                fillColor: POI_COLORS[poi.type] || '#6b7280',
                fillOpacity: 0.8,
                weight: 1,
              }}
            >
              <Popup>
                <strong>{poi.name}</strong>
                <br />
                <span className="capitalize text-xs text-gray-500">{poi.type}</span>
                {poi.distance !== undefined && (
                  <>
                    <br />
                    <span className="text-xs">{poi.distance.toFixed(2)} km away</span>
                  </>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* POI legend */}
      {pois.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
          {Object.entries(POI_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {type.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
