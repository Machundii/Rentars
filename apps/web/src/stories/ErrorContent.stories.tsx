import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ErrorContent } from '@/components/error/ErrorContent';

const meta: Meta<typeof ErrorContent> = {
  title: 'Error/ErrorContent',
  component: ErrorContent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global error boundary UI. Shows a friendly message, an optional error code, ' +
          'and recovery actions: retry, go home, and browse properties.',
      },
    },
  },
  args: {
    reset: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof ErrorContent>;

const baseError = new Error('An unexpected error occurred');

export const Default: Story = {
  args: {
    error: baseError,
  },
};

export const WithDigest: Story = {
  args: {
    error: Object.assign(new Error('Hydration mismatch'), { digest: 'abc123def456' }),
  },
};

export const DarkMode: Story = {
  args: {
    error: baseError,
  },
  decorators: [
    (Story) => (
      <div className="dark bg-gray-950 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
