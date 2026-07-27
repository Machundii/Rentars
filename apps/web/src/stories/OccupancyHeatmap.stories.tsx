import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import OccupancyHeatmap from '@/app/dashboard/host-dashboard/components/OccupancyHeatmap';

/**
 * Stories for the OccupancyHeatmap component.
 *
 * The component normally fetches data from the API. In Storybook we intercept
 * `fetch` via a decorator so each story can supply its own data without a
 * running backend.
 */

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROPERTIES = [
  { id: 'prop-1', title: 'Seaside Cottage' },
  { id: 'prop-2', title: 'Mountain Cabin' },
];

/** Build `n` day entries starting from `startIso`. */
function buildDays(
  startIso: string,
  n: number,
  pattern: (i: number) => 'booked' | 'blocked' | 'available',
): { date: string; status: 'booked' | 'blocked' | 'available' }[] {
  const days = [];
  const cursor = new Date(startIso + 'T00:00:00Z');
  for (let i = 0; i < n; i++) {
    days.push({ date: cursor.toISOString().slice(0, 10), status: pattern(i) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const today = new Date().toISOString().slice(0, 10);

function makeHeatmapResponse(
  propertyId: string,
  pattern: (i: number) => 'booked' | 'blocked' | 'available',
  days = 90,
) {
  const dayEntries = buildDays(today, days, pattern);
  const booked    = dayEntries.filter((d) => d.status === 'booked').length;
  const blocked   = dayEntries.filter((d) => d.status === 'blocked').length;
  const available = dayEntries.filter((d) => d.status === 'available').length;
  const toDate = new Date(today + 'T00:00:00Z');
  toDate.setUTCDate(toDate.getUTCDate() + days - 1);
  return {
    propertyId,
    from: today,
    to:   toDate.toISOString().slice(0, 10),
    days: dayEntries,
    summary: { booked, blocked, available, total: days },
  };
}

// ─── Fetch mock decorator ─────────────────────────────────────────────────────

type FetchMockMap = Record<string, unknown>;

function withFetchMock(responseMap: FetchMockMap) {
  return (Story: React.ComponentType) => {
    // Replace global fetch for this story
    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const url = input.toString();
      for (const [key, data] of Object.entries(responseMap)) {
        if (url.includes(key)) {
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: 'Not mocked' }), { status: 404 });
    };
    // Restore after render (best-effort)
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof OccupancyHeatmap> = {
  title:     'Host Dashboard/OccupancyHeatmap',
  component: OccupancyHeatmap,
  tags:      ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Calendar heatmap showing booked / blocked / available days per property. ' +
          'Status is conveyed by colour AND pattern (dot for booked, hatch for blocked) ' +
          'for colour-blind accessibility.',
      },
    },
  },
  args: {
    properties:        PROPERTIES,
    defaultPropertyId: 'prop-1',
  },
};
export default meta;

type Story = StoryObj<typeof OccupancyHeatmap>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * Realistic mix of booked, blocked, and available days across 3 months.
 * Most days available with some booked and a few blocked periods.
 */
export const RealisticMix: Story = {
  name: 'Realistic mix (3 months)',
  decorators: [
    withFetchMock({
      'prop-1/occupancy-heatmap': makeHeatmapResponse('prop-1', (i) => {
        if (i >= 3  && i <= 6)  return 'booked';
        if (i >= 14 && i <= 16) return 'blocked';
        if (i >= 22 && i <= 28) return 'booked';
        if (i >= 40 && i <= 42) return 'booked';
        if (i >= 55 && i <= 57) return 'blocked';
        if (i >= 63 && i <= 69) return 'booked';
        if (i >= 78 && i <= 82) return 'booked';
        return 'available';
      }),
    }),
  ],
};

/**
 * Fully booked — all 90 days booked. Tests the "worst case" render.
 */
export const FullyBooked: Story = {
  name: 'Fully booked',
  decorators: [
    withFetchMock({
      'prop-1/occupancy-heatmap': makeHeatmapResponse('prop-1', () => 'booked'),
    }),
  ],
};

/**
 * Fully available — useful for verifying the green palette renders cleanly.
 */
export const FullyAvailable: Story = {
  name: 'Fully available',
  decorators: [
    withFetchMock({
      'prop-1/occupancy-heatmap': makeHeatmapResponse('prop-1', () => 'available'),
    }),
  ],
};

/**
 * Heavy blocks — long blocked periods with sparse bookings.
 */
export const HeavilyBlocked: Story = {
  name: 'Heavily blocked',
  decorators: [
    withFetchMock({
      'prop-1/occupancy-heatmap': makeHeatmapResponse('prop-1', (i) => {
        if (i % 7 === 0) return 'booked';
        if (i % 3 === 0) return 'blocked';
        return 'available';
      }),
    }),
  ],
};

/**
 * 1-month horizon — tests the horizon selector via defaultProps.
 */
export const OneMonth: Story = {
  name: '1-month horizon',
  decorators: [
    withFetchMock({
      'prop-1/occupancy-heatmap': makeHeatmapResponse('prop-1', (i) => {
        if (i >= 5 && i <= 8) return 'booked';
        if (i >= 18 && i <= 20) return 'blocked';
        return 'available';
      }, 30),
    }),
  ],
};

/**
 * Multiple properties — shows property selector populated with two entries.
 */
export const MultipleProperties: Story = {
  name: 'Multiple properties',
  args: {
    properties:        PROPERTIES,
    defaultPropertyId: 'prop-2',
  },
  decorators: [
    withFetchMock({
      'prop-2/occupancy-heatmap': makeHeatmapResponse('prop-2', (i) => {
        if (i >= 10 && i <= 14) return 'booked';
        if (i >= 30 && i <= 35) return 'blocked';
        return 'available';
      }),
    }),
  ],
};

/**
 * Loading state — fetch hangs to show the loading placeholder.
 */
export const Loading: Story = {
  name: 'Loading state',
  decorators: [
    (_Story) => {
      // Override fetch to never resolve so the loading state is visible
      global.fetch = () => new Promise(() => {});
      return <_Story />;
    },
  ],
};

/**
 * Error state — API returns a 403.
 */
export const ErrorState: Story = {
  name: 'Error state (API 403)',
  decorators: [
    (_Story) => {
      global.fetch = async () =>
        new Response(JSON.stringify({ error: 'Forbidden: only the property owner can view occupancy data' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      return <_Story />;
    },
  ],
};
