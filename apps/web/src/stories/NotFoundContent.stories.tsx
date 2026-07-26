import type { Meta, StoryObj } from '@storybook/react';
import { NotFoundContent } from '@/components/error/NotFoundContent';

const meta: Meta<typeof NotFoundContent> = {
  title: 'Error/NotFoundContent',
  component: NotFoundContent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Branded 404 page shown when a route is not found. ' +
          'Includes a search box, Go home link, and Go back button.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof NotFoundContent>;

export const Default: Story = {};

export const DarkMode: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
    themes: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div className="dark bg-gray-950 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
