'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

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

interface FilterSidebarProps {
  filters?: Partial<FilterState>;
  onFilterChange: (filters: FilterState) => void;
}

const AMENITIES = [
  'WiFi', 'Kitchen', 'Parking', 'Pool', 'Gym',
  'Washer', 'Dryer', 'AC', 'Heating', 'TV', 'Balcony',
];

const PROPERTY_TYPES = ['Apartment', 'House', 'Villa', 'Condo', 'Studio'];

const SORT_OPTIONS: { value: NonNullable<FilterState['sortBy']>; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'distance',   label: 'Distance' },
  { value: 'rating',     label: 'Rating' },
];

const DEFAULT_FILTERS: FilterState = {
  priceMin: 0,
  priceMax: 1000,
  amenities: [],
  guests: 1,
  propertyType: '',
  bedrooms: undefined,
  sortBy: 'newest',
};

type SectionKey = 'sort' | 'price' | 'amenities' | 'guests' | 'bedrooms' | 'type' | 'dates';

export default function FilterSidebar({ filters: externalFilters, onFilterChange }: FilterSidebarProps) {
  const id = useId();

  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    ...externalFilters,
  });

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    sort:      true,
    price:     true,
    amenities: true,
    guests:    true,
    bedrooms:  false,
    type:      true,
    dates:     true,
  });

  const toggle = (s: SectionKey) => setOpen((prev) => ({ ...prev, [s]: !prev[s] }));

  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const today = new Date().toISOString().split('T')[0];

  // ── Section Header ────────────────────────────────────────────────────────
  function SectionHeader({ section, label }: { section: SectionKey; label: string }) {
    return (
      <button
        id={`${id}-btn-${section}`}
        type="button"
        aria-expanded={open[section]}
        aria-controls={`${id}-panel-${section}`}
        onClick={() => toggle(section)}
        className="flex items-center justify-between w-full font-semibold text-gray-900 dark:text-gray-100
          mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        {label}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`text-gray-500 transition-transform duration-200 ${open[section] ? 'rotate-180' : ''}`}
        />
      </button>
    );
  }

  // ── Collapsible Panel ─────────────────────────────────────────────────────
  function Panel({ section, children }: { section: SectionKey; children: React.ReactNode }) {
    if (!open[section]) return null;
    return (
      <div id={`${id}-panel-${section}`} role="region" aria-labelledby={`${id}-btn-${section}`}>
        {children}
      </div>
    );
  }

  return (
    <aside
      aria-label="Search filters"
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5 h-fit sticky top-8"
    >
      {/* ── Sort ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="sort" label="Sort By" />
        <Panel section="sort">
          <div className="space-y-2">
            {SORT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-sortBy`}
                  value={opt.value}
                  checked={filters.sortBy === opt.value}
                  onChange={() => update({ sortBy: opt.value })}
                  className="accent-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Dates ────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="dates" label="Dates" />
        <Panel section="dates">
          <div className="space-y-3">
            <div>
              <label
                htmlFor={`${id}-check-in`}
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
              >
                Check In
              </label>
              <input
                id={`${id}-check-in`}
                type="date"
                min={today}
                value={filters.checkIn ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  update({
                    checkIn: val || undefined,
                    // Reset check-out when check-in moves past it
                    checkOut: filters.checkOut && val > filters.checkOut ? undefined : filters.checkOut,
                  });
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-check-out`}
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
              >
                Check Out
              </label>
              <input
                id={`${id}-check-out`}
                type="date"
                min={filters.checkIn ?? today}
                value={filters.checkOut ?? ''}
                onChange={(e) => update({ checkOut: e.target.value || undefined })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Price Range ───────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="price" label="Price Range" />
        <Panel section="price">
          <div className="space-y-4">
            <div>
              <label
                htmlFor={`${id}-price-min`}
                className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
              >
                Min: ${filters.priceMin}
              </label>
              <input
                id={`${id}-price-min`}
                type="range"
                min={0}
                max={1000}
                step={10}
                value={filters.priceMin}
                onChange={(e) =>
                  update({ priceMin: Math.min(Number(e.target.value), filters.priceMax - 10) })
                }
                aria-valuemin={0}
                aria-valuemax={1000}
                aria-valuenow={filters.priceMin}
                aria-valuetext={`$${filters.priceMin}`}
                className="w-full accent-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-price-max`}
                className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
              >
                Max: ${filters.priceMax}
              </label>
              <input
                id={`${id}-price-max`}
                type="range"
                min={0}
                max={1000}
                step={10}
                value={filters.priceMax}
                onChange={(e) =>
                  update({ priceMax: Math.max(Number(e.target.value), filters.priceMin + 10) })
                }
                aria-valuemin={0}
                aria-valuemax={1000}
                aria-valuenow={filters.priceMax}
                aria-valuetext={`$${filters.priceMax}`}
                className="w-full accent-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Guests ───────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="guests" label="Guests" />
        <Panel section="guests">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 4, 6, 8].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => update({ guests: filters.guests === num ? 1 : num })}
                aria-pressed={filters.guests === num}
                className={`px-3 py-1.5 rounded-lg border text-sm transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  ${
                    filters.guests === num
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                  }`}
              >
                {num === 8 ? '8+' : num}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Bedrooms ─────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="bedrooms" label="Bedrooms" />
        <Panel section="bedrooms">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => update({ bedrooms: filters.bedrooms === num ? undefined : num })}
                aria-pressed={filters.bedrooms === num}
                className={`px-3 py-1.5 rounded-lg border text-sm transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  ${
                    filters.bedrooms === num
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                  }`}
              >
                {num === 5 ? '5+' : num}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Amenities ────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="amenities" label="Amenities" />
        <Panel section="amenities">
          <div className="space-y-2">
            {AMENITIES.map((amenity) => {
              const checked = filters.amenities.includes(amenity);
              return (
                <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      update({
                        amenities: checked
                          ? filters.amenities.filter((a) => a !== amenity)
                          : [...filters.amenities, amenity],
                      })
                    }
                    className="rounded accent-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{amenity}</span>
                </label>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── Property Type ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeader section="type" label="Property Type" />
        <Panel section="type">
          <div className="space-y-2">
            {PROPERTY_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-propertyType`}
                  value={type}
                  checked={filters.propertyType === type}
                  onChange={() =>
                    update({ propertyType: filters.propertyType === type ? '' : type })
                  }
                  className="accent-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Clear all ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setFilters(DEFAULT_FILTERS);
          onFilterChange(DEFAULT_FILTERS);
        }}
        className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded py-1"
      >
        Clear all filters
      </button>
    </aside>
  );
}
