/**
 * Idempotency service — stores and replays responses for idempotent POST
 * requests so that network retries and double-clicks never create duplicate
 * bookings or escrow transactions.
 *
 * Keys are scoped per user (the unique constraint is on (user_id, key)) and
 * expire after RETENTION_HOURS hours.  Expired rows are purged by the
 * scheduled cleanup in cleanup-schedular.ts.
 *
 * Algorithm
 * ---------
 * 1. Controller reads the `Idempotency-Key` header and the authenticated
 *    user-id, then calls `lookup(userId, key)`.
 * 2. If a record is found AND the stored request_hash matches the current
 *    request hash → replay the stored response (HTTP 200/201 with original
 *    body).
 * 3. If a record is found BUT the hash differs → return 422 (key reused with
 *    a different payload).
 * 4. If no record is found → let the request proceed, then call
 *    `store(userId, key, requestHash, responseBody, statusCode)`.
 *
 * Request hash
 * ------------
 * We hash the serialised JSON body with SHA-256 (hex) so that reordered keys
 * or whitespace differences in a textually-equivalent body are treated as the
 * same request.  The hash is stored as a 64-character hex string that fits
 * cleanly into `VARCHAR(64)`.
 */

import { createHash } from 'node:crypto';
import { supabase } from '@/config/supabase.js';
import type { ServiceResponse } from './index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long an idempotency record is retained before it may be purged. */
export const IDEMPOTENCY_RETENTION_HOURS = 24;

/**
 * Reminder jobs are long-lived relative to request idempotency keys: a
 * check-out reminder may be scheduled days ahead, so its claim record must
 * survive until well after the reminder window closes.
 */
export const REMINDER_KEY_RETENTION_HOURS = 24 * 30;

/** Reminder event kinds that may be scheduled for a booking. */
export type ReminderEvent = 'payment_deadline' | 'check_in' | 'check_out';

