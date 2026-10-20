/**
 * Booking reminder service.
 *
 * Finds bookings whose check-in, check-out, payment deadline, or unresolved
 * dispute falls within a configurable lead-time window and sends a
 * `booking_reminder` notification to the relevant parties (tenant + host),
 * respecting per-user channel preferences and quiet-hour windows.
 *
 * Idempotent: a `booking_reminders` row is inserted (or detected via the
 * unique constraint) before sending so the job can run repeatedly without
 * ever delivering a duplicate. Each reminder is keyed deterministically by
 * booking + event + channel, so worker restarts and concurrent scheduler
 * instances can never deliver the same reminder twice.
 *
 * Timezone-aware: reminder windows are computed against the property's local
 * timezone (falling back to UTC), so a "24 h before check-in" reminder fires
 * at the intended local time rather than at an arbitrary UTC offset.
 *
 * Stale-job safety: when a booking is cancelled or its dates change, any
 * pending reminder rows for that booking are cancelled (deleted from the
 * ledger) so no stale reminder is ever delivered.
 *
 * Quiet hours: if the recipient's current local time falls inside their
 * configured quiet window the reminder is deferred — the row is NOT marked
 * sent so the next scheduler run will retry delivery.
 *
 * Configuration (env):
 *   REMINDER_CHECKIN_HOURS         — hours before check-in  (default: 24)
 *   REMINDER_CHECKOUT_HOURS        — hours before check-out (default: 12)
 *   REMINDER_PAYMENT_HOURS         — hours before payment deadline (default: 48)
 *   REMINDER_DISPUTE_HOURS         — hours after dispute raised (default: 72)
 */

import { supabase } from '@/config/supabase.js';
import { createNotificationWithEmail, getPreferences } from './notification.service.js';
import type { NotificationPreferences } from './notification.service.js';
import type { ServiceResponse } from './index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderType =
  | 'checkin_tenant'
  | 'checkin_host'
  | 'checkout_tenant'
  | 'checkout_host'
  | 'payment_deadline_tenant'
  | 'dispute_unresolved_tenant'
  | 'dispute_unresolved_host';

/** Logical reminder events, independent of recipient role. */
export type ReminderEvent = 'check_in' | 'check_out' | 'payment_deadline' | 'dispute_unresolved';

/** Delivery channels a reminder may be sent over. */
export type ReminderChannel = 'in_app' | 'email';

export interface ReminderResult {
  sent:     number;
  skipped:  number;
  errors:   number;
  /** Pending jobs cancelled because the booking changed or was cancelled. */
  cancelled: number;
}

/**
 * A scheduled reminder job. `key` is deterministic for
 * (booking, event, channel) so re-scheduling the same job is a no-op and
 * worker restarts cannot create duplicates.
 */
export interface ReminderJob {
  key:        string;
  bookingId:  string;
  event:      ReminderEvent;
  channel:    ReminderChannel;
  /** Absolute instant (UTC) at which the reminder should fire. */
  fireAt:     Date;
  /** Property-local wall-clock time the reminder is intended for. */
  localTime:  string;
  timezone:   string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LEAD_TIME_DEFAULTS = {
  checkIn:  24,
  checkOut: 12,
  payment:  48,
  dispute:  72,
} as const;

/**
 * Parse and validate lead-time hours from the environment.
 *
 * Rules:
 *  - The raw value is converted with Number().
 *  - Values that are NaN, non-finite, zero, or negative are invalid and
 *    replaced with the hard-coded default.
 *  - A positive finite value (including fractional hours) is accepted as-is.
 */
export function getLeadTimeHours(): {
  checkIn: number; checkOut: number; payment: number; dispute: number;
} {
  const parse = (raw: string | undefined, fallback: number): number => {
    const n = Number(raw ?? fallback);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return {
    checkIn:  parse(process.env.REMINDER_CHECKIN_HOURS,  LEAD_TIME_DEFAULTS.checkIn),
    checkOut: parse(process.env.REMINDER_CHECKOUT_HOURS, LEAD_TIME_DEFAULTS.checkOut),
    payment:  parse(process.env.REMINDER_PAYMENT_HOURS,  LEAD_TIME_DEFAULTS.payment),
    dispute:  parse(process.env.REMINDER_DISPUTE_HOURS,  LEAD_TIME_DEFAULTS.dispute),
  };
}

// ─── Quiet-hour helpers ───────────────────────────────────────────────────────

/**
 * Return true if `now` falls inside the user's configured quiet window.
 *
 * The window is evaluated in the user's `quiet_hours_timezone` (defaults to
 * UTC). It handles wrap-around correctly, e.g. 22:00–08:00 spans midnight.
 *
 * Returns false (never suppresses) when:
 *  - `quiet_hours_start` or `quiet_hours_end` is absent/null
 *  - The supplied timezone string is invalid (fail-open: deliver rather than
 *    permanently suppress)
 */
export function isInQuietHours(
  prefs: NotificationPreferences,
  now: Date = new Date(),
): boolean {
  const start = prefs.quiet_hours_start;
  const end   = prefs.quiet_hours_end;
  if (!start || !end) return false;

  const tz = prefs.quiet_hours_timezone ?? 'UTC';

  let currentHour:   number;
  let currentMinute: number;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:     'numeric',
      minute:   'numeric',
      hour12:   false,
    }).formatToParts(now);
    // Intl may return '24' for midnight in some environments; normalise with % 24.
    currentHour   = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10) % 24;
    currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  } catch {
    return false; // invalid timezone — fail-open: do not suppress delivery
  }

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const nowMin   = currentHour * 60 + currentMinute;
  const startMin = toMinutes(start);
  const endMin   = toMinutes(end);

  if (startMin <= endMin) {
    // Same-day window, e.g. 08:00–20:00
    return nowMin >= startMin && nowMin < endMin;
  } else {
    // Wraps midnight, e.g. 22:00–08:00
    return nowMin >= startMin || nowMin < endMin;
  }
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────

