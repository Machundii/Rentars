/**
 * Locale-aware formatting utilities.
 * All date/number formatting passes through these helpers so the active locale
 * is always respected, and components never call toLocaleString() directly.
 */
import type { Locale } from './config';

/**
 * Map our locale codes to BCP 47 language tags understood by Intl APIs.
 * Most match 1:1; extend if you add more locales.
 */
const BCP47: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-419', // Latin-American Spanish (emerging markets focus)
  fr: 'fr-FR',
  pt: 'pt-BR',  // Brazilian Portuguese (emerging markets focus)
};

export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(BCP47[locale], options).format(d);
}

export function formatCurrency(
  amount: number,
  locale: Locale,
  currency = 'USD',
): string {
  return new Intl.NumberFormat(BCP47[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(BCP47[locale], options).format(value);
}
