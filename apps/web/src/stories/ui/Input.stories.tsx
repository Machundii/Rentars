import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'date', 'search', 'tel', 'url'],
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    value: { control: 'text' },
  },
  args: {
    type: 'text',
    placeholder: 'Enter text…',
    disabled: false,
  },
};
export default meta;

type Story = StoryObj<typeof Input>;

// ── States ────────────────────────────────────────────────────────────────────

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: 'Hello, Rentars' } };

export const Placeholder: Story = { args: { placeholder: 'Search properties…' } };

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Cannot edit this' },
};

export const EmailType: Story = { args: { type: 'email', placeholder: 'you@example.com' } };

export const PasswordType: Story = { args: { type: 'password', placeholder: '••••••••' } };

export const NumberType: Story = { args: { type: 'number', placeholder: '1', min: 1, max: 10 } };

export const DateType: Story = { args: { type: 'date' } };

// ── Error state ───────────────────────────────────────────────────────────────

export const ErrorState: Story = {
  render: () => (
    <div className="space-y-1 w-64">
      <Label htmlFor="input-error">Email</Label>
      <Input
        id="input-error"
        type="email"
        defaultValue="not-an-email"
        aria-invalid={true}
        aria-describedby="input-error-msg"
        className="border-destructive focus-visible:ring-destructive"
      />
      <p id="input-error-msg" className="text-sm text-destructive">
        Please enter a valid email address.
      </p>
    </div>
  ),
};

// ── With label ────────────────────────────────────────────────────────────────

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-1 w-64">
      <Label htmlFor="labelled-input">Location</Label>
      <Input id="labelled-input" placeholder="Miami, FL" />
    </div>
  ),
};

export const WithLabelDisabled: Story = {
  render: () => (
    <div className="space-y-1 w-64">
      <Label htmlFor="labelled-disabled" className="opacity-70">
        Location (read-only)
      </Label>
      <Input id="labelled-disabled" defaultValue="Miami, FL" disabled />
    </div>
  ),
};
