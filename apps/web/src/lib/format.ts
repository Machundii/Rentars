/**
 * Formatting utilities for currency and dates with i18n support
 * These are convenience wrappers around the i18n formatting system
 */

import type { Locale } from './i18n/config';
import { formatCurrency, formatDate as formatDateI18n } from './i18n/formatting';

const DEFAULT_LOCALE: Locale = 'en';
const USDC_DECIMALS = 2;

/**
 * Format USDC amount with proper precision and locale
 */
export function formatUSDC(amount: number, locale: Locale = DEFAULT_LOCALE): string {
  return formatCurrency(amount, locale, 'USD');
}

/**
 * Format price per night with USDC currency
 */
export function formatPricePerNight(
  pricePerNight: number,
  locale = DEFAULT_LOCALE
): string {
  return `${formatUSDC(pricePerNight, locale)} / night`;
}

/**
 * Format a date in a readable way
 */
export function formatDate(
  date: Date | string,
  locale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });

  return formatter.format(dateObj);
}

/**
 * Format a date without year (for same-year ranges)
 */
export function formatDateShort(
  date: Date | string,
  locale = DEFAULT_LOCALE
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  });

  return formatter.format(dateObj);
}

/**
 * Format a date range
 * Examples:
 *   - "Jun 25 – Jul 2, 2026" (different months/years)
 *   - "Jun 25 – Jul 2, 2026" (same year)
 *   - "Jan 15 – 22, 2026" (same month and year)
 */
export function formatDateRange(
  startDate: Date | string,
  endDate: Date | string,
  locale = DEFAULT_LOCALE
): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  // Check if same month and year
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    const startFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });
    const endDay = end.getDate();
    return `${startFormatter.format(start)} – ${endDay}`;
  }

  // Check if same year
  if (start.getFullYear() === end.getFullYear()) {
    const startFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });
    const endFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${startFormatter.format(start)} – ${endFormatter.format(end)}`;
  }

  // Different years
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}

/**
 * Format a duration in nights
 */
export function formatNights(nights: number): string {
  return nights === 1 ? '1 night' : `${nights} nights`;
}

/**
 * Format total price
 */
export function formatTotalPrice(
  pricePerNight: number,
  numberOfNights: number,
  locale = DEFAULT_LOCALE
): string {
  const total = pricePerNight * numberOfNights;
  return formatUSDC(total, locale);
}

/**
 * Get user's preferred locale from browser
 */
export function getPreferredLocale(): string {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const language = navigator.language || DEFAULT_LOCALE;
  return language;
}
