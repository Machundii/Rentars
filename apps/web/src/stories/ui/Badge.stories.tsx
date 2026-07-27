import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/ui/badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
    children: { control: 'text' },
  },
  args: {
    children: 'Badge',
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

// ── Variants ──────────────────────────────────────────────────────────────────

export const Default: Story = { args: { variant: 'default' } };

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Destructive: Story = { args: { variant: 'destructive' } };

export const Outline: Story = { args: { variant: 'outline' } };

// ── Domain-specific badges ────────────────────────────────────────────────────

export const Available: Story = {
  args: { variant: 'secondary', children: 'Available' },
};

export const Booked: Story = {
  args: { variant: 'outline', children: 'Booked' },
};

export const NewListing: Story = {
  args: { variant: 'default', children: 'New' },
};

export const Error: Story = {
  args: { variant: 'destructive', children: 'Unavailable' },
};

// ── All at once ───────────────────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