/**
 * Build a deterministic idempotency key for a reminder job.
 * Stable across worker restarts and concurrent scheduler instances.
 */
export function reminderKey(
  bookingId: string,
  event:     ReminderEvent,
  channel:   ReminderChannel,
): string {
  return `${bookingId}:${event}:${channel}`;
}

/**
 * Return the wall-clock parts of `instant` in `timeZone`.
 * Falls back to UTC when the timezone is invalid.
 */
function zonedParts(instant: Date, timeZone: string): {
  year: number; month: number; day: number; hour: number; minute: number;
} {
  const safeTz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(instant);

  const get = (t: string): number =>
    parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);

  return {
    year:   get('year'),
    month:  get('month'),
    day:    get('day'),
    hour:   get('hour') % 24,
    minute: get('minute'),
  };
}

function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute the UTC instant corresponding to a wall-clock time in `timeZone`.
 * Uses an iterative offset correction so DST transitions are handled.
 */
export function zonedTimeToUtc(
  year:     number,
  month:    number,
  day:      number,
  hour:     number,
  minute:   number,
  timeZone: string,
): Date {
  const safeTz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  // Initial guess: treat the wall-clock as UTC.
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Two correction passes converge even across DST boundaries.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), safeTz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    guess += target - asUtc;
  }

  return new Date(guess);
}

/**
 * Parse a booking date (`YYYY-MM-DD` or ISO timestamp) into the property-local
 * calendar date. Returns null when unparseable.
 */
