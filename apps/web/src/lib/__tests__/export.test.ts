import { describe, expect, it } from 'vitest';
import { rowsToCsv } from '../export';

describe('rowsToCsv', () => {
  it('joins headers and rows with commas and newlines', () => {
    const csv = rowsToCsv(
      ['name', 'amount'],
      [
        ['Rent', 100],
        ['Deposit', 50],
      ]
    );
    expect(csv).toBe('name,amount\nRent,100\nDeposit,50');
  });

  it('quotes and escapes cells containing commas or quotes', () => {
    const csv = rowsToCsv(['description'], [['Hello, "world"']]);
    expect(csv).toBe('description\n"Hello, ""world"""');
  });

  it('serializes Date values as ISO strings', () => {
    const date = new Date('2026-01-15T00:00:00.000Z');
    const csv = rowsToCsv(['date'], [[date]]);
    expect(csv).toBe('date\n2026-01-15T00:00:00.000Z');
  });

  it('handles empty rows', () => {
    const csv = rowsToCsv(['a', 'b'], []);
    expect(csv).toBe('a,b');
  });
});
