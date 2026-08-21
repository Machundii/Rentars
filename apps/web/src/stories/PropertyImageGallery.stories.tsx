import type { Meta, StoryObj } from '@storybook/react';
import PropertyImageGallery from '@/components/features/properties/PropertyImageGallery';

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof PropertyImageGallery> = {
  title: 'Features/PropertyImageGallery',
  component: PropertyImageGallery,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<typeof PropertyImageGallery>;

// ── Shared fixtures ───────────────────────────────────────────────────────────

const IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200',
];

// ── Stories ───────────────────────────────────────────────────────────────────

/**
 * Multiple images — hero is prioritized, rest are lazy.
 *
 * **How to verify in Storybook:**
 * 1. Open browser DevTools → Network → filter by "Img".
 * 2. The first image (`photo-1566073…`) is fetched immediately (priority/eager).
 * 3. The remaining carousel images are **not** fetched on initial render.
 * 4. Thumbnail images are fetched at a smaller size (64 px srcset variant).
 */
export const MultipleImages: Story = {
  args: {
    images: IMAGES,
    title: 'Beachfront Villa',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hero image loads eagerly with `priority`; all other images are lazy-loaded. ' +
          'Thumbnails use a 64 px `sizes` hint for minimal bandwidth.',
      },
    },
  },
};

/**
 * Single image — no thumbnail strip, no carousel navigation.
 */
export const SingleImage: Story = {
  args: {
    images: [IMAGES[0]],
    title: 'Cozy Apartment',
  },
};

/**
 * No images — verifies the empty-state fallback renders without errors.
 */
export const NoImages: Story = {
  args: {
    images: [],
    title: 'Property without photos',
  },
  parameters: {
    docs: {
      description: { story: 'Empty `images` array renders the no-images placeholder.' },
    },
  },
};

/**
 * Many images — stress-tests the thumbnail strip overflow scroll and dot
 * indicator count.
 */
export const ManyImages: Story = {
  args: {
    images: [...IMAGES, ...IMAGES, ...IMAGES].slice(0, 12),
    title: 'Large Gallery',
  },
};
