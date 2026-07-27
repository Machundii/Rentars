'use client';

import { Calendar, X } from 'lucide-react';
import { useState } from 'react';

interface PropertyCalendarProps {
  propertyId: string;
  onClose?: () => void;
}

export default function PropertyCalendar({ propertyId: _propertyId, onClose }: PropertyCalendarProps) {
  const [_unavailableDates, setUnavailableDates] = useState<string[]>([]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar size={20} />
          Availability Calendar
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Calendar widget for managing property availability
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Integration with a calendar library (e.g., react-calendar) would go here
        </p>
      </div>

      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Tip:</strong> Mark dates as unavailable to prevent bookings on those days.
        </p>
      </div>

      <button
        onClick={onClose}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
      >
        Save Availability
      </button>
    </div>
  );
}