/** Delivery channels a reminder may be sent through. */
export type ReminderChannel = 'email' | 'sms' | 'push';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdempotencyRecord {
  id: string;
  key: string;
  user_id: string;
  request_hash: string;
  /** Stored as JSONB in the DB, returned as a plain JS object here. */
  response_body: Record<string, unknown>;
  status_code: number;
  /** 'processing' = request in flight; 'completed' = safe to replay. */
  status: 'processing' | 'completed';
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Produces a stable SHA-256 hex digest of `body`.
 *
 * The body object is serialised with sorted keys so that `{b:1,a:2}` and
 * `{a:2,b:1}` produce the same hash.
 */
export function hashRequestBody(body: unknown): string {
  const stable = JSON.stringify(body, Object.keys(body as object).sort());
  return createHash('sha256').update(stable).digest('hex');
}

/**
 * Build the deterministic idempotency key for a reminder job.
 *
 * The key is derived purely from `(bookingId, event, channel)` so that any
 * worker — including one restarted after a crash — computes the same key and
 * therefore claims the same job at most once.  The key is also the natural
 * deduplication key for "at most once per channel".
 */
export function buildReminderKey(
  bookingId: string,
  event: ReminderEvent,
  channel: ReminderChannel,
): string {
  return `reminder:${bookingId}:${event}:${channel}`;
}

/**
 * Stable request hash for a reminder job, used to detect a booking change
 * (new time, new recipient, etc.) that should replace a previously scheduled
 * job rather than silently reuse it.
 */
export function hashReminderJob(job: {
  bookingId: string;
  event: ReminderEvent;
  channel: ReminderChannel;
  scheduledFor: string;
  recipient: string;
}): string {
  return hashRequestBody({
    bookingId: job.bookingId,
    event: job.event,
    channel: job.channel,
    scheduledFor: job.scheduledFor,
    recipient: job.recipient,
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Look up an existing idempotency record for `(userId, key)`.
 *
 * @returns
 *   - `{ success: true, data: IdempotencyRecord }` if a live record exists.
 *   - `{ success: true, data: null }` if no record exists (first request).
 *   - `{ success: false, error }` on a database error.
 */
export async function lookup(
  userId: string,
  key: string,
): Promise<ServiceResponse<IdempotencyRecord | null>> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('idempotency_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('key', key)
    .gte('created_at', cutoff)
    .maybeSingle();

  if (error) {
    return { success: false, error: `Idempotency lookup failed: ${error.message}` };
  }

  return { success: true, data: data as IdempotencyRecord | null };
}

/**
 * Atomically claim an idempotency key with status='processing'.
 *
 * Returns `{ claimed: true, id }` when this call wins the INSERT race and may
 * proceed with the real request.  Returns `{ claimed: false, existing }` when a
 * record already exists (either in-flight or completed) so the caller can
 * replay or reject.
 *
 * @param userId      - Authenticated user ID (scopes the key).
 * @param key         - Value of the `Idempotency-Key` header.
 * @param requestHash - SHA-256 hex digest of the canonical request body.
 */
export async function lockKey(
  userId: string,
  key: string,
  requestHash: string,
): Promise<ServiceResponse<{ claimed: true; id: string } | { claimed: false; existing: IdempotencyRecord }>> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('idempotency_keys')
    .insert({
      key,
      user_id: userId,
      request_hash: requestHash,
      response_body: {},
      status_code: 0,
      status: 'processing',
    })
    .select('id')
    .single();

  if (!insertError && inserted) {
    return { success: true, data: { claimed: true, id: (inserted as { id: string }).id } };
  }

  // Unique constraint fired — fetch the existing record.
  const { data: existing, error: fetchError } = await supabase
    .from('idempotency_keys')
    .select('*')
    .eq('user_id', userId)
    .eq('key', key)
    .gte('created_at', cutoff)
    .maybeSingle();

  if (fetchError || !existing) {
    return { success: false, error: `Idempotency lock failed: ${fetchError?.message ?? 'record not found'}` };
  }

  return { success: true, data: { claimed: false, existing: existing as IdempotencyRecord } };
}

/**
 * Complete a previously claimed idempotency record by storing the response.
 *
 * @param id          - UUID of the record returned by lockKey.
 * @param responseBody - The JSON-serialisable response body that was sent.
 * @param statusCode  - The HTTP status code that was sent (e.g. 201).
 */
export async function completeKey(
  id: string,
  responseBody: Record<string, unknown>,
  statusCode: number,
): Promise<ServiceResponse<void>> {
  const { error } = await supabase
    .from('idempotency_keys')
    .update({ status: 'completed', response_body: responseBody, status_code: statusCode })
    .eq('id', id);

  if (error) {
    return { success: false, error: `Idempotency complete failed: ${error.message}` };
  }

  return { success: true };
}

/**
 * Release a processing record when the underlying request fails, so the key
 * can be retried with the same payload.
 */
export async function releaseKey(id: string): Promise<void> {
  await supabase.from('idempotency_keys').delete().eq('id', id).eq('status', 'processing');
}

/**
 * Persist an idempotency record after a successful (or deterministic) response.
 *
 * An `upsert` with `ignoreDuplicates: false` ensures that if two concurrent
 * requests with the same key slip through the lookup guard at the same time,
 * only the first insert wins and subsequent ones are treated as conflicts that
 * can be resolved by the caller's next `lookup()`.
 *
 * @param userId      - Authenticated user ID (scopes the key).
 * @param key         - Value of the `Idempotency-Key` header.
 * @param requestHash - SHA-256 hex digest of the canonical request body.
 * @param responseBody - The JSON-serialisable response body that was sent.
 * @param statusCode  - The HTTP status code that was sent (e.g. 201).
 */
export async function store(
  userId: string,
  key: string,
  requestHash: string,
  responseBody: Record<string, unknown>,
  statusCode: number,
): Promise<ServiceResponse<IdempotencyRecord>> {
  const { data, error } = await supabase
    .from('idempotency_keys')
    .insert({
      key,
      user_id: userId,
      request_hash: requestHash,
      response_body: responseBody,
      status_code: statusCode,
      status: 'completed',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: `Idempotency store failed: ${error.message}` };
  }

  return { success: true, data: data as IdempotencyRecord };
}

/**
 * Claim a reminder job exactly once.
 *
 * Reminder workers call this before sending.  The claim is an INSERT on the
 * unique `(user_id, key)` constraint, so concurrent workers (or a worker that
 * restarts mid-send) can never deliver the same reminder twice.
 *
 * @returns
 *   - `{ claimed: true, id }` when this worker owns the job and should send.
 *   - `{ claimed: false, existing }` when the job was already claimed; the
 *     caller must NOT send.  If `existing.request_hash` differs from
 *     `requestHash` the booking changed and the caller should cancel/replace
 *     the stale job instead of replaying it.
 */
export async function claimReminderJob(
  bookingId: string,
  event: ReminderEvent,
  channel: ReminderChannel,
  requestHash: string,
  ownerUserId: string,
): Promise<ServiceResponse<{ claimed: true; id: string } | { claimed: false; existing: IdempotencyRecord }>> {
  const key = buildReminderKey(bookingId, event, channel);
  return lockKey(ownerUserId, key, requestHash);
}

/**
 * Mark a claimed reminder job as delivered so it is never re-sent.
 */
export async function completeReminderJob(
  id: string,
  delivery: Record<string, unknown>,
): Promise<ServiceResponse<void>> {
  return completeKey(id, delivery, 200);
}

/**
 * Release a reminder claim when delivery failed in a retryable way, allowing
 * a later worker run to pick the job up again.
 */
export async function releaseReminderJob(id: string): Promise<void> {
  return releaseKey(id);
}

/**
 * Delete all idempotency_keys rows older than `retentionHours`.
 * Called by the scheduled cleanup job.
 *
 * @returns The number of rows deleted, or an error message.
 */
export async function purgeExpired(
  retentionHours: number = IDEMPOTENCY_RETENTION_HOURS,
): Promise<ServiceResponse<{ deleted: number }>> {
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('idempotency_keys')
    .delete()
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    return { success: false, error: `Idempotency purge failed: ${error.message}` };
  }

  const deleted = Array.isArray(data) ? data.length : 0;
  return { success: true, data: { deleted } };
}
