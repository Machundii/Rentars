'use client';

import { downloadCsv } from '@/lib/export';
import { Download } from 'lucide-react';
import type { MonthlyMetric, PayoutRecord } from '../types';

interface ExportReportButtonProps {
  monthlyMetrics: MonthlyMetric[];
  payoutHistory: PayoutRecord[];
}

export default function ExportReportButton({
  monthlyMetrics,
  payoutHistory,
}: ExportReportButtonProps) {
  const handleExport = () => {
    const rows = [
      ...monthlyMetrics.map((m) => ['earnings', m.month, m.earnings, m.bookings, '']),
      ...payoutHistory.map((p) => [
        'payout',
        p.date.toISOString().slice(0, 10),
        p.amount,
        '',
        p.status,
      ]),
    ];
    downloadCsv(
      `rentars-host-financial-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['type', 'period_or_date', 'amount_usdc', 'bookings', 'status'],
      rows
    );
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg border border-gray-300 transition"
    >
      <Download size={18} />
      Export Report
    </button>
  );
}
