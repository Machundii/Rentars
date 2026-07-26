/**
 * i18n configuration — supported locales and the default.
 * Add new locales here; create a matching file in ./locales/.
 */

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'pt'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie name used to persist the user's locale choice. */
export const LOCALE_COOKIE = 'rntr_locale';

/** Human-readable locale labels shown in the switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
};

export function isValidLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}
