/**
 * Unit tests for calendar controller — month/year input validation (#412).
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Request, Response } from 'express';

// ── Mock calendar service ──────────────────────────────────────────────────────

const mockGetMonthAvailability = mock(async () => ({
  success: true,
  data: { year: 2026, month: 6, days: [] },
}));

mock.module('../../src/services/calendar.service.js', () => ({
  getMonthAvailability: mockGetMonthAvailability,
  checkAvailabilityAtomic: mock(async () => ({ success: true, data: {} })),
  getAvailabilityRanges: mock(async () => ({ success: true, data: [] })),
}));

mock.module('../../src/services/pricing.service.js', () => ({
  calculateRangePrice: mock(async () => ({ success: true, data: { total: 100, breakdown: [] } })),
  getSeasonalPricing: mock(async () => ({ success: true, data: [] })),
  createSeasonalPricing: mock(async () => ({ success: true, data: {} })),
  deleteSeasonalPricing: mock(async () => ({ success: true })),
  createSpecialEvent: mock(async () => ({ success: true, data: {} })),
  deleteSpecialEvent: mock(async () => ({ success: true })),
  previewPricing: mock(async () => ({ success: true, data: {} })),
  getPropertyQuote: mock(async () => ({ success: true, data: {} })),
}));

import { getCalendarMonth } from '../../src/controllers/calendar.controller.js';

// ─────────────────────────────────────────────────────────────────────────────

function makeReqRes(query: Record<string, string>, params: Record<string, string> = { propertyId: 'prop-1' }) {
  const json = mock((_body: unknown) => {});
  const status = mock((_code: number) => ({ json } as unknown as Response));
  const res = { status, json } as unknown as Response;
  const req = { params, query } as unknown as Request;
  return { req, res, status, json };
}

describe('getCalendarMonth — input validation', () => {
  beforeEach(() => {
    mockGetMonthAvailability.mockClear();
  });

  it('passes valid year and month to the service', async () => {
    const { req, res, status } = makeReqRes({ year: '2026', month: '6' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).toHaveBeenCalledWith('prop-1', 2026, 6);
    expect(status).not.toHaveBeenCalledWith(422);
  });

  it('accepts January (month 1)', async () => {
    const { req, res, status } = makeReqRes({ year: '2026', month: '1' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).toHaveBeenCalledWith('prop-1', 2026, 1);
    expect(status).not.toHaveBeenCalledWith(422);
  });

  it('accepts December (month 12)', async () => {
    const { req, res, status } = makeReqRes({ year: '2026', month: '12' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).toHaveBeenCalledWith('prop-1', 2026, 12);
    expect(status).not.toHaveBeenCalledWith(422);
  });

  it('rejects month 0 with 422', async () => {
    const { req, res, status, json } = makeReqRes({ year: '2026', month: '0' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
    const jsonArg = (json as ReturnType<typeof mock>).mock.calls[0]?.[0] as { error: string };
    expect(jsonArg?.error).toContain('month');
  });

  it('rejects month 13 with 422', async () => {
    const { req, res, status, json } = makeReqRes({ year: '2026', month: '13' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
    const jsonArg = (json as ReturnType<typeof mock>).mock.calls[0]?.[0] as { error: string };
    expect(jsonArg?.error).toContain('month');
  });

  it('rejects a malformed month like "12abc" with 422', async () => {
    const { req, res, status, json } = makeReqRes({ year: '2026', month: '12abc' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
    const jsonArg = (json as ReturnType<typeof mock>).mock.calls[0]?.[0] as { error: string };
    expect(jsonArg?.error).toContain('month');
  });

  it('rejects a malformed year like "202abc" with 422', async () => {
    const { req, res, status, json } = makeReqRes({ year: '202abc', month: '6' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
    const jsonArg = (json as ReturnType<typeof mock>).mock.calls[0]?.[0] as { error: string };
    expect(jsonArg?.error).toContain('year');
  });

  it('rejects a floating-point month with 422', async () => {
    const { req, res, status } = makeReqRes({ year: '2026', month: '6.5' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
  });

  it('returns 400 when required params are missing', async () => {
    const { req, res, status } = makeReqRes({ year: '2026' });
    await getCalendarMonth(req, res);
    expect(mockGetMonthAvailability).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });
});
