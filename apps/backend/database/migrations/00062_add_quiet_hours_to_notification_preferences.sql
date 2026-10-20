-- Migration: 00062_add_quiet_hours_to_notification_preferences
-- Adds per-user quiet-hour window to notification_preferences so the reminder
-- scheduler can defer delivery when the recipient is in a do-not-disturb period.
-- Also adds per-channel reminder opt-in flags so the reminder scheduler can
-- respect disabled optional channels. Defaults preserve existing behavior
-- (all channels enabled).

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_hours_start    TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end      TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS reminder_email       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_push        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_in_app      BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN notification_preferences.quiet_hours_start
  IS 'Wall-clock start of the quiet window (e.g. ''22:00''). NULL means no quiet window.';
COMMENT ON COLUMN notification_preferences.quiet_hours_end
  IS 'Wall-clock end of the quiet window (e.g. ''08:00''). May wrap past midnight.';
COMMENT ON COLUMN notification_preferences.quiet_hours_timezone
  IS 'IANA timezone used when evaluating the quiet window (default UTC).';
COMMENT ON COLUMN notification_preferences.reminder_email
  IS 'Whether booking reminders may be delivered via email. Defaults to TRUE.';
COMMENT ON COLUMN notification_preferences.reminder_push
  IS 'Whether booking reminders may be delivered via push. Defaults to TRUE.';
COMMENT ON COLUMN notification_preferences.reminder_in_app
  IS 'Whether booking reminders may be delivered in-app. Defaults to TRUE.';

-- Backfill any pre-existing rows that may have been created before the
-- NOT NULL defaults were applied (defensive; ADD COLUMN with DEFAULT already
-- populates existing rows in modern Postgres).
UPDATE notification_preferences
  SET reminder_email  = COALESCE(reminder_email, TRUE),
      reminder_push   = COALESCE(reminder_push, TRUE),
      reminder_in_app = COALESCE(reminder_in_app, TRUE)
  WHERE reminder_email IS NULL
     OR reminder_push IS NULL
     OR reminder_in_app IS NULL;
</br>