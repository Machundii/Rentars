'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyMetric } from '../types';

interface EarningsTrendChartProps {
  data: MonthlyMetric[];
}

export default function EarningsTrendChart({ data }: EarningsTrendChartProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings & Booking Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis yAxisId="earnings" />
          <YAxis yAxisId="bookings" orientation="right" />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="earnings"
            type="monotone"
            dataKey="earnings"
            stroke="#3b82f6"
            name="Earnings (USDC)"
            strokeWidth={2}
          />
          <Line
            yAxisId="bookings"
            type="monotone"
            dataKey="bookings"
            stroke="#10b981"
            name="Bookings"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
