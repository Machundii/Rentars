/**
 * Receipt service — generates an immutable PDF receipt for a confirmed /
 * completed booking using the zero-dependency PdfBuilder utility.
 *
 * Receipts are built from a canonical, versioned financial snapshot that is
 * derived from settled payment / ledger rows (never from mutable listing
 * prices). The snapshot is persisted once per booking (keyed by booking id)
 * and reused on every regeneration, so retries and re-downloads can never
 * alter the financial data or trigger duplicate payments.
 *
 * Access is restricted to booking participants (tenant / host / admin) via
 * the booking authorization helper.
 */

import { supabase } from '@/config/supabase.js';
import { PdfBuilder } from '@/utils/pdf.js';
import { assertBookingParticipant } from './bookingAuthorization.js';
import type { ServiceResponse } from './index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_FEE_RATE = 0.1; // 10 % — fallback only when ledger has no fee row
const EXPLORER_BASE = 'https://stellar.expert/explorer/public/tx';
const RECEIPT_SCHEMA_VERSION = 1;
const DEFAULT_POLICY_VERSION = 'v1';
const DEFAULT_NETWORK = 'stellar';
const DEFAULT_CURRENCY = 'USDC';
const MAX_RENDER_ATTEMPTS = 3;
const RECEIPTS_TABLE = 'booking_receipts';

// Layout (points, y measured from top of A4)
const ML = 60;
const W  = PdfBuilder.PAGE_WIDTH - ML - ML; // 475.28 pt

// Brand colours
const BLUE  = '#2563EB';
const WHITE = '#FFFFFF';
const DARK  = '#111827';
const MUTED = '#6B7280';
const LIGHT = '#F3F4F6';
const LINE  = '#E5E7EB';
const GREEN = '#059669';
const AMBER = '#D97706';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptData {
  bookingId:       string;
  propertyTitle:   string;
  propertyAddress: string;
  checkIn:         string;
  checkOut:        string;
  nights:          number;
  pricePerNight:   number;
  subtotal:        number;
  platformFee:     number;
  total:           number;
  guestCount:      number;
  status:          string;
  tenantName?:     string;
  tenantEmail?:    string;
  escrowId?:       string;
  onChainId?:      number;
  createdAt:       string;
  /**
   * Display-currency fields — informational only, never used for settlement.
   * See: docs/I18N_CURRENCY_POLICY.md §3
   */
  displayCurrency?: string;        // ISO 4217 code, e.g. "EUR"
  displayAmount?:   number | null; // converted amount at booking time
  rateTimestampMs?: number;        // Unix ms when rate was fetched
  rateStale?:       boolean;       // whether the rate was stale at booking time
}

/**
 * Canonical, immutable financial snapshot for a booking receipt.
 *
 * Every monetary field is captured from settled payment / ledger records at
 * snapshot time and is never recomputed afterwards. `snapshotVersion` and
 * `policyVersion` record which rules applied when the booking was made.
 */
export interface ReceiptSnapshot {
  schemaVersion:   number;   // receipt snapshot schema version
  snapshotVersion: number;   // monotonically increasing per booking
  policyVersion:   string;   // booking/pricing policy version at booking time
  bookingId:       string;
  settledAt:       string;   // ISO timestamp of the settled ledger entry
  currency:        string;   // settlement currency, e.g. "USDC"
  network:         string;   // settlement network, e.g. "stellar"
  transactionRef?: string;   // on-chain tx hash / ledger reference
  escrowId?:       string;
  onChainId?:      number;
  pricePerNight:   number;
  nights:          number;
  subtotal:        number;
  platformFee:     number;
  total:           number;
  guestCount:      number;
  adults?:         number;
  children?:       number;
  status:          string;
  propertyTitle:   string;
  propertyAddress: string;
  checkIn:         string;
  checkOut:        string;
  tenantName?:     string;
  tenantEmail?:    string;
  createdAt:       string;
  displayCurrency?: string;
  displayAmount?:   number | null;
  rateTimestampMs?: number;
  rateStale?:       boolean;
}

