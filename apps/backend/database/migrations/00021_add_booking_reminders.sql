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
