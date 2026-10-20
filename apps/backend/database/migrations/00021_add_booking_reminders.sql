-- Migration: 00021_add_booking_reminders
-- Tracks which reminder notifications have already been sent for each booking
-- so the scheduler never sends a duplicate even across repeated runs.

CREATE TABLE IF NOT EXISTS booking_reminders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- 'checkin_tenant' | 'checkin_host' | 'checkout_tenant' | 'checkout_host'
  reminder_type TEXT      NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One reminder of each type per booking — prevents duplicates at DB level
  CONSTRAINT uix_booking_reminder_type UNIQUE (booking_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_booking_reminders_booking_id
  ON booking_reminders (booking_id);

-- Extend booking_reminders with scheduling metadata so reminders can be
-- scheduled against the property's local time, deduplicated per channel,
-- and cancelled/replaced when a booking changes or is cancelled.
ALTER TABLE booking_reminders
  -- Reminder event: 'payment_deadline' | 'checkin' | 'checkout'
  ADD COLUMN IF NOT EXISTS event TEXT,
  -- Delivery channel: 'email' | 'sms' | 'push' | 'in_app'
  ADD COLUMN IF NOT EXISTS channel TEXT,
  -- Intended local delivery time (UTC instant derived from property timezone)
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  -- Stable idempotency key so worker restarts / repeated runs never duplicate
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  -- Lifecycle: 'pending' | 'sent' | 'cancelled'
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill legacy rows so existing sent reminders remain valid and unique.
UPDATE booking_reminders
SET event = reminder_type,
    channel = 'email',
    scheduled_for = sent_at,
    idempotency_key = booking_id::text || ':' || reminder_type || ':email',
    status = 'sent'
WHERE event IS NULL;

-- Enforce allowed lifecycle states.
ALTER TABLE booking_reminders
  DROP CONSTRAINT IF EXISTS chk_booking_reminders_status;
ALTER TABLE booking_reminders
  ADD CONSTRAINT chk_booking_reminders_status
  CHECK (status IN ('pending', 'sent', 'cancelled'));

-- Prevent duplicate scheduled work per booking/event/channel at DB level.
-- Cancelled rows are excluded so a replacement job can be scheduled after a
-- booking change while still guaranteeing at-most-once delivery per channel.
DROP INDEX IF EXISTS uix_booking_reminders_event_channel;
CREATE UNIQUE INDEX IF NOT EXISTS uix_booking_reminders_event_channel
  ON booking_reminders (booking_id, event, channel)
  WHERE status <> 'cancelled';

-- Idempotency keys must be globally unique to make worker retries safe.
DROP INDEX IF EXISTS uix_booking_reminders_idempotency_key;
CREATE UNIQUE INDEX IF NOT EXISTS uix_booking_reminders_idempotency_key
  ON booking_reminders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Fast lookup of due pending jobs for the scheduler worker.
CREATE INDEX IF NOT EXISTS idx_booking_reminders_pending_due
  ON booking_reminders (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_booking_reminders_booking_status
  ON booking_reminders (booking_id, status);