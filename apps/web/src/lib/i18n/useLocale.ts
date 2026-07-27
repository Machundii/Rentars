'use client';

import { useI18nContext } from './context';
import type { Locale } from './config';

/**
 * Returns the active locale and a setter that persists to cookie.
 *
 * @example
 * const { locale, setLocale } = useLocale();
 */
export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const { locale, setLocale } = useI18nContext();
  return { locale, setLocale };
}