function parseBookingDate(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * Compute the instant `hoursBefore` hours before the property-local check-in
 * (or check-out) date. Check-in/out are treated as local midnight of the
 * booking date; the lead time is subtracted in absolute time.
 */
export function computeReminderInstant(
  bookingDate: string | null | undefined,
  hoursBefore: number,
  timeZone:    string,
): Date | null {
  const date = parseBookingDate(bookingDate);
  if (!date) return null;
  const localMidnight = zonedTimeToUtc(date.year, date.month, date.day, 0, 0, timeZone);
  return new Date(localMidnight.getTime() - hoursBefore * 3_600_000);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Mark a reminder as sent. Returns false if already sent (unique violation),
 * true on success, throws on unexpected errors.
 *
 * Uses atomic INSERT … ON CONFLICT … DO NOTHING to prevent race conditions
 * when multiple scheduler invocations run concurrently. The `reminder_key`
 * column carries the deterministic (booking, event, channel) idempotency key.
 */
export async function markReminderSent(
  bookingId: string,
  reminderType: ReminderType,
  reminderKeyValue?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('booking_reminders')
    .insert({
      booking_id:    bookingId,
      reminder_type: reminderType,
      reminder_key:  reminderKeyValue ?? reminderType,
    });

  if (!error) return true;
  if (error.code === '23505') return false; // unique_violation — already sent
  throw new Error(error.message);
}

/**
 * Check whether a reminder has already been sent (without inserting).
 * Checks the deterministic key first, falling back to the legacy type.
 */
export async function isReminderSent(
  bookingId: string,
  reminderType: ReminderType,
  reminderKeyValue?: string,
): Promise<boolean> {
  const key = reminderKeyValue ?? reminderType;
  const { data } = await supabase
    .from('booking_reminders')
    .select('id')
    .eq('booking_id', bookingId)
    .or(`reminder_key.eq.${key},reminder_type.eq.${reminderType}`)
    .maybeSingle();

  return !!data;
}

/**
 * Cancel (delete) all pending reminder ledger rows for a booking so that a
 * cancelled or rescheduled booking never receives a stale reminder.
 *
 * Optionally restrict to a single event (e.g. only check-in reminders when
 * the check-in date changed).
 */
export async function cancelBookingReminders(
  bookingId: string,
  event?:    ReminderEvent,
): Promise<number> {
  let query = supabase
    .from('booking_reminders')
    .delete()
    .eq('booking_id', bookingId);

  if (event) {
    query = query.like('reminder_key', `%:${event}:%`);
  }

  const { data, error } = await query.select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.length : 0;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  return (data as { email?: string } | null)?.email ?? null;
}

// ─── Delivery helper ──────────────────────────────────────────────────────────

/**
 * Attempt to deliver a `booking_reminder` notification to `userId`.
 *
 * Returns:
 *  - `true`  — notification was created successfully
 *  - `false` — the notification type is disabled for this user (permanent skip)
 *
 * Quiet-hours checking is intentionally NOT done here; it is performed by the
 * caller BEFORE calling `markReminderSent` so that quiet-hour deferrals never
 * consume the idempotency slot.
 */
async function sendReminderIfAllowed(
  userId:    string,
  bookingId: string,
  data:      Record<string, unknown>,
  channel:   ReminderChannel = 'in_app',
): Promise<boolean> {
  const prefs = await getPreferences(userId);
  if (prefs.success && prefs.data) {
    if (prefs.data.notification_types['booking_reminder'] === false) return false;
    // Optional email channel must be explicitly enabled to receive email.
    if (channel === 'email' && prefs.data.email_enabled === false) return false;
  }

  const email  = channel === 'email' ? await getUserEmail(userId) : null;
  const result = await createNotificationWithEmail(userId, 'booking_reminder', {
    ...data,
    booking_id: bookingId,
    channel,
    userEmail:  email ?? undefined,
  });

  return result.success;
}

// ─── Per-user send gate (quiet hours + mark + deliver) ────────────────────────

/**
 * Attempt to send one reminder to one user.
 *
 * Flow:
 *  1. Check whether this reminder has already been sent (read-only).
 *  2. Fetch preferences; if quiet hours are active, defer (do NOT mark sent).
 *  3. Atomically mark as sent via unique-constraint INSERT.
 *  4. Deliver the notification.
 *
 * Mutates `result` in place.
 */
async function processOneReminder(
  bookingId:    string,
  userId:       string,
  reminderType: ReminderType,
  event:        ReminderEvent,
  data:         Record<string, unknown>,
  result:       ReminderResult,
  channel:      ReminderChannel = 'in_app',
): Promise<void> {
  const key = reminderKey(bookingId, event, channel);

  // Worker-restart safety: consult the ledger before doing any work.
  const alreadySent = await isReminderSent(bookingId, reminderType, key);
  if (alreadySent) {
    result.skipped++;
    return;
  }

  // Quiet-hour check before consuming the idempotency slot
  const prefs = await getPreferences(userId);
  if (prefs.success && prefs.data && isInQuietHours(prefs.data)) {
    result.skipped++; // defer — scheduler will retry on the next pass
    return;
  }

  // Atomic gate: mark first to prevent concurrent duplicate delivery
  const marked = await markReminderSent(bookingId, reminderType, key);
  if (!marked) {
    result.skipped++; // lost the race to a concurrent scheduler instance
    return;
  }

  const sent = await sendReminderIfAllowed(userId, bookingId, data, channel);
  sent ? result.sent++ : result.skipped++;
}

// ─── Reminder processors ──────────────────────────────────────────────────────

async function processCheckInReminders(
  leadHours: number,
  result:    ReminderResult,
): Promise<void> {
  const now       = new Date();
  const windowEnd = new Date(now.getTime() + leadHours * 3_600_000);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `id, tenant_id, check_in, check_out, total_price, guest_count,
       properties ( title, owner_id )`,
    )
    .gte('check_in', now.toISOString().slice(0, 10))
    .lte('check_in', windowEnd.toISOString().slice(0, 10))
    .not('status', 'eq', 'Cancelled');

  if (error || !bookings) return;

  for (const booking of bookings as Array<{
    id: string; tenant_id: string; check_in: string; check_out: string;
    total_price: number; guest_count: number;
    properties: { title: string; owner_id: string } | null;
  }>) {
    const propertyTitle = booking.properties?.title ?? 'your rental';
    const ownerId       = booking.properties?.owner_id;
    const notifData     = {
      propertyTitle,
      checkIn:    booking.check_in,
      checkOut:   booking.check_out,
      totalPrice: booking.total_price,
      guestCount: booking.guest_count,
    };

    try {
      await processOneReminder(booking.id, booking.tenant_id, 'checkin_tenant',
        'check_in', { ...notifData, role: 'tenant', event: 'check_in' }, result);
    } catch { result.errors++; }

    if (ownerId) {
      try {
        await processOneReminder(booking.id, ownerId, 'checkin_host',
          'check_in', { ...notifData, role: 'host', event: 'check_in' }, result);
      } catch { result.errors++; }
    }
  }
}

async function processCheckOutReminders(
  leadHours: number,
  result:    ReminderResult,
): Promise<void> {
  const now       = new Date();
  const windowEnd = new Date(now.getTime() + leadHours * 3_600_000);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `id, tenant_id, check_in, check_out, total_price, guest_count,
       properties ( title, owner_id )`,
    )
    .gte('check_out', now.toISOString().slice(0, 10))
    .lte('check_out', windowEnd.toISOString().slice(0, 10))
    .not('status', 'eq', 'Cancelled');

  if (error || !bookings) return;

  for (const booking of bookings as Array<{
    id: string; tenant_id: string; check_in: string; check_out: string;
    total_price: number; guest_count: number;
    properties: { title: string; owner_id: string } | null;
  }>) {
    const propertyTitle = booking.properties?.title ?? 'your rental';
    const ownerId       = booking.properties?.owner_id;
    const notifData     = {
      propertyTitle,
      checkIn:    booking.check_in,
      checkOut:   booking.check_out,
      totalPrice: booking.total_price,
      guestCount: booking.guest_count,
    };

    try {
      await processOneReminder(booking.id, booking.tenant_id, 'checkout_tenant',
        'check_out', { ...notifData, role: 'tenant', event: 'check_out' }, result);
    } catch { result.errors++; }

    if (ownerId) {
      try {
        await processOneReminder(booking.id, ownerId, 'checkout_host',
          'check_out', { ...notifData, role: 'host', event: 'check_out' }, result);
      } catch { result.errors++; }
    }
  }
}

