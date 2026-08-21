/**
 * Lazily load the translation bundle for a given locale.
 * Keeps initial bundle small — only the active locale is imported.
 */
import type { Locale } from './config';
import type { TranslationSchema } from './locales/en';

const loaders: Record<Locale, () => Promise<{ default: TranslationSchema }>> = {
  en: () => import('./locales/en'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  pt: () => import('./locales/pt'),
};

const cache = new Map<Locale, TranslationSchema>();

export async function getMessages(locale: Locale): Promise<TranslationSchema> {
  if (cache.has(locale)) return cache.get(locale)!;
  const mod = await loaders[locale]();
  cache.set(locale, mod.default);
  return mod.default;
}

/** Synchronously return the cached messages for a locale (falls back to en). */
export function getMessagesSync(locale: Locale): TranslationSchema {
  if (cache.has(locale)) return cache.get(locale)!;
  // Pre-load happens in I18nProvider; this fallback is for SSR safety
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./locales/en').default as TranslationSchema;
}
