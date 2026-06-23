import type { MonthlyMetric, OccupancyData } from './types';

export interface GrowthMetric {
  current: number;
  previous: number | null;
  changePercent: number | null;
}

function growthBetween(current: number, previous: number | undefined): GrowthMetric {
  if (previous === undefined) {
    return { current, previous: null, changePercent: null };
  }
  const changePercent = previous === 0 ? 0 : ((current - previous) / previous) * 100;
  return { current, previous, changePercent };
}

export function calcMonthOverMonth(
  metrics: MonthlyMetric[],
  key: 'earnings' | 'bookings'
): GrowthMetric {
  if (metrics.length === 0) {
    return { current: 0, previous: null, changePercent: null };
  }
  const latest = metrics[metrics.length - 1];
  const prior = metrics[metrics.length - 2];
  return growthBetween(latest[key], prior?.[key]);
}

export function calcYearOverYear(
  metrics: MonthlyMetric[],
  key: 'earnings' | 'bookings'
): GrowthMetric {
  if (metrics.length === 0) {
    return { current: 0, previous: null, changePercent: null };
  }
  const latest = metrics[metrics.length - 1];
  const sameMonthLastYear = metrics[metrics.length - 1 - 12];
  return growthBetween(latest[key], sameMonthLastYear?.[key]);
}

export function calcOccupancyRate(occupancy: OccupancyData): number {
  if (occupancy.availableNights === 0) return 0;
  return (occupancy.bookedNights / occupancy.availableNights) * 100;
}

export function getPricingSuggestion(occupancyRate: number): string {
  if (occupancyRate >= 85) {
    return 'High demand: consider raising your nightly rate by 5-10%.';
  }
  if (occupancyRate <= 40) {
    return 'Low occupancy: consider lowering your nightly rate or adding promotions to attract bookings.';
  }
  return 'Occupancy is healthy: your current pricing looks well balanced.';
}
