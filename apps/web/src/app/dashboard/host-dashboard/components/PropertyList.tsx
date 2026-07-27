'use client';

import { useState } from 'react';
import type { HostProperty } from '../types';
import { Edit2, Calendar, Star } from 'lucide-react';
import CalendarModal from './CalendarModal';
import PropertyViewStats from './PropertyViewStats';

interface PropertyListProps {
  properties: HostProperty[];
  onEdit?: (property: HostProperty) => void;
}

export default function PropertyList({
  properties,
  onEdit,
}: PropertyListProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [expandedViewId, setExpandedViewId] = useState<string | null>(null);

  const handleCalendarClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setCalendarOpen(true);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Your Properties</h3>
        </div>

        <div className="divide-y">
          {properties.map((property) => (
            <div key={property.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={property.image}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{property.title}</h4>
                    <p className="text-sm text-gray-500">{property.location}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-blue-600 font-medium">
                        {property.pricePerNight} USDC/night
                      </span>
                      <span className="text-gray-500">{property.bookings} bookings</span>
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-yellow-500 fill-yellow-500" aria-hidden="true" />
                        <span className="text-gray-600">{property.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle view stats — host-only, not publicly visible */}
                  <button
                    onClick={() =>
                      setExpandedViewId(expandedViewId === property.id ? null : property.id)
                    }
                    className="p-2 hover:bg-gray-200 rounded-lg transition"
                    title={expandedViewId === property.id ? 'Hide view stats' : 'Show view stats'}
                    aria-expanded={expandedViewId === property.id}
                    aria-label={`View stats for ${property.title}`}
                  >
                    {/* Eye icon inline to avoid new import */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-600"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleCalendarClick(property.id)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition"
                    title="Manage availability"
                    aria-label={`Manage availability for ${property.title}`}
                  >
                    <Calendar size={18} className="text-gray-600" aria-hidden="true" />
                  </button>

                  <button
                    onClick={() => onEdit?.(property)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition"
                    title="Edit property"
                    aria-label={`Edit ${property.title}`}
                  >
                    <Edit2 size={18} className="text-gray-600" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* View stats panel — only rendered when expanded (host-only) */}
              {expandedViewId === property.id && (
                <div className="mt-3">
                  <PropertyViewStats propertyId={property.id} days={30} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedPropertyId && (
        <CalendarModal
          isOpen={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          propertyId={selectedPropertyId}
        />
      )}
    </>
  );
}
