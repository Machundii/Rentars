import type { FormattedBooking } from './types';

const MS_PER_NIGHT = 24 * 60 * 60 * 1000;

export interface BookingPreferencesSummary {
  totalBookings: number;
  totalSpent: number;
  averageStayNights: number;
  favoriteLocation: string | null;
}

export function summarizeBookingPreferences(
  bookings: FormattedBooking[]
): BookingPreferencesSummary {
  if (bookings.length === 0) {
    return { totalBookings: 0, totalSpent: 0, averageStayNights: 0, favoriteLocation: null };
  }

  const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);

  const totalNights = bookings.reduce((sum, b) => {
    const nights = Math.max(
      0,
      Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / MS_PER_NIGHT)
    );
    return sum + nights;
  }, 0);

  const locationCounts = new Map<string, number>();
  for (const b of bookings) {
    locationCounts.set(b.location, (locationCounts.get(b.location) ?? 0) + 1);
  }
  const favoriteLocation =
    [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalBookings: bookings.length,
    totalSpent,
    averageStayNights: totalNights / bookings.length,
    favoriteLocation,
  };
}