export interface ReceiptAccessContext {
  userId: string;
  role?:  string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count the number of nights between two ISO date strings.
 *
 * Uses UTC-normalised date-only arithmetic so that DST transitions
 * (where a wall-clock day can be 23 or 25 hours long) never produce an
 * off-by-one result. Each "date" is treated as midnight UTC, regardless of
 * local timezone or DST rules.
 *
 * Returns at least 1 to handle same-day edge cases gracefully.
 */
export function calcNights(checkIn: string, checkOut: string): number {
  // Parse only the date portion (YYYY-MM-DD) and interpret it as UTC
  // midnight so DST offsets cannot inflate or deflate the difference.
  const parseUTCDate = (iso: string): number => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const msPerDay = 86_400_000;
  const diff = parseUTCDate(checkOut) - parseUTCDate(checkIn);
  return Math.max(1, Math.round(diff / msPerDay));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a persisted snapshot row back into ReceiptData for rendering. */
function snapshotToReceiptData(s: ReceiptSnapshot): ReceiptData {
  return {
    bookingId:       s.bookingId,
    propertyTitle:   s.propertyTitle,
    propertyAddress: s.propertyAddress,
    checkIn:         s.checkIn,
    checkOut:        s.checkOut,
    nights:          s.nights,
    pricePerNight:   s.pricePerNight,
    subtotal:        s.subtotal,
    platformFee:     s.platformFee,
    total:           s.total,
    guestCount:      s.guestCount,
    status:          s.status,
    tenantName:      s.tenantName,
    tenantEmail:     s.tenantEmail,
    escrowId:        s.escrowId,
    onChainId:       s.onChainId,
    createdAt:       s.createdAt,
    displayCurrency: s.displayCurrency,
    displayAmount:   s.displayAmount ?? null,
    rateTimestampMs: s.rateTimestampMs,
    rateStale:       s.rateStale,
  };
}

// ─── Data layer ───────────────────────────────────────────────────────────────

type BookingRow = {
  id: string; property_id: string; tenant_id: string;
  check_in: string; check_out: string; guest_count: number;
  adults?: number | null; children?: number | null;
  total_price: number; status: string; escrow_id?: string;
  on_chain_id?: number; created_at: string;
  policy_version?: string | null;
  display_currency?: string | null;
  display_amount?: number | null;
  rate_timestamp_ms?: number | null;
  rate_stale?: boolean | null;
  properties: { title: string; address?: string; city?: string; country?: string; price_per_night?: number } | null;
};

type LedgerRow = {
  amount?: number | null;
  fee_amount?: number | null;
  currency?: string | null;
  network?: string | null;
  transaction_ref?: string | null;
  settled_at?: string | null;
  status?: string | null;
};

/**
 * Load the canonical settled ledger row for a booking, if one exists.
 * Returns null when no settled payment record is available.
 */
async function fetchSettledLedger(bookingId: string): Promise<LedgerRow | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, fee_amount, currency, network, transaction_ref, settled_at, status')
    .eq('booking_id', bookingId)
    .in('status', ['settled', 'completed', 'released'])
    .order('settled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as LedgerRow;
}

/**
 * Build a canonical snapshot from settled records. This is the ONLY place
 * financial values are derived; once persisted the snapshot is immutable.
 */
async function buildSnapshot(bookingId: string): Promise<ServiceResponse<ReceiptSnapshot>> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `id, property_id, tenant_id, check_in, check_out, guest_count,
       adults, children, total_price, status, escrow_id, on_chain_id,
       created_at, policy_version, display_currency, display_amount,
       rate_timestamp_ms, rate_stale,
       properties ( title, address, city, country, price_per_night )`,
    )
    .eq('id', bookingId)
    .single();

  if (error || !booking) return { success: false, error: 'Booking not found' };

  const b = booking as BookingRow;
  const prop = b.properties;
  const nights = calcNights(b.check_in, b.check_out);

  const ledger = await fetchSettledLedger(bookingId);

  // Prefer settled ledger values; fall back to booking totals only when no
  // settled record exists yet (e.g. legacy bookings).
  const pricePerNight = prop?.price_per_night ?? 0;
  const subtotal = ledger?.amount != null
    ? round2(ledger.amount)
    : round2(pricePerNight * nights);
  const platformFee = ledger?.fee_amount != null
    ? round2(ledger.fee_amount)
    : round2(subtotal * PLATFORM_FEE_RATE);
  const total = b.total_price != null
    ? round2(b.total_price)
    : round2(subtotal + platformFee);

  const address = [prop?.address, prop?.city, prop?.country].filter(Boolean).join(', ');

