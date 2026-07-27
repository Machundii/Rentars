import { describe, expect, it } from 'vitest';
import {
  calcMonthOverMonth,
  calcOccupancyRate,
  calcYearOverYear,
  getPricingSuggestion,
} from '../analytics';
import type { MonthlyMetric } from '../types';

const metrics: MonthlyMetric[] = [
  { month: 'Jun 2025', earnings: 1000, bookings: 4 },
  { month: 'Jul 2025', earnings: 1100, bookings: 5 },
  { month: 'Aug 2025', earnings: 1200, bookings: 5 },
  { month: 'Sep 2025', earnings: 1300, bookings: 6 },
  { month: 'Oct 2025', earnings: 1400, bookings: 6 },
  { month: 'Nov 2025', earnings: 1500, bookings: 7 },
  { month: 'Dec 2025', earnings: 1600, bookings: 7 },
  { month: 'Jan 2026', earnings: 1700, bookings: 8 },
  { month: 'Feb 2026', earnings: 1800, bookings: 8 },
  { month: 'Mar 2026', earnings: 1900, bookings: 9 },
  { month: 'Apr 2026', earnings: 2000, bookings: 9 },
  { month: 'May 2026', earnings: 1000, bookings: 10 },
  { month: 'Jun 2026', earnings: 2000, bookings: 8 },
];

describe('calcMonthOverMonth', () => {
  it('computes percent change vs previous month', () => {
    const result = calcMonthOverMonth(metrics, 'earnings');
    expect(result.current).toBe(2000);
    expect(result.previous).toBe(1000);
    expect(result.changePercent).toBe(100);
  });

  it('returns null change when there is no prior month', () => {
    const result = calcMonthOverMonth([metrics[0]], 'earnings');
    expect(result.changePercent).toBeNull();
  });
});

describe('calcYearOverYear', () => {
  it('compares latest month to the same month a year prior', () => {
    const result = calcYearOverYear(metrics, 'earnings');
    expect(result.current).toBe(2000);
    expect(result.previous).toBe(1000);
    expect(result.changePercent).toBe(100);
  });

  it('returns null change when fewer than 13 months of data exist', () => {
    const result = calcYearOverYear(metrics.slice(0, 6), 'earnings');
    expect(result.changePercent).toBeNull();
  });
});

describe('calcOccupancyRate', () => {
  it('computes percentage of booked vs available nights', () => {
    expect(calcOccupancyRate({ bookedNights: 50, availableNights: 100 })).toBe(50);
  });

  it('returns 0 when there are no available nights', () => {
    expect(calcOccupancyRate({ bookedNights: 0, availableNights: 0 })).toBe(0);
  });
});

describe('getPricingSuggestion', () => {
  it('suggests raising rates for high occupancy', () => {
    expect(getPricingSuggestion(90)).toMatch(/raising/);
  });

  it('suggests lowering rates for low occupancy', () => {
    expect(getPricingSuggestion(30)).toMatch(/lowering/);
  });

  it('reports balanced pricing for mid-range occupancy', () => {
    expect(getPricingSuggestion(60)).toMatch(/healthy/);
  });
});
