import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: { control: 'boolean' },
    asChild: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    children: 'Button',
    disabled: false,
    asChild: false,
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

// ── Variants ──────────────────────────────────────────────────────────────────

export const Default: Story = { args: { variant: 'default', size: 'default' } };

export const Destructive: Story = { args: { variant: 'destructive' } };

export const Outline: Story = { args: { variant: 'outline' } };

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Ghost: Story = { args: { variant: 'ghost' } };

export const Link: Story = { args: { variant: 'link' } };

// ── Sizes ─────────────────────────────────────────────────────────────────────

export const Small: Story = { args: { size: 'sm' } };

export const Large: Story = { args: { size: 'lg' } };

export const IconSize: Story = {
  args: { size: 'icon', children: '★', 'aria-label': 'Star' },
};

// ── States ────────────────────────────────────────────────────────────────────

export const Disabled: Story = { args: { disabled: true } };

export const DisabledDestructive: Story = {
  args: { variant: 'destructive', disabled: true },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <span className="flex items-center gap-2">
        <svg
          className="animate-spin h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading…
      </span>
    ),
  },
};

// ── All variants at once (visual reference) ───────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Star">★</Button>
    </div>
  ),
};
