/**
 * Tests for the i18n framework.
 * Verifies:
 * 1. String resolution in the base locale (en)
 * 2. String resolution in alternate locales (es, fr, pt)
 * 3. That switching locale updates rendered copy
 * 4. Locale-aware date and currency formatting
 * 5. Param interpolation in translation strings
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Locale config ──────────────────────────────────────────────────────────────
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, isValidLocale } from '@/lib/i18n/config';

// ── Translation resources ──────────────────────────────────────────────────────
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import fr from '@/lib/i18n/locales/fr';
import pt from '@/lib/i18n/locales/pt';

// ── Formatting utilities ───────────────────────────────────────────────────────
import { formatDate, formatCurrency, formatNumber } from '@/lib/i18n/formatting';

// ── Context + hooks ────────────────────────────────────────────────────────────
import { I18nProvider } from '@/lib/i18n/context';
import { useLocale } from '@/lib/i18n/useLocale';
import { useTranslations } from '@/lib/i18n/useTranslations';

// ── LocaleSwitcher component ───────────────────────────────────────────────────
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Render children wrapped in I18nProvider */
function withI18n(ui: React.ReactNode, initialLocale = DEFAULT_LOCALE) {
  return render(<I18nProvider initialLocale={initialLocale}>{ui}</I18nProvider>);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Config
// ─────────────────────────────────────────────────────────────────────────────
describe('i18n config', () => {
  it('DEFAULT_LOCALE is "en"', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('all supported locales have labels', () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[loc]).toBeTruthy();
    }
  });

  it('isValidLocale accepts supported codes', () => {
    expect(isValidLocale('en')).toBe(true);
    expect(isValidLocale('es')).toBe(true);
    expect(isValidLocale('xx')).toBe(false);
    expect(isValidLocale(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Translation resource shape
// ─────────────────────────────────────────────────────────────────────────────
describe('translation resources', () => {
  it('en has all required namespaces', () => {
    expect(en.nav).toBeDefined();
    expect(en.search).toBeDefined();
    expect(en.property).toBeDefined();
    expect(en.booking).toBeDefined();
    expect(en.home).toBeDefined();
    expect(en.common).toBeDefined();
  });

  it('es keys match en shape', () => {
    expect(Object.keys(es)).toEqual(Object.keys(en));
    expect(Object.keys(es.nav)).toEqual(Object.keys(en.nav));
    expect(Object.keys(es.search)).toEqual(Object.keys(en.search));
    expect(Object.keys(es.property)).toEqual(Object.keys(en.property));
    expect(Object.keys(es.booking)).toEqual(Object.keys(en.booking));
  });

  it('fr keys match en shape', () => {
    expect(Object.keys(fr)).toEqual(Object.keys(en));
    expect(Object.keys(fr.nav)).toEqual(Object.keys(en.nav));
  });

  it('pt keys match en shape', () => {
    expect(Object.keys(pt)).toEqual(Object.keys(en));
    expect(Object.keys(pt.booking)).toEqual(Object.keys(en.booking));
  });

  it('en base translations are non-empty strings', () => {
    for (const ns of Object.values(en)) {
      for (const [key, val] of Object.entries(ns)) {
        expect(typeof val, `en.${key}`).toBe('string');
        expect((val as string).length, `en.${key} should be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('locales differ from en (are actually translated)', () => {
    // Spot-check a few strings to confirm translation happened
    expect(es.nav.home).not.toBe(en.nav.home);
    expect(fr.nav.home).not.toBe(en.nav.home);
    expect(pt.nav.home).not.toBe(en.nav.home);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. useTranslations hook — string resolution
// ─────────────────────────────────────────────────────────────────────────────
function NavTest() {
  const t = useTranslations('nav');
  return <div data-testid="home">{t('home')}</div>;
}

function SearchCountTest({ count }: { count: number }) {
  const t = useTranslations('search');
  return <div data-testid="count">{t('propertiesCount', { count })}</div>;
}

describe('useTranslations', () => {
  it('resolves a string key in en', () => {
    withI18n(<NavTest />, 'en');
    expect(screen.getByTestId('home').textContent).toBe(en.nav.home);
  });

  it('resolves a string key in es', async () => {
    withI18n(<NavTest />, 'es');
    // Wait for async message load
    await waitFor(() => {
      expect(screen.getByTestId('home').textContent).toBe(es.nav.home);
    });
  });

  it('interpolates {count} param correctly', () => {
    withI18n(<SearchCountTest count={42} />, 'en');
    expect(screen.getByTestId('count').textContent).toBe('42 properties');
  });

  it('interpolates in es locale', async () => {
    withI18n(<SearchCountTest count={7} />, 'es');
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('7 propiedades');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Locale switcher — switching updates rendered copy
// ─────────────────────────────────────────────────────────────────────────────
function SwitchingTest() {
  const t = useTranslations('nav');
  return <p data-testid="home-label">{t('home')}</p>;
}

describe('locale switching', () => {
  it('renders en by default', () => {
    withI18n(
      <>
        <LocaleSwitcher />
        <SwitchingTest />
      </>,
      'en',
    );
    expect(screen.getByTestId('home-label').textContent).toBe(en.nav.home);
  });

  it('updates rendered copy when locale is switched to es', async () => {
    withI18n(
      <>
        <LocaleSwitcher />
        <SwitchingTest />
      </>,
      'en',
    );

    const select = screen.getByRole('combobox', { name: /language/i });

    await act(async () => {
      fireEvent.change(select, { target: { value: 'es' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('home-label').textContent).toBe(es.nav.home);
    });
  });

  it('updates rendered copy when locale is switched to fr', async () => {
    withI18n(
      <>
        <LocaleSwitcher />
        <SwitchingTest />
      </>,
      'en',
    );

    const select = screen.getByRole('combobox', { name: /language/i });

    await act(async () => {
      fireEvent.change(select, { target: { value: 'fr' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('home-label').textContent).toBe(fr.nav.home);
    });
  });

  it('useLocale returns the active locale', async () => {
    function LocaleDisplay() {
      const { locale } = useLocale();
      return <span data-testid="locale">{locale}</span>;
    }

    withI18n(
      <>
        <LocaleSwitcher />
        <LocaleDisplay />
      </>,
      'en',
    );

    // Initial locale should be what was passed to the provider
    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('en');
    });

    const select = screen.getByRole('combobox', { name: /language/i });
    await act(async () => {
      fireEvent.change(select, { target: { value: 'pt' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('pt');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Formatting
// ─────────────────────────────────────────────────────────────────────────────
describe('formatDate', () => {
  const date = new Date('2025-06-15T12:00:00Z');

  it('formats a date in en-US style', () => {
    const result = formatDate(date, 'en');
    expect(result).toMatch(/Jun/i);
    expect(result).toMatch(/2025/);
  });

  it('formats a date in es locale', () => {
    const result = formatDate(date, 'es');
    // Latin-American Spanish uses day-first ordering
    expect(result).toBeTruthy();
    expect(result).toMatch(/2025/);
  });

  it('formats a date in fr locale', () => {
    const result = formatDate(date, 'fr');
    expect(result).toMatch(/2025/);
  });

  it('accepts a date string', () => {
    const result = formatDate('2025-01-20', 'en');
    expect(result).toMatch(/2025/);
  });
});

describe('formatCurrency', () => {
  it('formats USD for en locale', () => {
    const result = formatCurrency(1234.5, 'en');
    expect(result).toContain('1,234.50');
  });

  it('formats amount for es locale', () => {
    const result = formatCurrency(1234.5, 'es');
    expect(result).toBeTruthy();
    expect(result).toMatch(/1.?234/);
  });

  it('formats amount for fr locale', () => {
    const result = formatCurrency(99.99, 'fr');
    expect(result).toBeTruthy();
    expect(result).toMatch(/99/);
  });

  it('formats amount for pt-BR locale', () => {
    const result = formatCurrency(500, 'pt');
    expect(result).toBeTruthy();
    expect(result).toMatch(/500/);
  });
});

describe('formatNumber', () => {
  it('formats integers for en', () => {
    expect(formatNumber(1000, 'en')).toBe('1,000');
  });

  it('formats integers for es (different thousands separator)', () => {
    const result = formatNumber(1000, 'es');
    expect(result).toMatch(/1.?000/);
  });
});
