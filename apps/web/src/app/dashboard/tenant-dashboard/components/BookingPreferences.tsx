'use client';

import { Calendar, DollarSign, Hash, MapPin } from 'lucide-react';
import { summarizeBookingPreferences } from '../analytics';
import type { FormattedBooking } from '../types';

interface BookingPreferencesProps {
  bookings: FormattedBooking[];
}

export default function BookingPreferences({ bookings }: BookingPreferencesProps) {
  const summary = summarizeBookingPreferences(bookings);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Preferences</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Hash size={14} /> Total Bookings
          </div>
          <p className="text-xl font-bold text-gray-900">{summary.totalBookings}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign size={14} /> Total Spent
          </div>
          <p className="text-xl font-bold text-gray-900">{summary.totalSpent} USDC</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Calendar size={14} /> Avg. Stay Length
          </div>
          <p className="text-xl font-bold text-gray-900">
            {summary.averageStayNights.toFixed(1)} nights
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <MapPin size={14} /> Favorite Location
          </div>
          <p className="text-xl font-bold text-gray-900">{summary.favoriteLocation ?? 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
