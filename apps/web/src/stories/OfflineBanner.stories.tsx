import type { Meta, StoryObj } from '@storybook/react';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { OfflineGate } from '@/components/shared/OfflineGate';

// ── OfflineBanner ─────────────────────────────────────────────────────────────

const bannerMeta: Meta<typeof OfflineBanner> = {
  title: 'Offline/OfflineBanner',
  component: OfflineBanner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Sticky top banner that appears when the browser goes offline and ' +
          'briefly shows a reconnected confirmation when the connection is restored.',
      },
    },
  },
};
export default bannerMeta;

type BannerStory = StoryObj<typeof OfflineBanner>;

/**
 * Force-render the offline state by mocking navigator.onLine = false.
 * In a real browser the component is driven by window online/offline events.
 */
export const Offline: BannerStory = {
  decorators: [
    (Story) => {
      // Override onLine for this story only
      Object.defineProperty(navigator, 'onLine', {
        get: () => false,
        configurable: true,
      });
      return <Story />;
    },
  ],
};

export const BackOnline: BannerStory = {
  parameters: {
    docs: {
      description: {
        story: 'Green confirmation banner shown briefly after reconnecting.',
      },
    },
  },
  decorators: [
    (Story) => {
      // This story demonstrates the reconnected state visually;
      // in production it auto-dismisses after 3 s.
      return (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-[9999] flex items-center gap-2 px-4 py-3 text-sm font-medium bg-green-600 text-white"
        >
          <span>You&apos;re back online.</span>
        </div>
      );
    },
  ],
};

// ── OfflineGate ───────────────────────────────────────────────────────────────

export const GateReplace: StoryObj = {
  name: 'OfflineGate — Replace mode',
  render: () => (
    <div className="p-6">
      <OfflineGate message="Booking requires an internet connection.">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">Book Now</button>
      </OfflineGate>
    </div>
  ),
};

export const GateOverlay: StoryObj = {
  name: 'OfflineGate — Overlay mode',
  render: () => (
    <div className="p-6 max-w-sm">
      <OfflineGate overlay message="Booking requires an internet connection.">
        <div className="p-6 bg-white border rounded-lg shadow">
          <h2 className="font-semibold mb-2">Booking Form</h2>
          <input className="w-full border rounded p-2 mb-2" placeholder="Check-in" disabled />
          <button className="w-full bg-blue-600 text-white py-2 rounded-lg opacity-50" disabled>
            Book Now
          </button>
        </div>
      </OfflineGate>
    </div>
  ),
};
