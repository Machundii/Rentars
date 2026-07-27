'use client';

import { useLocale } from '@/lib/i18n/useLocale';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { Globe } from 'lucide-react';

/**
 * Dropdown that lets users pick their preferred locale.
 * The choice is persisted in a cookie and takes effect immediately.
 */
export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="relative flex items-center">
      <label htmlFor="locale-select" className="sr-only">
        Select language
      </label>
      <Globe
        size={16}
        className="absolute left-2 pointer-events-none text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
      <select
        id="locale-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="
          pl-7 pr-2 py-1 text-sm rounded-md border border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
          focus:outline-none focus:ring-2 focus:ring-blue-500
          cursor-pointer appearance-none
        "
        aria-label="Language selector"
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