  let tenantName:  string | undefined;
  let tenantEmail: string | undefined;
  if (b.tenant_id) {
    const [profileResult, userResult] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('user_id', b.tenant_id).maybeSingle(),
      supabase.from('users').select('email').eq('id', b.tenant_id).maybeSingle(),
    ]);
    tenantName  = (profileResult.data as { display_name?: string } | null)?.display_name ?? undefined;
    tenantEmail = (userResult.data   as { email?: string }         | null)?.email         ?? undefined;
  }

  const snapshot: ReceiptSnapshot = {
    schemaVersion:   RECEIPT_SCHEMA_VERSION,
    snapshotVersion: 1,
    policyVersion:   b.policy_version ?? DEFAULT_POLICY_VERSION,
    bookingId:       b.id,
    settledAt:       ledger?.settled_at ?? b.created_at,
    currency:        ledger?.currency ?? DEFAULT_CURRENCY,
    network:         ledger?.network ?? DEFAULT_NETWORK,
    transactionRef:  ledger?.transaction_ref ?? undefined,
    escrowId:        b.escrow_id,
    onChainId:       b.on_chain_id,
    pricePerNight,
    nights,
    subtotal,
    platformFee,
    total,
    guestCount:      b.guest_count,
    adults:          b.adults ?? undefined,
    children:        b.children ?? undefined,
    status:          b.status,
    propertyTitle:   prop?.title ?? 'Rental Property',
    propertyAddress: address,
    checkIn:         b.check_in,
    checkOut:        b.check_out,
    tenantName,
    tenantEmail,
    createdAt:       b.created_at,
    displayCurrency: b.display_currency ?? undefined,
    displayAmount:   b.display_amount ?? null,
    rateTimestampMs: b.rate_timestamp_ms ?? undefined,
    rateStale:       b.rate_stale ?? undefined,
  };

  return { success: true, data: snapshot };
}

/**
 * Return the persisted snapshot for a booking, creating it once if absent.
 * Regeneration is idempotent: an existing snapshot is always returned as-is
 * and never recomputed, so retries cannot mutate financial data.
 */
