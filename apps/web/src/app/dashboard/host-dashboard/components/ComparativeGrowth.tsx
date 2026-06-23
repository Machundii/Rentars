'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { calcMonthOverMonth, calcYearOverYear } from '../analytics';
import type { MonthlyMetric } from '../types';

interface ComparativeGrowthProps {
  metrics: MonthlyMetric[];
}

function GrowthBadge({ changePercent }: { changePercent: number | null }) {
  if (changePercent === null) {
    return (
      <span className="flex items-center gap-1 text-gray-500 text-sm">
        <Minus size={14} /> No prior data
      </span>
    );
  }
  const isPositive = changePercent >= 0;
  return (
    <span
      className={`flex items-center gap-1 text-sm font-medium ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      {Math.abs(changePercent).toFixed(1)}%
    </span>
  );
}

export default function ComparativeGrowth({ metrics }: ComparativeGrowthProps) {
  const earningsMoM = calcMonthOverMonth(metrics, 'earnings');
  const earningsYoY = calcYearOverYear(metrics, 'earnings');
  const bookingsMoM = calcMonthOverMonth(metrics, 'bookings');
  const bookingsYoY = calcYearOverYear(metrics, 'bookings');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparative Analytics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Earnings (MoM)</p>
          <GrowthBadge changePercent={earningsMoM.changePercent} />
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Earnings (YoY)</p>
          <GrowthBadge changePercent={earningsYoY.changePercent} />
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Bookings (MoM)</p>
          <GrowthBadge changePercent={bookingsMoM.changePercent} />
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Bookings (YoY)</p>
          <GrowthBadge changePercent={bookingsYoY.changePercent} />
        </div>
      </div>
    </div>
  );
}
