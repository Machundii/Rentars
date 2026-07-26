'use client';

import { useEffect, useState } from 'react';
import { Calendar, Users, AlertCircle } from 'lucide-react';

interface BookingFormProps {
  propertyId: string;
  pricePerNight: number;
  /** Maximum number of guests allowed by the property. Omit to leave uncapped. */
  maxGuests?: number;
  onSubmit: (data: { checkIn: Date; checkOut: Date; guestCount: number; totalPrice: number }) => void;
  isLoading?: boolean;
}

interface PricingBreakdown {
  total: number;
  breakdown: Array<{ date: string; price: number; is_available: boolean }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function BookingForm({
  propertyId,
  maxGuests,
  onSubmit,
  isLoading = false,
}: BookingFormProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [dateError, setDateError] = useState('');
  const [guestError, setGuestError] = useState('');
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!checkIn || !checkOut) return;

    const fetchPricing = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/calendar/${propertyId}/price?checkIn=${checkIn}&checkOut=${checkOut}`,
        );

        if (res.ok) {
          setPricing(await res.json());
          setDateError('');
        } else {
          const error = await res.json();
          setDateError(error.error || 'Error fetching pricing');
        }
      } catch {
        setDateError('Failed to fetch pricing');
      }
    };

    fetchPricing();
  }, [checkIn, checkOut, propertyId]);

  const handleGuestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setGuestCount(isNaN(val) ? 1 : val);

    if (maxGuests !== undefined && val > maxGuests) {
      setGuestError(`Maximum ${maxGuests} guest${maxGuests === 1 ? '' : 's'} allowed`);
    } else if (val < 1) {
      setGuestError('At least 1 guest is required');
    } else {
      setGuestError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');
    setAvailabilityError('');

    if (!checkIn || !checkOut) {
      setDateError('Please select valid dates');
      return;
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      setDateError('Check-out date must be after check-in date');
      return;
    }

    if (guestCount < 1) {
      setGuestError('At least 1 guest is required');
      return;
    }

    if (maxGuests !== undefined && guestCount > maxGuests) {
      setGuestError(`Maximum ${maxGuests} guest${maxGuests === 1 ? '' : 's'} allowed`);
      return;
    }

    // Check availability
    try {
      const res = await fetch(
        `${API_URL}/api/v1/calendar/${propertyId}/check?checkIn=${checkIn}&checkOut=${checkOut}`,
      );

      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          setAvailabilityError(data.reason || 'Dates not available');
          return;
        }
      }
    } catch {
      setDateError('Failed to check availability');
      return;
    }

    if (!pricing) {
      setDateError('Unable to calculate total price');
      return;
    }

    // Check for blocked dates in breakdown
    const hasBlocked = pricing.breakdown.some((d) => !d.is_available);
    if (hasBlocked) {
      setDateError('Selected dates include unavailable periods');
      return;
    }

    onSubmit({
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      guestCount,
      totalPrice: pricing.total,
    });
  };

  const nights =
    checkIn && checkOut
      ? Math.ceil(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
        )
      : 0;

  const hasError = !!(dateError || availabilityError);
  const isOverCapacity = maxGuests !== undefined && guestCount > maxGuests;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="check-in">
            <Calendar className="inline mr-2" size={16} aria-hidden="true" />
            Check-in
          </label>
          <input
            id="check-in"
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="check-out">
            <Calendar className="inline mr-2" size={16} aria-hidden="true" />
            Check-out
          </label>
          <input
            id="check-out"
            type="date"
            min={checkIn || today}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>
      </div>

      {hasError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-700">{dateError || availabilityError}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="guests">
          <Users className="inline mr-2" size={16} aria-hidden="true" />
          Guests
          {maxGuests !== undefined && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              (max {maxGuests})
            </span>
          )}
        </label>
        <input
          id="guests"
          type="number"
          min="1"
          max={maxGuests}
          value={guestCount}
          onChange={handleGuestChange}
          className={`w-full border rounded-lg px-3 py-2 ${
            guestError ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
          aria-describedby={guestError ? 'guest-error' : undefined}
        />
        {guestError && (
          <p id="guest-error" className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle size={13} aria-hidden="true" />
            {guestError}
          </p>
        )}
      </div>

      {pricing && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          {pricing.breakdown.length > 0 && (
            <div className="max-h-24 overflow-y-auto text-xs space-y-1 mb-3 pb-2 border-b">
              {pricing.breakdown.map((day) => (
                <div key={day.date} className="flex justify-between text-gray-600">
                  <span>{day.date}</span>
                  <span>{day.price.toFixed(2)} USDC</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total ({nights} nights)</span>
            <span className="text-blue-600">{pricing.total.toFixed(2)} USDC</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || nights <= 0 || !pricing || !!guestError || isOverCapacity}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
      >
        {isLoading ? 'Processing...' : 'Book Now'}
      </button>
    </form>
  );
}
