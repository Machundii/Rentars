import { describe, it, expect } from 'vitest';
import {
  formatUSDC,
  formatPricePerNight,
  formatDate,
  formatDateShort,
  formatDateRange,
  formatNights,
  formatTotalPrice,
  getPreferredLocale,
} from '../format';

describe('Format utilities', () => {
  describe('formatUSDC', () => {
    it('formats USDC amount with 2 decimals', () => {
      const result = formatUSDC(100, 'en-US');
      expect(result).toBe('$100.00');
    });

    it('handles small amounts', () => {
      const result = formatUSDC(0.50, 'en-US');
      expect(result).toBe('$0.50');
    });

    it('handles large amounts', () => {
      const result = formatUSDC(1000.99, 'en-US');
      expect(result).toBe('$1,000.99');
    });

    it('maintains 2 decimal precision', () => {
      const result = formatUSDC(50, 'en-US');
      expect(result).toMatch(/\.00$/);
    });

    it('supports different locales', () => {
      const usFormat = formatUSDC(100, 'en-US');
      const deFormat = formatUSDC(100, 'de-DE');
      expect(usFormat).not.toBe(deFormat);
    });
  });

  describe('formatPricePerNight', () => {
    it('formats price with per night suffix', () => {
      const result = formatPricePerNight(100, 'en-US');
      expect(result).toMatch(/\$100\.00 \/ night/);
    });
  });

  describe('formatDate', () => {
    it('formats date in readable format', () => {
      const date = new Date('2026-06-25');
      const result = formatDate(date, 'en-US');
      expect(result).toContain('Jun');
      expect(result).toContain('25');
      expect(result).toContain('2026');
    });

    it('handles string dates', () => {
      const result = formatDate('2026-06-25', 'en-US');
      expect(result).toContain('Jun');
    });

    it('respects locale', () => {
      const date = new Date('2026-06-25');
      const usFormat = formatDate(date, 'en-US');
      const deFormat = formatDate(date, 'de-DE');
      expect(usFormat).not.toBe(deFormat);
    });
  });

  describe('formatDateShort', () => {
    it('formats date without year', () => {
      const date = new Date('2026-06-25');
      const result = formatDateShort(date, 'en-US');
      expect(result).toContain('Jun');
      expect(result).toContain('25');
      expect(result).not.toContain('2026');
    });
  });

  describe('formatDateRange', () => {
    it('formats range in same month and year', () => {
      const start = new Date('2026-06-15');
      const end = new Date('2026-06-22');
      const result = formatDateRange(start, end, 'en-US');
      expect(result).toMatch(/Jun 15 – 22/);
    });

    it('formats range in different months, same year', () => {
      const start = new Date('2026-06-25');
      const end = new Date('2026-07-02');
      const result = formatDateRange(start, end, 'en-US');
      expect(result).toMatch(/Jun 25 – Jul 2/);
      expect(result).toContain('2026');
    });

    it('formats range in different years', () => {
      const start = new Date('2025-12-25');
      const end = new Date('2026-01-02');
      const result = formatDateRange(start, end, 'en-US');
      expect(result).toContain('2025');
      expect(result).toContain('2026');
    });

    it('handles string dates', () => {
      const result = formatDateRange('2026-06-25', '2026-07-02', 'en-US');
      expect(result).toContain('Jun');
      expect(result).toContain('Jul');
    });
  });

  describe('formatNights', () => {
    it('formats single night', () => {
      expect(formatNights(1)).toBe('1 night');
    });

    it('formats multiple nights', () => {
      expect(formatNights(2)).toBe('2 nights');
      expect(formatNights(7)).toBe('7 nights');
    });
  });

  describe('formatTotalPrice', () => {
    it('calculates and formats total price', () => {
      const result = formatTotalPrice(100, 7, 'en-US');
      expect(result).toBe('$700.00');
    });

    it('handles fractional prices', () => {
      const result = formatTotalPrice(49.99, 3, 'en-US');
      expect(result).toBe('$149.97');
    });

    it('respects locale', () => {
      const usFormat = formatTotalPrice(100, 2, 'en-US');
      const deFormat = formatTotalPrice(100, 2, 'de-DE');
      expect(usFormat).not.toBe(deFormat);
    });
  });

  describe('getPreferredLocale', () => {
    it('returns a valid locale string', () => {
      const locale = getPreferredLocale();
      expect(typeof locale).toBe('string');
      expect(locale.length).toBeGreaterThan(0);
    });
  });
});
