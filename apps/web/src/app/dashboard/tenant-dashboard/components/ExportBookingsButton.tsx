'use client';

import { downloadCsv } from '@/lib/export';
import { Download } from 'lucide-react';
import type { FormattedBooking } from '../types';

interface ExportBookingsButtonProps {
  bookings: FormattedBooking[];
}

export default function ExportBookingsButton({ bookings }: ExportBookingsButtonProps) {
  const handleExport = () => {
    const rows = bookings.map((b) => [
      b.propertyTitle,
      b.location,
      b.checkIn.toISOString().slice(0, 10),
      b.checkOut.toISOString().slice(0, 10),
      b.totalPrice,
      b.status,
      b.escrowStatus,
    ]);
    downloadCsv(
      `rentars-booking-history-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'property',
        'location',
        'check_in',
        'check_out',
        'total_price_usdc',
        'status',
        'escrow_status',
      ],
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
      Export Bookings
    </button>
  );
}
