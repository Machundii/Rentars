'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterSidebarProps {
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  priceMin: number;
  priceMax: number;
  amenities: string[];
  guests: number;
  checkIn?: string;
  checkOut?: string;
  propertyType: string;
  bedrooms?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'distance' | 'rating';
}

const AMENITIES = [
  'WiFi', 'Kitchen', 'Parking', 'Pool', 'Gym',
  'Washer', 'Dryer', 'AC', 'Heating', 'TV', 'Balcony',
];
const PROPERTY_TYPES = ['Apartment', 'House', 'Villa', 'Condo', 'Studio'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'distance', label: 'Distance' },
  { value: 'rating', label: 'Rating' },
];

export default function FilterSidebar({ onFilterChange }: FilterSidebarProps) {
  const id = useId();

  const [filters, setFilters] = useState<FilterState>({
    priceMin: 0,
    priceMax: 1000,
    amenities: [],
    guests: 1,
    propertyType: '',
    bedrooms: undefined,
    sortBy: 'newest',
  });

  const [expandedSections, setExpandedSections] = useState({
    sort: true,
    price: true,
    amenities: true,
    guests: true,
    bedrooms: false,
    type: true,
    dates: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  // ── Section toggle button ─────────────────────────────────────────────────

  function SectionHeader({
    section,
    label,
  }: {
    section: keyof typeof expandedSections;
    label: string;
  }) {
    const panelId = `${id}-panel-${section}`;
    const btnId = `${id}-btn-${section}`;
    const isOpen = expandedSections[section];
    return (
      <button
        id={btnId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => toggleSection(section)}
        className="flex items-center justify-between w-full font-semibold mb-4
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
      >
        {label}
        <ChevronDown
          size={20}
          aria-hidden="true"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
    );
  }

  // ── Shared panel wrapper ──────────────────────────────────────────────────

  function Panel({
    section,
    children,
  }: {
    section: keyof typeof expandedSections;
    children: React.ReactNode;
  }) {
    const panelId = `${id}-panel-${section}`;
    const btnId = `${id}-btn-${section}`;
    if (!expandedSections[section]) return null;
    return (
      <div id={panelId} role="region" aria-labelledby={btnId}>
        {children}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6 h-fit sticky top-8">
      {/* Sort */}
      <div>
        <button
          onClick={() => toggleSection('sort')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Sort By
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.sort ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.sort && (
          <div className="space-y-2">
            {SORT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sortBy"
                  value={option.value}
                  checked={filters.sortBy === option.value}
                  onChange={() => update({ sortBy: option.value as FilterState['sortBy'] })}
                  className="rounded-full focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      {/* Price Range --------------------------------------------------------- */}
      <div>
        <button
          onClick={() => toggleSection('price')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Price Range
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.price ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.price && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Min: ${filters.priceMin}</label>
              <input
                id={`${id}-price-min`}
                type="range"
                min="0"
                max="1000"
                value={filters.priceMin}
                onChange={(e) => update({ priceMin: Number(e.target.value) })}
                aria-valuemin={0}
                aria-valuemax={1000}
                aria-valuenow={filters.priceMin}
                aria-valuetext={`$${filters.priceMin}`}
                className="w-full accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Max: ${filters.priceMax}</label>
              <input
                id={`${id}-price-max`}
                type="range"
                min="0"
                max="1000"
                value={filters.priceMax}
                onChange={(e) => update({ priceMax: Number(e.target.value) })}
                aria-valuemin={0}
                aria-valuemax={1000}
                aria-valuenow={filters.priceMax}
                aria-valuetext={`$${filters.priceMax}`}
                className="w-full accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Bedrooms ------------------------------------------------------------ */}
      <div>
        <button
          onClick={() => toggleSection('bedrooms')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Bedrooms
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.bedrooms ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.bedrooms && (
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                onClick={() => handleBedroomsChange(filters.bedrooms === num ? undefined : num)}
                className={`px-3 py-2 rounded border transition text-sm ${
                  filters.bedrooms === num
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Amenities ----------------------------------------------------------- */}
      <div>
        <button
          onClick={() => toggleSection('amenities')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Amenities
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.amenities ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.amenities && (
          <div className="space-y-2">
            {AMENITIES.map((amenity) => (
              <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.amenities.includes(amenity)}
                  onChange={() => {
                    const next = filters.amenities.includes(amenity)
                      ? filters.amenities.filter((a) => a !== amenity)
                      : [...filters.amenities, amenity];
                    update({ amenities: next });
                  }}
                  className="rounded focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{amenity}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      {/* Guests -------------------------------------------------------------- */}
      <div>
        <button
          onClick={() => toggleSection('guests')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Guests
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.guests ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.guests && (
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 4, 6, 8].map((num) => (
              <button
                key={num}
                onClick={() => handleGuestsChange(num)}
                className={`px-3 py-2 rounded border transition text-sm ${
                  filters.guests === num
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Property Type ------------------------------------------------------- */}
      <div>
        <button
          onClick={() => toggleSection('type')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Property Type
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.type ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.type && (
          <div className="space-y-2">
            {PROPERTY_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="propertyType"
                  value={type}
                  checked={filters.propertyType === type}
                  onChange={() => update({ propertyType: type })}
                  className="rounded-full focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      {/* Dates --------------------------------------------------------------- */}
      <div>
        <button
          onClick={() => toggleSection('dates')}
          className="flex items-center justify-between w-full font-semibold mb-4 text-gray-900 dark:text-gray-100"
        >
          Dates
          <ChevronDown
            size={20}
            className={`transition text-gray-600 dark:text-gray-400 ${expandedSections.dates ? 'rotate-180' : ''}`}
          />
        </button>
        {expandedSections.dates && (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Check In</label>
              <input
                id={`${id}-check-in`}
                type="date"
                value={filters.checkIn || ''}
                onChange={(e) => handleDateChange('checkIn', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Check Out</label>
              <input
                id={`${id}-check-out`}
                type="date"
                value={filters.checkOut || ''}
                onChange={(e) => handleDateChange('checkOut', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
