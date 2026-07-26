'use client';

import { useI18nContext } from './context';
import type { TranslationSchema } from './locales/en';

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string ? (T[K] extends object ? K : never) : never }[keyof T]
  : never;

type Namespace = NestedKeyOf<TranslationSchema>;
type Messages<N extends Namespace> = TranslationSchema[N];

/**
 * Access a translation namespace from the active locale.
 *
 * Also returns `formatParam` for simple {placeholder} interpolation.
 *
 * @example
 * const t = useTranslations('nav');
 * <span>{t('home')}</span>
 *
 * @example with interpolation
 * const t = useTranslations('search');
 * <span>{t('propertiesCount', { count: 42 })}</span>
 */
export function useTranslations<N extends Namespace>(namespace: N) {
  const { messages } = useI18nContext();
  const ns = messages[namespace] as Messages<N>;

  function t(key: keyof Messages<N>, params?: Record<string, string | number>): string {
    const raw = ns[key] as string;
    if (!params) return raw;
    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      raw,
    );
  }

  return t;
}