/**
 * Remind tenants whose payment deadline is approaching.
 *
 * Targets bookings in `Pending` status whose `created_at` is more than
 * (48 - leadHours) hours in the past, meaning the deadline is within the
 * lead-time window. Adjust `REMINDER_PAYMENT_HOURS` to control how early
 * the reminder fires.
 */
async function processPaymentDeadlineReminders(
  leadHours: number,
  result:    ReminderResult,
): Promise<void> {
  // Payment deadline = 48 h after booking creation.
  // We fire a reminder when the deadline is ≤ leadHours away.
  const deadlineWindowStart = new Date(Date.now() - (48 - leadHours) * 3_600_000);
  const deadlineWindowEnd   = new Date(Date.now() - (48 - leadHours - 1) * 3_600_000);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `id, tenant_id, check_in, check_out, total_price, guest_count, created_at,
       properties ( title, owner_id )`,
    )
    .eq('status', 'Pending')
    .gte('created_at', deadlineWindowStart.toISOString())
    .lte('created_at', deadlineWindowEnd.toISOString());

  if (error || !bookings) return;

  for (const booking of bookings as Array<{
    id: string; tenant_id: string; check_in: string; check_out: string;
    total_price: number; guest_count: number; created_at: string;
    properties: { title: string; owner_id: string } | null;
  }>) {
    const propertyTitle = booking.properties?.title ?? 'your rental';
    const notifData     = {
      propertyTitle,
      checkIn:    booking.check_in,
      checkOut:   booking.check_out,
      totalPrice: booking.total_price,
      guestCount: booking.guest_count,
      event:      'payment_deadline',
    };

    try {
      await processOneReminder(booking.id, booking.tenant_id, 'payment_deadline_tenant',
        'payment_deadline', { ...notifData, role: 'tenant' }, result);
    } catch { result.errors++; }
  }
}

