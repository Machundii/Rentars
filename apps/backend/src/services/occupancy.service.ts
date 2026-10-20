/**
 * Occupancy heatmap service.
 *
 * Returns the daily availability status for a property over a date range.
 * Status values:
 *   'booked'    — an active booking (Pending or Confirmed) covers this day
 *   'blocked'   — a manual availability block covers this day
 *   'available' — neither booked nor blocked
 *
 * Host-only: the controller enforces that only the property owner may call
 * this endpoint.
 */

import { z } from 'zod';
import { supabase } from '@/config/supabase.js';
import type { ServiceResponse } from './index.js';

// ─── Shared occupancy schema ──────────────────────────────────────────────────

/**
 * Canonical occupancy shape shared by search, quote, booking create/modify,
 * receipts, and contract arguments. All counts are non-negative integers and
 * at least one guest (adult or child) must be present.
 */
export const occupancySchema = z
  .object({
    adults:   z.number().int().min(0).max(50),
    children: z.number().int().min(0).max(50).default(0),
    infants:  z.number().int().min(0).max(50).default(0),
    pets:     z.number().int().min(0).max(50).default(0),
  })
  .refine((o) => o.adults + o.children >= 1, {
    message: 'At least one guest (adult or child) is required',
    path:    ['adults'],
  });

export type Occupancy = z.infer<typeof occupancySchema>;

/** Listing fields relevant to occupancy validation. */
export interface OccupancyListing {
  max_guests?: number | null;
  max_adults?: number | null;
  max_children?: number | null;
  max_infants?: number | null;
  max_pets?: number | null;
}

export interface OccupancyValidationResult {
  ok:     boolean;
  errors: string[];
}

/**
 * Coerce arbitrary input (query strings, JSON bodies, contract args) into a
 * canonical Occupancy object. Missing fields default to 0. Throws a ZodError
 * if the input cannot be represented as a valid occupancy.
 */
export function normalizeOccupancy(input: unknown): Occupancy {
  const raw = (input ?? {}) as Record<string, unknown>;
  const toInt = (v: unknown): number => {
    if (v === undefined || v === null || v === '') return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
  };
  return occupancySchema.parse({
    adults:   toInt(raw.adults),
    children: toInt(raw.children),
    infants:  toInt(raw.infants),
    pets:     toInt(raw.pets),
  });
}

/**
 * Enforce integer bounds and listing capacity limits. Returns a list of
 * human-readable errors; empty list means the occupancy is acceptable.
 */
export function validateOccupancyAgainstListing(
  occupancy: Occupancy,
  listing:   OccupancyListing,
): OccupancyValidationResult {
  const errors: string[] = [];

  const parsed = occupancySchema.safeParse(occupancy);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(issue.message);
    return { ok: false, errors };
  }

  const o = parsed.data;
  const totalGuests = o.adults + o.children;

  if (listing.max_guests != null && totalGuests > listing.max_guests) {
    errors.push(`Total guests (${totalGuests}) exceeds listing maximum of ${listing.max_guests}`);
  }
  if (listing.max_adults != null && o.adults > listing.max_adults) {
    errors.push(`Adults (${o.adults}) exceeds listing maximum of ${listing.max_adults}`);
  }
  if (listing.max_children != null && o.children > listing.max_children) {
    errors.push(`Children (${o.children}) exceeds listing maximum of ${listing.max_children}`);
  }
  if (listing.max_infants != null && o.infants > listing.max_infants) {
    errors.push(`Infants (${o.infants}) exceeds listing maximum of ${listing.max_infants}`);
  }
  if (listing.max_pets != null && o.pets > listing.max_pets) {
    errors.push(`Pets (${o.pets}) exceeds listing maximum of ${listing.max_pets}`);
  }

  return { ok: errors.length === 0, errors };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DayStatus = 'booked' | 'blocked' | 'available';

export interface DayEntry {
  date:   string;     // ISO YYYY-MM-DD
  status: DayStatus;
}

export interface OccupancyHeatmapResult {
  propertyId: string;
  from:       string;
  to:         string;
  days:       DayEntry[];
  summary: {
    booked:    number;
    blocked:   number;
    available: number;
    total:     number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return every calendar date (YYYY-MM-DD) in the range [from, to] inclusive. */
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(from + 'T00:00:00Z');
  const end    = new Date(to   + 'T00:00:00Z');
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Return true if [rangeStart, rangeEnd) overlaps with the given date. */
function coversDate(rangeStart: string, rangeEnd: string, date: string): boolean {
  // check_in <= date < check_out  (check_out is the departure day, not a night)
  return rangeStart <= date && date < rangeEnd;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Build a per-day status map for a property over the requested horizon.
 *
 * @param propertyId  - UUID of the property
 * @param from        - ISO date string, inclusive start
 * @param to          - ISO date string, inclusive end
 */
export async function getOccupancyHeatmap(
  propertyId: string,
  from:        string,
  to:          string,
): Promise<ServiceResponse<OccupancyHeatmapResult>> {
  if (!propertyId) return { success: false, error: 'propertyId is required' };

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate   = new Date(to   + 'T00:00:00Z');

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' };
  }

  if (fromDate > toDate) {
    return { success: false, error: '`from` must be on or before `to`' };
  }

  // Cap horizon at 366 days to prevent accidental huge queries
  const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  if (diffDays > 366) {
    return { success: false, error: 'Date range must not exceed 366 days' };
  }

  // ── Fetch bookings that overlap [from, to] ──────────────────────────────
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('check_in, check_out, status')
    .eq('property_id', propertyId)
    .not('status', 'eq', 'Cancelled')
    .lt('check_in', to)       // starts before the window ends
    .gt('check_out', from);   // ends after the window starts

  if (bErr) return { success: false, error: bErr.message };

  // ── Fetch manual availability blocks that overlap [from, to] ──────────
  const { data: blocks, error: blErr } = await supabase
    .from('availability_ranges')
    .select('start_date, end_date')
    .eq('property_id', propertyId)
    .eq('is_available', false)
    .lt('start_date', to)
    .gt('end_date', from);

  if (blErr) return { success: false, error: blErr.message };

  // ── Build sets for O(1) lookup ─────────────────────────────────────────
  const bookedDays  = new Set<string>();
  const blockedDays = new Set<string>();

  for (const b of (bookings ?? []) as { check_in: string; check_out: string; status: string }[]) {
    for (const d of dateRange(
      b.check_in  > from ? b.check_in  : from,
      b.check_out < to   ? b.check_out : to,
    )) {
      if (coversDate(b.check_in, b.check_out, d)) bookedDays.add(d);
    }
  }

  for (const bl of (blocks ?? []) as { start_date: string; end_date: string }[]) {
    for (const d of dateRange(
      bl.start_date > from ? bl.start_date : from,
      bl.end_date   < to   ? bl.end_date   : to,
    )) {
      if (coversDate(bl.start_date, bl.end_date, d)) blockedDays.add(d);
    }
  }

  // ── Assemble per-day entries ────────────────────────────────────────────
  const allDates = dateRange(from, to);
  const days: DayEntry[] = allDates.map((date) => {
    let status: DayStatus = 'available';
    if (bookedDays.has(date))       status = 'booked';
    else if (blockedDays.has(date)) status = 'blocked';
    return { date, status };
  });

  const summary = {
    booked:    days.filter((d) => d.status === 'booked').length,
    blocked:   days.filter((d) => d.status === 'blocked').length,
    available: days.filter((d) => d.status === 'available').length,
    total:     days.length,
  };

  return {
    success: true,
    data: { propertyId, from, to, days, summary },
  };
}
