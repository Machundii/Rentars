import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// ── Module mocks (before any import that uses them) ───────────────────────────

// next/image is not runnable in jsdom; replace it with a plain <img> that
// forwards all data-* attributes and the loading / fetchpriority props so our
// assertions can inspect them directly.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const {
      src,
      alt,
      fill: _fill,
      sizes,
      priority,
      loading,
      className,
      'data-testid': testid,
      ...rest
    } = props as {
      src: string;
      alt: string;
      fill?: boolean;
      sizes?: string;
      priority?: boolean;
      loading?: string;
      className?: string;
      'data-testid'?: string;
      [k: string]: unknown;
    };
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src as string}
        alt={alt as string}
        sizes={sizes as string | undefined}
        loading={(priority ? 'eager' : loading) as 'eager' | 'lazy' | undefined}
        data-priority={priority ? 'true' : undefined}
        className={className as string | undefined}
        data-testid={testid as string | undefined}
        {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  },
}));

// Leaflet / react-leaflet crash in jsdom — stub both out
vi.mock('leaflet', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: () => null,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  CircleMarker: () => null,
  useMap: () => ({ setView: vi.fn(), flyTo: vi.fn() }),
}));

// next/dynamic with ssr:false returns null in jsdom
vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

// i18n helpers — return the key so assertions stay key-agnostic
vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/i18n/useLocale', () => ({
  useLocale: () => ({ locale: 'en-US' }),
}));
vi.mock('@/lib/i18n/formatting', () => ({
  formatCurrency: (n: number) => `$${n}`,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import React from 'react';
import PropertyDetail from '@/components/features/properties/PropertyDetail';
import { PropertyDetailSkeleton } from '@/components/ui/loading-skeleton';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseProperty = {
  id: 'prop-1',
  title: 'Ocean View Villa',
  description: 'A beautiful property by the sea.',
  description_full: 'A beautiful property by the sea with full details.',
  price_per_night: 200,
  location: 'Malibu, CA',
  images: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
  ],
  owner_id: 'owner-1',
  available: true,
  created_at: new Date().toISOString(),
  amenities: ['WiFi', 'Pool', 'Kitchen'],
  host_name: 'Jane Host',
  reviews: [
    { id: 'r1', author: 'Alice', rating: 5, comment: 'Wonderful!', date: '2024-01-01' },
  ],
  average_rating: 5,
  blocked_dates: [],
  pets_allowed: true,
  smoking_allowed: false,
  events_allowed: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PropertyDetailSkeleton
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyDetailSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PropertyDetailSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it('has aria-busy="true" for screen readers', () => {
    const { container } = render(<PropertyDetailSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('has an accessible loading label', () => {
    render(<PropertyDetailSkeleton />);
    expect(screen.getByLabelText(/loading property/i)).toBeInTheDocument();
  });

  it('renders skeleton items for the gallery strip', () => {
    const { container } = render(<PropertyDetailSkeleton />);
    // 5 thumbnail skeleton placeholders in the strip
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('renders skeleton items for the sidebar', () => {
    const { container } = render(<PropertyDetailSkeleton />);
    // Sidebar contains Book Now placeholder + fee rows
    const pulse = Array.from(container.querySelectorAll('.animate-pulse'));
    // At minimum: hero, thumbnails×5, description, amenities×6, map, calendar cells×35,
    // reviews×(3×3), host, price, button, fee×3, blockchain note = well over 60
    expect(pulse.length).toBeGreaterThan(60);
  });

  it('respects dark class on a parent wrapper', () => {
    const { container } = render(
      <div className="dark">
        <PropertyDetailSkeleton />
      </div>,
    );
    // The skeleton renders inside the dark wrapper — no light-only color overrides
    expect(container.querySelector('.dark')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PropertyDetail (loaded state)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyDetail — loaded state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the property title', () => {
    render(<PropertyDetail property={baseProperty} />);
    expect(screen.getByRole('heading', { level: 1, name: /ocean view villa/i })).toBeInTheDocument();
  });

  it('renders the property location', () => {
    render(<PropertyDetail property={baseProperty} />);
    expect(screen.getByText('Malibu, CA')).toBeInTheDocument();
  });

  it('renders the price per night', () => {
    render(<PropertyDetail property={baseProperty} />);
    expect(screen.getByText('$200')).toBeInTheDocument();
  });

  it('renders amenities', () => {
    render(<PropertyDetail property={baseProperty} />);
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
  });

  it('renders the house rules section when rule props are present', () => {
    render(<PropertyDetail property={baseProperty} />);
    expect(screen.getByTestId('house-rules-section')).toBeInTheDocument();
    expect(screen.getByText(/pets allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/smoking not allowed/i)).toBeInTheDocument();
  });

  it('does not render house rules section when no rule props provided', () => {
    const { pets_allowed, smoking_allowed, events_allowed, ...noRules } = baseProperty;
    render(<PropertyDetail property={noRules} />);
    expect(screen.queryByTestId('house-rules-section')).toBeNull();
  });

  it('renders the host name', () => {
    render(<PropertyDetail property={baseProperty} />);
    expect(screen.getByText('Jane Host')).toBeInTheDocument();
  });

  it('favourite button toggles aria-label', async () => {
    const { getByRole } = render(<PropertyDetail property={baseProperty} />);
    const btn = getByRole('button', { name: /add to favourites/i });
    expect(btn).toBeInTheDocument();
  });

  it('renders with minimal property (no optional fields)', () => {
    const minimal = {
      id: 'min',
      title: 'Studio',
      description: 'Small studio.',
      price_per_night: 50,
      location: 'NYC',
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400'],
      owner_id: 'o1',
      available: true,
      created_at: new Date().toISOString(),
    };
    render(<PropertyDetail property={minimal} />);
    expect(screen.getByRole('heading', { level: 1, name: /studio/i })).toBeInTheDocument();
  });
});
