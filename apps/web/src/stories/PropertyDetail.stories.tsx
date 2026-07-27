import type { Meta, StoryObj } from '@storybook/react';
import PropertyDetail from '@/components/features/properties/PropertyDetail';
import { PropertyDetailSkeleton } from '@/components/ui/loading-skeleton';

// ── Shared fixture ────────────────────────────────────────────────────────────

const baseProperty = {
  id: 'prop-1',
  title: 'Beachfront Villa with Ocean Views',
  description: 'A stunning villa perched right on the shoreline with panoramic views.',
  description_full:
    'A stunning villa perched right on the shoreline with panoramic views. ' +
    'Sleeps up to 8 guests across 4 beautifully appointed bedrooms. ' +
    'The open-plan kitchen and living space opens onto a private deck with a pool. ' +
    'Direct beach access via a private path. Perfect for families and groups.',
  price_per_night: 350,
  location: 'Malibu, CA',
  images: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
  ],
  owner_id: 'owner-1',
  available: true,
  created_at: new Date().toISOString(),
  amenities: ['WiFi', 'Pool', 'Kitchen', 'Parking', 'Air Conditioning', 'Washer'],
  host_name: 'Alexandra Smith',
  host_image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  reviews: [
    {
      id: 'r1',
      author: 'James T.',
      rating: 5,
      comment: 'Absolutely breathtaking. Woke up to the sound of the waves every morning.',
      date: '2024-06-15',
    },
    {
      id: 'r2',
      author: 'Priya K.',
      rating: 4,
      comment: 'Beautiful property, very well equipped. The beach access is a dream.',
      date: '2024-05-20',
    },
  ],
  average_rating: 4.5,
  blocked_dates: ['2024-08-10', '2024-08-11', '2024-08-12'],
  pets_allowed: true,
  smoking_allowed: false,
  events_allowed: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  additional_rules: 'Please leave the property as you found it.',
  max_guests: 8,
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof PropertyDetail> = {
  title: 'Features/PropertyDetail',
  component: PropertyDetail,
  tags: ['autodocs'],
  parameters: {
    // Give the canvas enough horizontal space for the 3-column layout.
    layout: 'fullscreen',
    // Disable Storybook's default padding so the component's own max-w/mx-auto takes effect.
    docs: { canvas: { withToolbar: true } },
  },
};
export default meta;

type Story = StoryObj<typeof PropertyDetail>;

// ── Stories ───────────────────────────────────────────────────────────────────

/** Fully populated property — the "happy path" loaded state. */
export const Loaded: Story = {
  args: {
    property: baseProperty,
  },
};

/** Property with only required fields — no optional sections rendered. */
export const Minimal: Story = {
  args: {
    property: {
      id: 'prop-min',
      title: 'Studio Apartment',
      description: 'A compact studio in the heart of the city.',
      price_per_night: 80,
      location: 'New York, NY',
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200'],
      owner_id: 'owner-2',
      available: true,
      created_at: new Date().toISOString(),
    },
  },
};

/** No images — verifies the empty-gallery fallback renders without crashing. */
export const NoImages: Story = {
  args: {
    property: { ...baseProperty, images: [] },
  },
};

/**
 * Loading skeleton — shown while the server fetch resolves.
 * Rendered separately so designers can compare skeleton vs. content side-by-side.
 */
export const Loading: StoryObj<typeof PropertyDetailSkeleton> = {
  render: () => <PropertyDetailSkeleton />,
  name: 'Loading (skeleton)',
  parameters: {
    // Override the component so autodocs links back to the skeleton.
    docs: { description: { story: 'Layout-matching skeleton shown while property data loads.' } },
  },
};

/** Dark-mode variant — verifies skeleton colours follow the theme. */
export const LoadingDark: StoryObj<typeof PropertyDetailSkeleton> = {
  render: () => <PropertyDetailSkeleton />,
  name: 'Loading — dark theme',
  parameters: {
    backgrounds: { default: 'dark' },
    docs: { description: { story: 'Skeleton in dark mode — bg-muted adjusts automatically.' } },
  },
  decorators: [
    (Story) => (
      <div className="dark bg-gray-950 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
