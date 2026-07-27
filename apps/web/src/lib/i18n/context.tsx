'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isValidLocale, type Locale } from './config';
import { getMessages } from './messages';
import type { TranslationSchema } from './locales/en';
import en from './locales/en';

interface I18nContextValue {
  locale: Locale;
  messages: TranslationSchema;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  messages: en,
  setLocale: () => undefined,
});

export function useI18nContext(): I18nContextValue {
  return useContext(I18nContext);
}

function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  return match && isValidLocale(match[1]) ? (match[1] as Locale) : null;
}

function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  // 1-year expiry, SameSite=Lax for cross-page navigation
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale};max-age=${maxAge};path=/;SameSite=Lax`;
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const lang = navigator.language?.split('-')[0];
  return isValidLocale(lang) ? (lang as Locale) : DEFAULT_LOCALE;
}

interface I18nProviderProps {
  children: ReactNode;
  /** Initial locale — pass from a server-read cookie on first render to avoid flicker. */
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [messages, setMessages] = useState<TranslationSchema>(en);

  // On mount: resolve locale priority: cookie > browser > default
  // Only run browser/cookie detection if no initialLocale was explicitly provided
  useEffect(() => {
    if (initialLocale) {
      // initialLocale was server-provided; just ensure the messages are loaded
      getMessages(initialLocale).then(setMessages);
      return;
    }
    const cookie = readLocaleCookie();
    const resolved = cookie ?? detectBrowserLocale();
    if (resolved !== locale) {
      setLocaleState(resolved);
    }
    getMessages(resolved).then(setMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocaleCookie(next);
    getMessages(next).then(setMessages);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, messages, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
