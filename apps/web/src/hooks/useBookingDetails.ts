'use client';

import { useEffect, useState } from 'react';
import type { Booking } from '@/types/booking';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PriceBreakdown {
  base_nightly_rate: number;
  nights: number;
  subtotal: number;
  dynamic_adjustments: number;
  platform_fee_pct: number;
  platform_fee: number;
  total: number;
  breakdown: Array<{ date: string; price: number; is_available: boolean; reason?: string }>;
}

export function useBookingDetails(bookingId: string) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(async (data: Booking) => {
        setBooking(data);
        if (data.property_id && data.check_in && data.check_out) {
          const start = data.check_in.split('T')[0];
          const end = data.check_out.split('T')[0];
          const quoteRes = await fetch(
            `${API_URL}/api/v1/properties/${data.property_id}/quote?start=${start}&end=${end}`,
          ).catch(() => null);
          if (quoteRes?.ok) {
            setPriceBreakdown(await quoteRes.json());
          }
        }
      })
      .catch(() => setError('Failed to load booking'))
      .finally(() => setIsLoading(false));
  }, [bookingId]);

  return { booking, priceBreakdown, isLoading, error };
}
