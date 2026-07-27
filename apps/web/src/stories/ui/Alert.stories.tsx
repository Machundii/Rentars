import type { Meta, StoryObj } from '@storybook/react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive'],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Alert>;

// ── Variants ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
    </Alert>
  ),
};

// ── Domain-specific styles ────────────────────────────────────────────────────

export const Success: Story = {
  render: () => (
    <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      <AlertTitle>Booking confirmed</AlertTitle>
      <AlertDescription>Your reservation has been placed successfully.</AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  render: () => (
    <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
      <TriangleAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle>Attention</AlertTitle>
      <AlertDescription>Some dates in your selection are unavailable.</AlertDescription>
    </Alert>
  ),
};

export const Info: Story = {
  render: () => (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertTitle>Note</AlertTitle>
      <AlertDescription>Payment is processed in USDC on the Stellar network.</AlertDescription>
    </Alert>
  ),
};

// ── No title ──────────────────────────────────────────────────────────────────

export const NoTitle: Story = {
  render: () => (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>A simple informational message without a title.</AlertDescription>
    </Alert>
  ),
};

// ── Dismissible pattern ───────────────────────────────────────────────────────

export const Dismissible: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>Your USDC transaction could not be completed.</span>
        <button
          type="button"
          className="ml-4 text-sm font-medium underline underline-offset-2
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          Dismiss
        </button>
      </AlertDescription>
    </Alert>
  ),
};
