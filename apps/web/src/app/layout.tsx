import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { AuthProvider } from '@/hooks/useUserRole';
import { Navbar } from '@/components/layout/Navbar';
import { I18nProvider } from '@/lib/i18n/context';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { isValidLocale, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rentars — Decentralized P2P Rentals on Stellar',
  description:
    'Rentars is a peer-to-peer rental platform built on the Stellar blockchain. Minimal fees, instant payments, complete transparency.',
};

async function getInitialLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isValidLocale(value) ? (value as Locale) : DEFAULT_LOCALE;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLocale = await getInitialLocale();

  return (
    <html lang={initialLocale}>
      <body className={inter.className}>
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <I18nProvider initialLocale={initialLocale}>
          <AuthProvider>
            <OfflineBanner />
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
