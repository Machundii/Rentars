import type { Meta, StoryObj } from '@storybook/react';
import {
  Skeleton,
  PropertyCardSkeleton,
  PropertyListSkeleton,
  BookingSkeleton,
} from '@/components/ui/loading-skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/LoadingSkeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

// ── Base Skeleton ─────────────────────────────────────────────────────────────

export const Default: Story = {
  args: { className: 'h-4 w-48' },
};

export const Circle: Story = {
  args: { className: 'h-12 w-12 rounded-full' },
};

export const TextLines: Story = {
  render: () => (
    <div className="space-y-2 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  ),
};

// ── PropertyCardSkeleton ──────────────────────────────────────────────────────

export const PropertyCard: Story = {
  render: () => <PropertyCardSkeleton className="w-72" />,
};

// ── PropertyListSkeleton ──────────────────────────────────────────────────────

export const PropertyList3: Story = {
  render: () => <PropertyListSkeleton count={3} />,
};

export const PropertyList6: Story = {
  render: () => <PropertyListSkeleton count={6} />,
};

// ── BookingSkeleton ───────────────────────────────────────────────────────────

export const Booking: Story = {
  render: () => <BookingSkeleton className="w-80" />,
};

// ── Combined loading state ────────────────────────────────────────────────────

export const PageLoading: Story = {
  render: () => (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <PropertyListSkeleton count={3} />
    </div>
  ),
};
