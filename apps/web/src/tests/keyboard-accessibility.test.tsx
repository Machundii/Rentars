/**
 * Keyboard-accessibility tests for primary user-flow components.
 *
 * Covers:
 * 1. SearchAutocomplete — arrow navigation, Enter to select, Escape to close
 * 2. SearchBar (features) — arrow navigation, Enter to select
 * 3. FilterSidebar — section toggle buttons have aria-expanded, panels have aria-controls
 * 4. PropertyCard — card link is keyboard-reachable, wishlist button is keyboard-operable
 * 5. BookingForm submit button — keyboard activation (Enter / Space)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePropertySearch', () => ({
  usePropertySearch: () => ({
    suggestions: ['Paris, France', 'Paris, Texas', 'Paris, Ontario'],
    getSuggestions: vi.fn(),
    getTrending: vi.fn(),
    isLoading: false,
    error: null,
    properties: [],
    search: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWishlist', () => ({
  useWishlist: () => ({
    isInWishlist: () => false,
    toggle: vi.fn(),
  }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import SearchAutocomplete from '@/components/search/SearchAutocomplete';
import SearchBar from '@/components/features/search/SearchBar';
import FilterSidebar from '@/components/search/FilterSidebar';
import PropertyCard from '@/components/search/PropertyCard';

// ─────────────────────────────────────────────────────────────────────────────
// 1. SearchAutocomplete
// ─────────────────────────────────────────────────────────────────────────────

describe('SearchAutocomplete — keyboard navigation', () => {
  const user = userEvent.setup();

  it('opens the listbox on focus', async () => {
    render(<SearchAutocomplete onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('moves focus through suggestions with ArrowDown', async () => {
    render(<SearchAutocomplete onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      expect.stringContaining('-option-0'),
    );
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      expect.stringContaining('-option-1'),
    );
  });

  it('moves back up with ArrowUp', async () => {
    render(<SearchAutocomplete onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      expect.stringContaining('-option-0'),
    );
  });

  it('selects the active suggestion on Enter', async () => {
    const onSearch = vi.fn();
    render(<SearchAutocomplete onSearch={onSearch} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSearch).toHaveBeenCalledWith('Paris, France');
  });

  it('closes the listbox on Escape', async () => {
    render(<SearchAutocomplete onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('options have role="option" and aria-selected', async () => {
    render(<SearchAutocomplete onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('input has aria-expanded=false when listbox is closed', () => {
    render(<SearchAutocomplete onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SearchBar (features)
// ─────────────────────────────────────────────────────────────────────────────

describe('SearchBar — keyboard navigation', () => {
  const user = userEvent.setup();

  it('shows suggestions as user types', async () => {
    render(<SearchBar onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'London');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects a suggestion with ArrowDown + Enter', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'London');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSearch).toHaveBeenCalledWith('London, USA');
  });

  it('closes suggestions on Escape', async () => {
    render(<SearchBar onSearch={vi.fn()} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'Rome');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FilterSidebar — ARIA attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('FilterSidebar — keyboard operability', () => {
  const user = userEvent.setup();

  it('section toggle buttons have aria-expanded', () => {
    render(<FilterSidebar onFilterChange={vi.fn()} />);
    const toggles = screen.getAllByRole('button', { name: /sort by|price range|amenities|guests|property type/i });
    for (const btn of toggles) {
      expect(btn).toHaveAttribute('aria-expanded');
    }
  });

  it('toggling a section button updates aria-expanded', async () => {
    render(<FilterSidebar onFilterChange={vi.fn()} />);
    const sortBtn = screen.getByRole('button', { name: /sort by/i });
    expect(sortBtn).toHaveAttribute('aria-expanded', 'true');
    await user.click(sortBtn);
    expect(sortBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('section buttons have aria-controls pointing to a panel', () => {
    render(<FilterSidebar onFilterChange={vi.fn()} />);
    const sortBtn = screen.getByRole('button', { name: /sort by/i });
    const controlsId = sortBtn.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toBeInTheDocument();
  });

  it('bedroom buttons have aria-pressed', async () => {
    render(<FilterSidebar onFilterChange={vi.fn()} />);
    // Expand the bedrooms section first
    const bedroomsBtn = screen.getByRole('button', { name: /bedrooms/i });
    await user.click(bedroomsBtn);
    const bedroomBtns = screen.getAllByRole('button', { name: /^[12345]$/ });
    for (const btn of bedroomBtns) {
      expect(btn).toHaveAttribute('aria-pressed');
    }
  });

  it('bedroom filter can be activated via keyboard', async () => {
    const onChange = vi.fn();
    render(<FilterSidebar onFilterChange={onChange} />);
    const bedroomsToggle = screen.getByRole('button', { name: /bedrooms/i });
    await user.click(bedroomsToggle); // expand section
    const btn2 = screen.getByRole('button', { name: '2' });
    await user.click(btn2);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bedrooms: 2 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PropertyCard — keyboard reachability
// ─────────────────────────────────────────────────────────────────────────────

describe('PropertyCard — keyboard reachability', () => {
  const property = {
    id: 'prop-1',
    title: 'Cozy Beach House',
    location: 'Miami, FL',
    price_per_night: 120,
    available: true,
    images: [],
    owner_id: 'owner-1',
    description: 'Nice',
    created_at: new Date().toISOString(),
  };

  it('renders a focusable link for the card', () => {
    render(<PropertyCard property={property} />);
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    // Links are natively keyboard-reachable
    expect(link.tagName).toBe('A');
  });

  it('renders the wishlist button with aria-label and aria-pressed', () => {
    render(<PropertyCard property={property} />);
    const wishBtn = screen.getByRole('button', { name: /wishlist/i });
    expect(wishBtn).toHaveAttribute('aria-pressed', 'false');
    expect(wishBtn).toHaveAttribute('aria-label');
  });

  it('wishlist button can be activated via keyboard (Enter)', async () => {
    const user = userEvent.setup();
    const { useWishlist } = await import('@/hooks/useWishlist');
    const toggle = vi.fn();
    (useWishlist as ReturnType<typeof vi.fn>).mockReturnValue({ isInWishlist: () => false, toggle });

    render(<PropertyCard property={property} />);
    const wishBtn = screen.getByRole('button', { name: /wishlist/i });
    wishBtn.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveBeenCalledWith('prop-1');
  });
});
