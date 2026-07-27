import type { Meta, StoryObj } from '@storybook/react';
import { Home, Star, AlertCircle, User } from 'lucide-react';
import { IconContainer } from '@/components/ui/icon-container';

const meta: Meta<typeof IconContainer> = {
  title: 'UI/IconContainer',
  component: IconContainer,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'destructive'],
    },
  },
  args: {
    size: 'md',
    variant: 'default',
    children: <Home aria-hidden="true" />,
  },
};
export default meta;

type Story = StoryObj<typeof IconContainer>;

// ── Sizes ─────────────────────────────────────────────────────────────────────

export const Small: Story = {
  args: { size: 'sm', children: <Star aria-hidden="true" /> },
};

export const Medium: Story = {
  args: { size: 'md', children: <Home aria-hidden="true" /> },
};

export const Large: Story = {
  args: { size: 'lg', children: <User aria-hidden="true" /> },
};

// ── Variants ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: { variant: 'default', children: <Home aria-hidden="true" /> },
};

export const Primary: Story = {
  args: { variant: 'primary', children: <Star aria-hidden="true" /> },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: <User aria-hidden="true" /> },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: <AlertCircle aria-hidden="true" /> },
};

// ── All variants grid ─────────────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      {(['default', 'primary', 'secondary', 'destructive'] as const).map((v) => (
        <div key={v} className="flex flex-col items-center gap-1">
          <IconContainer variant={v} size="md">
            <Home aria-hidden="true" />
          </IconContainer>
          <span className="text-xs text-muted-foreground capitalize">{v}</span>
        </div>
      ))}
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-4 p-4">
      {(['sm', 'md', 'lg'] as const).map((s) => (
        <div key={s} className="flex flex-col items-center gap-1">
          <IconContainer size={s} variant="primary">
            <Home aria-hidden="true" />
          </IconContainer>
          <span className="text-xs text-muted-foreground">{s}</span>
        </div>
      ))}
    </div>
  ),
};
