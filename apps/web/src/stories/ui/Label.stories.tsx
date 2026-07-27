import type { Meta, StoryObj } from '@storybook/react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const meta: Meta<typeof Label> = {
  title: 'UI/Label',
  component: Label,
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text' },
    htmlFor: { control: 'text' },
  },
  args: { children: 'Label text' },
};
export default meta;

type Story = StoryObj<typeof Label>;

// ── Default ───────────────────────────────────────────────────────────────────

export const Default: Story = {};

// ── Paired with input ─────────────────────────────────────────────────────────

export const WithInput: Story = {
  render: () => (
    <div className="space-y-1 w-64">
      <Label htmlFor="example-input">Email address</Label>
      <Input id="example-input" type="email" placeholder="you@example.com" />
    </div>
  ),
};

// ── Disabled peer ─────────────────────────────────────────────────────────────
// The label uses Tailwind's `peer-disabled` modifier — when the associated input
// is disabled, the label becomes muted and shows not-allowed cursor.

export const PeerDisabled: Story = {
  render: () => (
    <div className="space-y-1 w-64">
      <Label htmlFor="disabled-input">Location (locked)</Label>
      <Input id="disabled-input" defaultValue="Miami, FL" disabled className="peer" />
    </div>
  ),
};

// ── Required indicator ────────────────────────────────────────────────────────

export const Required: Story = {
  render: () => (
    <div className="space-y-1 w-64">
      <Label htmlFor="required-input">
        Full name <span aria-hidden="true" className="text-destructive">*</span>
      </Label>
      <Input id="required-input" placeholder="Jane Doe" required />
    </div>
  ),
};