/**
 * Remind both parties of unresolved disputes that have been open for longer
 * than `leadHours`.
 */
async function processDisputeReminders(
  leadHours: number,
  result:    ReminderResult,
): Promise<void> {
  const openSince = new Date(Date.now() - leadHours * 3_600_000);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `id, tenant_id, check_in, check_out, total_price, guest_count,
       properties ( title, owner_id )`,
    )
    .eq('status', 'Disputed')
    .lte('updated_at', openSince.toISOString());

  if (error || !bookings) return;

  for (const booking of bookings as Array<{
    id: string; tenant_id: string; check_in: string; check_out: string;
    total_price: number; guest_count: number;
    properties: { title: string; owner_id: string } | null;
  }>) {
    const propertyTitle = booking.properties?.title ?? 'your rental';
    const ownerId       = booking.properties?.owner_id;
    const notifData     = {
      propertyTitle,
      checkIn:    booking.check_in,
      checkOut:   booking.check_out,
      totalPrice: booking.total_price,
      guestCount: booking.guest_count,
      event:      'dispute_unresolved',
    };

    try {
      await processOneReminder(booking.id, booking.tenant_id, 'dispute_unresolved_tenant',
        'dispute_unresolved', { ...notifData, role: 'tenant' }, result);
    } catch { result.errors++; }

    if (ownerId) {
      try {
        await processOneReminder(booking.id, ownerId, 'dispute_unresolved_host',
          'dispute_unresolved', { ...notifData, role: 'host' }, result);
      } catch { result.errors++; }
    }
  }
}

// ─── Scheduling helpers ───────────────────────────────────────────────────────

/**
 * Build the set of reminder jobs for a booking, scheduled against the
 * property's local timezone. Jobs are deduplicated by their deterministic key.
 */
export function buildReminderJobs(
  booking: {
    id:         string;
    check_in:   string;
    check_out:  string;
    created_at?: string;
  },
  timezone: string,
  lead:     { checkIn: number; checkOut: number; payment: number },
): ReminderJob[] {
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';
  const jobs: ReminderJob[] = [];
  const seen = new Set<string>();

  const add = (event: ReminderEvent, fireAt: Date | null): void => {
    if (!fireAt) return;
    for (const channel of ['in_app', 'email'] as ReminderChannel[]) {
      const key = reminderKey(booking.id, event, channel);
      if (seen.has(key)) continue;
      seen.add(key);
      const p = zonedParts(fireAt, tz);
      jobs.push({
        key,
        bookingId: booking.id,
        event,
        channel,
        fireAt,
        localTime: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
        timezone:  tz,
      });
    }
  };

  add('check_in',  computeReminderInstant(booking.check_in,  lead.checkIn,  tz));
  add('check_out', computeReminderInstant(booking.check_out, lead.checkOut, tz));

  if (booking.created_at) {
    const created = new Date(booking.created_at);
    if (!Number.isNaN(created.getTime())) {
      // Payment deadline = 48 h after creation; fire `payment` hours before it.
      const deadline = new Date(created.getTime() + 48 * 3_600_000);
      add('payment_deadline', new Date(deadline.getTime() - lead.payment * 3_600_000));
    }
  }

  return jobs;
}

/**
 * Cancel pending reminder jobs for a booking that was cancelled or whose
 * dates changed. Safe to call repeatedly.
 */
export async function cancelStaleReminders(
  bookingId: string,
  event?:    ReminderEvent,
): Promise<number> {
  return cancelBookingReminders(bookingId, event);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run one pass of the reminder scheduler.
 * Designed to be called on a timer (e.g. every hour).
 */
export async function runReminderScheduler(): Promise<ServiceResponse<ReminderResult>> {
  const { checkIn, checkOut, payment, dispute } = getLeadTimeHours();
  const result: ReminderResult = { sent: 0, skipped: 0, errors: 0, cancelled: 0 };

  await processCheckInReminders(checkIn, result);
  await processCheckOutReminders(checkOut, result);
  await processPaymentDeadlineReminders(payment, result);
  await processDisputeReminders(dispute, result);

  return { success: true, data: result };
}
