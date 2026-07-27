import type { Meta, StoryObj } from '@storybook/react';
import {
  ErrorDisplay,
  SuccessDisplay,
  InfoDisplay,
  WarningDisplay,
} from '@/components/ui/error-display';

// Use ErrorDisplay as the primary component for the meta; the others are shown as sub-stories.
const meta: Meta<typeof ErrorDisplay> = {
  title: 'UI/ErrorDisplay',
  component: ErrorDisplay,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    message: { control: 'text' },
    onDismiss: { action: 'dismissed' },
  },
  args: {
    message: 'Something went wrong. Please try again.',
  },
};
export default meta;

type Story = StoryObj<typeof ErrorDisplay>;

// ── ErrorDisplay ──────────────────────────────────────────────────────────────

export const Error: Story = {
  args: {
    title: 'Error',
    message: 'Your USDC transaction could not be completed.',
  },
};

export const ErrorDismissible: Story = {
  args: {
    title: 'Payment failed',
    message: 'Insufficient USDC balance in your Freighter wallet.',
    onDismiss: () => {},
  },
};

// ── SuccessDisplay ────────────────────────────────────────────────────────────

export const Success: Story = {
  render: (args) => (
    <SuccessDisplay
      title="Booking confirmed"
      message="Your reservation has been placed. Check your email for details."
      onDismiss={args.onDismiss}
    />
  ),
};

export const SuccessDismissible: Story = {
  render: (args) => (
    <SuccessDisplay
      title="Profile updated"
      message="Your changes have been saved successfully."
      onDismiss={args.onDismiss}
    />
  ),
};

// ── InfoDisplay ───────────────────────────────────────────────────────────────

export const Info: Story = {
  render: (args) => (
    <InfoDisplay
      title="How payments work"
      message="Rentars uses USDC escrow on Stellar. Funds are released once your stay completes."
      onDismiss={args.onDismiss}
    />
  ),
};

// ── WarningDisplay ────────────────────────────────────────────────────────────

export const Warning: Story = {
  render: (args) => (
    <WarningDisplay
      title="Availability warning"
      message="Some dates in your selection are blocked by the host."
      onDismiss={args.onDismiss}
    />
  ),
};

// ── All variants side-by-side ─────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-3 max-w-lg">
      <ErrorDisplay title="Error" message="Transaction failed." />
      <SuccessDisplay title="Success" message="Booking confirmed." />
      <InfoDisplay title="Info" message="Payment uses USDC escrow." />
      <WarningDisplay title="Warning" message="Some dates are unavailable." />
    </div>
  ),
};

// ── No title (message-only) ───────────────────────────────────────────────────

export const NoTitle: Story = {
  args: {
    title: undefined,
    message: 'An unexpected error occurred.',
  },
};