export async function getOrCreateSnapshot(
  bookingId: string,
): Promise<ServiceResponse<ReceiptSnapshot>> {
  if (!bookingId) return { success: false, error: 'Booking ID is required' };

  const { data: existing, error: readErr } = await supabase
    .from(RECEIPTS_TABLE)
    .select('snapshot')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (!readErr && existing?.snapshot) {
    return { success: true, data: existing.snapshot as ReceiptSnapshot };
  }

  const built = await buildSnapshot(bookingId);
  if (!built.success || !built.data) return built;

  // Insert-if-absent; on conflict keep the first persisted snapshot.
  const { data: inserted, error: insertErr } = await supabase
    .from(RECEIPTS_TABLE)
    .upsert(
      {
        booking_id: bookingId,
        snapshot: built.data,
        schema_version: built.data.schemaVersion,
        policy_version: built.data.policyVersion,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id', ignoreDuplicates: true },
    )
    .select('snapshot')
    .maybeSingle();

  if (insertErr) {
    // Race: another writer may have persisted first — re-read.
    const { data: raced } = await supabase
      .from(RECEIPTS_TABLE)
      .select('snapshot')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (raced?.snapshot) return { success: true, data: raced.snapshot as ReceiptSnapshot };
    return { success: false, error: 'Failed to persist receipt snapshot' };
  }

  const persisted = (inserted?.snapshot as ReceiptSnapshot | undefined) ?? built.data;
  return { success: true, data: persisted };
}

/**
 * Fetch receipt data for rendering. Returns the immutable snapshot values.
 */
export async function fetchReceiptData(
  bookingId: string,
): Promise<ServiceResponse<ReceiptData>> {
  const snap = await getOrCreateSnapshot(bookingId);
  if (!snap.success || !snap.data) return { success: false, error: snap.error };
  return { success: true, data: snapshotToReceiptData(snap.data) };
}

/**
 * Render the receipt PDF with bounded retries. Rendering is pure and never
 * touches financial data, so retries are safe and cannot trigger payments.
 */
export async function renderReceiptPdf(
  bookingId: string,
): Promise<ServiceResponse<Buffer>> {
  const snap = await getOrCreateSnapshot(bookingId);
  if (!snap.success || !snap.data) return { success: false, error: snap.error };

  const data = snapshotToReceiptData(snap.data);
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
    try {
      return { success: true, data: generateReceiptPdf(data) };
    } catch (err) {
      lastError = err;
    }
  }
  return {
    success: false,
    error: `Receipt rendering failed: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
  };
}

/**
 * Access-controlled receipt download. Only booking participants (tenant,
 * host, or admin) may obtain the PDF.
 */
export async function downloadReceipt(
  bookingId: string,
  ctx: ReceiptAccessContext,
): Promise<ServiceResponse<Buffer>> {
  if (!bookingId) return { success: false, error: 'Booking ID is required' };
  if (!ctx?.userId) return { success: false, error: 'Unauthorized' };

  const auth = await assertBookingParticipant(bookingId, ctx.userId, ctx.role);
  if (!auth.success) return { success: false, error: auth.error ?? 'Forbidden' };

  return renderReceiptPdf(bookingId);
}

// ─── PDF generation ───────────────────────────────────────────────────────────

export function generateReceiptPdf(data: ReceiptData): Buffer {
  const pdf = new PdfBuilder();
  let y = 50; // current y from top of page

  // ── Header bar ────────────────────────────────────────────────────────────
  // PdfBuilder.rect uses bottom-origin PDF coords; we convert here.
  // y=50 from top → PDF y = PAGE_HEIGHT - 50 - 60 (height) = 731.89
  const headerPdfY = PdfBuilder.PAGE_HEIGHT - y - 60;
  pdf.rect(ML, headerPdfY, W, 60, { fill: BLUE });

  pdf.text('Rentars',          ML + 14, y + 12, { size: 22, bold: true, colour: WHITE });
  pdf.text('Booking Receipt',  ML + 14, y + 38, { size: 10, colour: WHITE });
  pdf.text('RECEIPT',          ML + W - 80, y + 12, { size: 10, bold: true, colour: WHITE, align: 'right', width: 80 });
  pdf.text(fmtDate(data.createdAt), ML + W - 80, y + 28, { size: 8, colour: WHITE, align: 'right', width: 80 });

  y += 76;

  // ── Booking ID banner ────────────────────────────────────────────────────
  const bannerPdfY = PdfBuilder.PAGE_HEIGHT - y - 30;
  pdf.rect(ML, bannerPdfY, W, 30, { fill: LIGHT });
  pdf.text('BOOKING ID', ML + 10, y + 6,  { size: 7, colour: MUTED });
  pdf.text(data.bookingId, ML + 10, y + 16, { size: 8, bold: true, colour: DARK });
  pdf.text('STATUS',      ML + W - 90, y + 6,  { size: 7, colour: MUTED, align: 'right', width: 90 });
  const statusColour = ['Confirmed', 'confirmed', 'Completed', 'completed'].includes(data.status) ? GREEN : AMBER;
  pdf.text(data.status.toUpperCase(), ML + W - 90, y + 16, { size: 8, bold: true, colour: statusColour, align: 'right', width: 90 });

  y += 46;

  // ── Property ─────────────────────────────────────────────────────────────
  pdf.text(data.propertyTitle, ML, y, { size: 13, bold: true, colour: DARK });
  y += 18;
  if (data.propertyAddress) {
    pdf.text(data.propertyAddress, ML, y, { size: 9, colour: MUTED });
    y += 14;
  }
  y += 4;

  // ── Tenant info ──────────────────────────────────────────────────────────
  if (data.tenantName || data.tenantEmail) {
    pdf.text('Guest', ML, y, { size: 7, colour: MUTED });
    y += 11;
    if (data.tenantName) {
      pdf.text(data.tenantName, ML, y, { size: 10, bold: true, colour: DARK });
      y += 14;
    }
    if (data.tenantEmail) {
      pdf.text(data.tenantEmail, ML, y, { size: 8, colour: MUTED });
      y += 12;
    }
  }
  y += 8;

  // ── Divider ──────────────────────────────────────────────────────────────
  pdf.hline(ML, PdfBuilder.PAGE_HEIGHT - y, W, LINE);
  y += 12;

  // ── Stay dates ────────────────────────────────────────────────────────────
  const col = W / 3;
  const guestLabel = data.guestCount === 1 ? '1 guest' : `${data.guestCount} guests`;
  const dateFields: [string, string][] = [
    ['Check-in',  fmtDate(data.checkIn)],
    ['Check-out', fmtDate(data.checkOut)],
    ['Guests',    guestLabel],
  ];
  dateFields.forEach(([label, val], i) => {
    const x = ML + i * col;
    pdf.text(label, x, y,      { size: 8,  colour: MUTED });
    pdf.text(val,   x, y + 12, { size: 10, bold: true, colour: DARK });
  });
  y += 36;

  // ── Divider ──────────────────────────────────────────────────────────────
  pdf.hline(ML, PdfBuilder.PAGE_HEIGHT - y, W, LINE);
  y += 16;

  // ── Price breakdown heading ───────────────────────────────────────────────
  pdf.text('Price Breakdown', ML, y, { size: 11, bold: true, colour: DARK });
  y += 18;

  // Line-item helper
  const item = (label: string, value: string, bold = false, colour = MUTED) => {
    pdf.text(label, ML,        y, { size: bold ? 10 : 9, bold, colour: bold ? DARK : colour });
    pdf.text(value, ML + W - 120, y, { size: bold ? 10 : 9, bold, colour, width: 120, align: 'right' });
    y += bold ? 16 : 14;
  };

  item(
    `${data.pricePerNight} USDC x ${data.nights} night${data.nights !== 1 ? 's' : ''}`,
    `${data.subtotal.toFixed(2)} USDC`,
  );
  item('Platform fee (10%)', `${data.platformFee.toFixed(2)} USDC`);

  y += 4;
  pdf.hline(ML, PdfBuilder.PAGE_HEIGHT - y, W, LINE);
  y += 10;

  item('Total', `${data.total.toFixed(2)} USDC`, true, BLUE);
  y += 12;

  // ── Display currency conversion note (informational only) ────────────────
  if (data.displayCurrency && data.displayCurrency !== 'USD' && data.displayAmount != null) {
    const rateLabel = data.rateTimestampMs
      ? new Date(data.rateTimestampMs).toUTCString()
      : 'unknown';
    const staleNote = data.rateStale ? ' (rate may be outdated)' : '';
    pdf.hline(ML, PdfBuilder.PAGE_HEIGHT - y, W, LINE);
    y += 10;
    pdf.text('Display Currency (informational only)', ML, y, { size: 9, bold: true, colour: DARK });
    y += 14;
    pdf.text('Settlement amount', ML, y,           { size: 7, colour: MUTED });
    pdf.text(`${data.total.toFixed(2)} USDC`,   ML + W - 120, y, { size: 8, colour: DARK, width: 120, align: 'right' });
    y += 12;
    const dispFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.displayCurrency,
    }).format(data.displayAmount);
    pdf.text(`Approx. ${data.displayCurrency} amount`, ML, y,           { size: 7, colour: MUTED });
    pdf.text(`${dispFormatted}${staleNote}`,            ML + W - 120, y, { size: 8, colour: AMBER, width: 120, align: 'right' });
    y += 12;
    pdf.text('Rate timestamp', ML, y,       { size: 7, colour: MUTED });
    pdf.text(rateLabel,        ML, y + 10,  { size: 7, colour: MUTED });
    y += 22;
    pdf.text(
      'Prices shown in a local currency are estimates only. "USD $" is not guaranteed.',
      ML, y, { size: 7, colour: MUTED },
    );
    y += 12;
  }

  // ── Blockchain reference ─────────────────────────────────────────────────
  if (data.escrowId || data.onChainId !== undefined) {
    pdf.hline(ML, PdfBuilder.PAGE_HEIGHT - y, W, LINE);
    y += 14;
    pdf.text('Blockchain Reference', ML, y, { size: 11, bold: true, colour: DARK });
    y += 16;

    if (data.escrowId) {
      pdf.text('Escrow ID',    ML, y,      { size: 7, colour: MUTED });
      pdf.text(data.escrowId, ML, y + 10,  { size: 8, colour: DARK });
      y += 26;
    }

    if (data.onChainId !== undefined && data.onChainId !== null) {
      pdf.text('On-chain Booking ID',      ML, y,      { size: 7, colour: MUTED });
      pdf.text(String(data.onChainId),     ML, y + 10, { size: 8, colour: DARK });
      y += 26;
      pdf.text('Stellar Explorer',                    ML, y,      { size: 7, colour: MUTED });
      pdf.text(`${EXPLORER_BASE}/${data.onChainId}`,  ML, y + 10, { size: 8, colour: BLUE });
      y += 26;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = PdfBuilder.PAGE_HEIGHT - 60;
  pdf.hline(ML, footerY, W, LINE);
  pdf.text(
    'Automatically generated receipt — questions? support@rentars.app',
    ML, PdfBuilder.PAGE_HEIGHT - footerY + 8,
    { size: 7, colour: MUTED, align: 'center', width: W },
  );

  return pdf.build();
}
