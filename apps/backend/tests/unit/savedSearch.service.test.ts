import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { matchesSavedSearchSync, type SavedSearchFilters } from '../../src/services/savedSearch.service.js';
import type { Property } from '../../src/services/property.service.js';

// ── Helper ────────────────────────────────────────────────────────────────────

const baseProperty: Pick<Property, 'title' | 'city' | 'country' | 'price_per_night' | 'bedrooms' | 'bathrooms' | 'max_guests' | 'amenities' | 'property_type'> = {
  title: 'Beach House Miami',
  city: 'Miami',
  country: 'US',
  price_per_night: 150,
  bedrooms: 3,
  bathrooms: 2,
  max_guests: 6,
  amenities: ['WiFi', 'Pool', 'Kitchen'],
  property_type: 'House',
};

// ── Price ─────────────────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — price', () => {
  it('matches when price is within range', () => {
    expect(matchesSavedSearchSync(baseProperty, { min_price: 100, max_price: 200 })).toBe(true);
  });

  it('rejects when price is below min_price', () => {
    expect(matchesSavedSearchSync(baseProperty, { min_price: 200 })).toBe(false);
  });

  it('rejects when price is above max_price', () => {
    expect(matchesSavedSearchSync(baseProperty, { max_price: 100 })).toBe(false);
  });

  it('matches when only min_price is set and property meets it', () => {
    expect(matchesSavedSearchSync(baseProperty, { min_price: 100 })).toBe(true);
  });

  it('matches when only max_price is set and property meets it', () => {
    expect(matchesSavedSearchSync(baseProperty, { max_price: 200 })).toBe(true);
  });

  it('matches when no price filter is set', () => {
    expect(matchesSavedSearchSync(baseProperty, {})).toBe(true);
  });
});

// ── Location ──────────────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — location', () => {
  it('matches city (case-insensitive partial)', () => {
    expect(matchesSavedSearchSync(baseProperty, { city: 'miami' })).toBe(true);
  });

  it('rejects non-matching city', () => {
    expect(matchesSavedSearchSync(baseProperty, { city: 'New York' })).toBe(false);
  });

  it('matches country (case-insensitive)', () => {
    expect(matchesSavedSearchSync(baseProperty, { country: 'us' })).toBe(true);
  });

  it('rejects non-matching country', () => {
    expect(matchesSavedSearchSync(baseProperty, { country: 'UK' })).toBe(false);
  });

  it('matches when no location filter is set', () => {
    expect(matchesSavedSearchSync(baseProperty, {})).toBe(true);
  });
});

// ── Bedrooms / Bathrooms / Guests ─────────────────────────────────────────────

describe('matchesSavedSearchSync — capacity', () => {
  it('matches when property has enough bedrooms', () => {
    expect(matchesSavedSearchSync(baseProperty, { bedrooms: 2 })).toBe(true);
  });

  it('rejects when property has fewer bedrooms than required', () => {
    expect(matchesSavedSearchSync(baseProperty, { bedrooms: 5 })).toBe(false);
  });

  it('matches when property has enough bathrooms', () => {
    expect(matchesSavedSearchSync(baseProperty, { min_bathrooms: 1 })).toBe(true);
  });

  it('rejects when property has fewer bathrooms than required', () => {
    expect(matchesSavedSearchSync(baseProperty, { min_bathrooms: 3 })).toBe(false);
  });

  it('matches when property accommodates enough guests', () => {
    expect(matchesSavedSearchSync(baseProperty, { guests: 4 })).toBe(true);
  });

  it('rejects when property cannot accommodate enough guests', () => {
    expect(matchesSavedSearchSync(baseProperty, { guests: 10 })).toBe(false);
  });
});

// ── Property type ─────────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — property type', () => {
  it('matches when property type is in the allowed list', () => {
    expect(matchesSavedSearchSync(baseProperty, { property_types: ['House', 'Villa'] })).toBe(true);
  });

  it('rejects when property type is not in the allowed list', () => {
    expect(matchesSavedSearchSync(baseProperty, { property_types: ['Apartment', 'Condo'] })).toBe(false);
  });
});

// ── Amenities ─────────────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — amenities', () => {
  it('matches when property has all required amenities', () => {
    expect(matchesSavedSearchSync(baseProperty, { amenities: ['WiFi', 'Pool'] })).toBe(true);
  });

  it('rejects when property is missing a required amenity', () => {
    expect(matchesSavedSearchSync(baseProperty, { amenities: ['WiFi', 'Gym'] })).toBe(false);
  });

  it('matches amenities case-insensitively', () => {
    expect(matchesSavedSearchSync(baseProperty, { amenities: ['wifi'] })).toBe(true);
  });
});

// ── Text query ────────────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — query', () => {
  it('matches query against title (case-insensitive contains)', () => {
    expect(matchesSavedSearchSync(baseProperty, { query: 'beach' })).toBe(true);
  });

  it('rejects when title does not contain query', () => {
    expect(matchesSavedSearchSync(baseProperty, { query: 'mountain cabin' })).toBe(false);
  });
});

// ── Combined filters ──────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — combined filters', () => {
  it('matches all filters combined', () => {
    const filters: SavedSearchFilters = {
      city: 'Miami',
      min_price: 100,
      max_price: 200,
      bedrooms: 2,
      guests: 4,
      amenities: ['WiFi'],
      property_types: ['House'],
    };
    expect(matchesSavedSearchSync(baseProperty, filters)).toBe(true);
  });

  it('rejects when one filter out of many fails', () => {
    const filters: SavedSearchFilters = {
      city: 'Miami',
      min_price: 100,
      max_price: 200,
      bedrooms: 2,
      guests: 4,
      amenities: ['WiFi', 'Gym'], // Gym is missing
      property_types: ['House'],
    };
    expect(matchesSavedSearchSync(baseProperty, filters)).toBe(false);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('matchesSavedSearchSync — edge cases', () => {
  it('handles property with null/undefined fields gracefully', () => {
    const sparse: Pick<Property, 'title' | 'city' | 'country' | 'price_per_night' | 'bedrooms' | 'bathrooms' | 'max_guests' | 'amenities' | 'property_type'> = {
      title: 'Minimal Listing',
    };
    // null price/bedrooms/max_guests should NOT cause rejection
    expect(matchesSavedSearchSync(sparse, { min_price: 100, bedrooms: 2, guests: 4 })).toBe(true);
  });

  it('returns true for empty filters (matches everything)', () => {
    expect(matchesSavedSearchSync(baseProperty, {})).toBe(true);
  });
});
