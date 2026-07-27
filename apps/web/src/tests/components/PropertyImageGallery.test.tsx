import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock next/image ────────────────────────────────────────────────────────────
// Forward all props (including priority and loading) onto a real <img> element
// so our assertions can inspect them without the Next.js runtime.
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    sizes,
    priority,
    loading,
    className,
    'data-testid': testid,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    priority?: boolean;
    loading?: string;
    className?: string;
    'data-testid'?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : (loading as 'eager' | 'lazy' | undefined)}
      data-priority={priority ? 'true' : undefined}
      className={className}
      data-testid={testid}
    />
  ),
}));

import PropertyImageGallery from '@/components/features/properties/PropertyImageGallery';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
];

const TITLE = 'Ocean View Villa';

// ═══════════════════════════════════════════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyImageGallery — empty state', () => {
  it('renders the no-images placeholder when images array is empty', () => {
    render(<PropertyImageGallery images={[]} title={TITLE} />);
    expect(screen.getByText(/no images available/i)).toBeInTheDocument();
  });

  it('does not render any img elements when images array is empty', () => {
    const { container } = render(<PropertyImageGallery images={[]} title={TITLE} />);
    expect(container.querySelectorAll('img').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hero image — priority / eager loading
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyImageGallery — hero image prioritisation', () => {
  it('renders the hero image with data-testid="gallery-hero-image"', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    expect(screen.getByTestId('gallery-hero-image')).toBeInTheDocument();
  });

  it('hero image has loading="eager" (priority flag is forwarded)', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const hero = screen.getByTestId('gallery-hero-image') as HTMLImageElement;
    expect(hero.getAttribute('loading')).toBe('eager');
  });

  it('hero image has data-priority="true"', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const hero = screen.getByTestId('gallery-hero-image') as HTMLImageElement;
    expect(hero.getAttribute('data-priority')).toBe('true');
  });

  it('hero image has a meaningful alt text', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const hero = screen.getByTestId('gallery-hero-image') as HTMLImageElement;
    expect(hero.alt).toMatch(/ocean view villa/i);
    expect(hero.alt).toMatch(/image 1/i);
  });

  it('hero image carries the correct responsive sizes attribute', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const hero = screen.getByTestId('gallery-hero-image') as HTMLImageElement;
    const sizes = hero.getAttribute('sizes') ?? '';
    // Should reference a viewport-based media query and 100vw fallback
    expect(sizes).toMatch(/vw/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Non-hero carousel images — lazy loading
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyImageGallery — carousel lazy loading', () => {
  it('non-hero carousel images have loading="lazy"', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const img1 = screen.getByTestId('gallery-image-1') as HTMLImageElement;
    const img2 = screen.getByTestId('gallery-image-2') as HTMLImageElement;
    expect(img1.getAttribute('loading')).toBe('lazy');
    expect(img2.getAttribute('loading')).toBe('lazy');
  });

  it('non-hero carousel images do NOT have data-priority', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const img1 = screen.getByTestId('gallery-image-1');
    expect(img1.getAttribute('data-priority')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Thumbnail strip — lazy + small sizes
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyImageGallery — thumbnail strip', () => {
  it('renders one thumbnail per image', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    // data-testid gallery-thumbnail-0, -1, -2
    expect(screen.getByTestId('gallery-thumbnail-0')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-thumbnail-1')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-thumbnail-2')).toBeInTheDocument();
  });

  it('thumbnails are lazy-loaded', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    for (let i = 0; i < IMAGES.length; i++) {
      const thumb = screen.getByTestId(`gallery-thumbnail-${i}`) as HTMLImageElement;
      expect(thumb.getAttribute('loading')).toBe('lazy');
    }
  });

  it('thumbnails have a narrow sizes hint (64px)', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const thumb = screen.getByTestId('gallery-thumbnail-0') as HTMLImageElement;
    expect(thumb.getAttribute('sizes')).toBe('64px');
  });

  it('does not render thumbnail strip for a single image', () => {
    render(<PropertyImageGallery images={[IMAGES[0]]} title={TITLE} />);
    expect(screen.queryByTestId('gallery-thumbnail-0')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Lightbox
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyImageGallery — lightbox', () => {
  it('lightbox is not rendered on initial load', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens lightbox on overlay click', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /open image lightbox/i }));
    expect(screen.getByRole('dialog', { name: /lightbox/i })).toBeInTheDocument();
  });

  it('lightbox image has loading="eager"', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /open image lightbox/i }));
    const lightboxImg = screen.getByTestId('gallery-lightbox-image') as HTMLImageElement;
    expect(lightboxImg.getAttribute('loading')).toBe('eager');
  });

  it('lightbox image uses full-width sizes hint', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /open image lightbox/i }));
    const lightboxImg = screen.getByTestId('gallery-lightbox-image') as HTMLImageElement;
    const sizes = lightboxImg.getAttribute('sizes') ?? '';
    expect(sizes).toMatch(/100vw/);
  });

  it('closes lightbox when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /open image lightbox/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close lightbox/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes lightbox on Escape key', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /open image lightbox/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Carousel navigation
// ═══════════════════════════════════════════════════════════════════════════════

describe('PropertyImageGallery — carousel navigation', () => {
  it('shows the image counter "1 / 3" initially', () => {
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    expect(screen.getAllByText('1 / 3')[0]).toBeInTheDocument();
  });

  it('advances to the next image when next button is clicked', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /next image/i }));
    expect(screen.getAllByText('2 / 3')[0]).toBeInTheDocument();
  });

  it('wraps around from last image back to first', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    const nextBtn = screen.getByRole('button', { name: /next image/i });
    await user.click(nextBtn);
    await user.click(nextBtn);
    await user.click(nextBtn);
    expect(screen.getAllByText('1 / 3')[0]).toBeInTheDocument();
  });

  it('thumbnail click switches active image', async () => {
    const user = userEvent.setup();
    render(<PropertyImageGallery images={IMAGES} title={TITLE} />);
    await user.click(screen.getByRole('button', { name: /view image 3/i }));
    expect(screen.getAllByText('3 / 3')[0]).toBeInTheDocument();
  });
});
