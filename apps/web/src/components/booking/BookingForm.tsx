'use client';

import { useEffect, useState } from 'react';
import { Calendar, Users, AlertCircle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/useTranslations';
import { useLocale } from '@/lib/i18n/useLocale';
import { formatCurrency } from '@/lib/i18n/formatting';

interface BookingFormProps {
  propertyId: string;
  pricePerNight: number;
  onSubmit: (data: { checkIn: Date; checkOut: Date; guestCount: number; totalPrice: number }) => void;
  isLoading?: boolean;
}

interface PricingBreakdown {
  total: number;
  breakdown: Array<{ date: string; price: number; is_available: boolean }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function BookingForm({ propertyId, onSubmit, isLoading = false }: BookingFormProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [dateError, setDateError] = useState('');
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');

  const t = useTranslations('booking');
  const { locale } = useLocale();
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
          setDateError(error.error || t('cantCalculatePrice'));
        }
      } catch {
        setDateError(t('cantCalculatePrice'));
      }
    };

    fetchPricing();
  }, [checkIn, checkOut, propertyId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');
    setAvailabilityError('');

    if (!checkIn || !checkOut) {
      setDateError(t('invalidDates'));
      return;
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      setDateError(t('checkoutAfterCheckin'));
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/v1/calendar/${propertyId}/check?checkIn=${checkIn}&checkOut=${checkOut}`,
      );

      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          setAvailabilityError(data.reason || t('unavailableDates'));
          return;
        }
      }
    } catch {
      setDateError(t('cantCalculatePrice'));
      return;
    }

    if (!pricing) {
      setDateError(t('cantCalculatePrice'));
      return;
    }

    const hasBlocked = pricing.breakdown.some((d) => !d.is_available);
    if (hasBlocked) {
      setDateError(t('hasBlockedDates'));
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
      ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
      : 0;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="check-in">
            <Calendar className="inline mr-2" size={16} aria-hidden="true" />
            {t('checkIn')}
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
            {t('checkOut')}
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

      {(dateError || availabilityError) && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{dateError || availabilityError}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="guests">
          <Users className="inline mr-2" size={16} aria-hidden="true" />
          {t('guests')}
        </label>
        <input
          id="guests"
          type="number"
          min="1"
          value={guestCount}
          onChange={(e) => setGuestCount(parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {pricing && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          {pricing.breakdown.length > 0 && (
            <div className="max-h-24 overflow-y-auto text-xs space-y-1 mb-3 pb-2 border-b">
              {pricing.breakdown.map((day) => (
                <div key={day.date} className="flex justify-between text-gray-600">
                  <span>{day.date}</span>
                  <span>{formatCurrency(day.price, locale)} USDC</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>{t('totalNights', { count: nights })}</span>
            <span className="text-blue-600">{formatCurrency(pricing.total, locale)} USDC</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || nights <= 0 || !pricing}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
      >
        {isLoading ? t('processing') : t('bookNow')}
      </button>
    </form>
  );
}
