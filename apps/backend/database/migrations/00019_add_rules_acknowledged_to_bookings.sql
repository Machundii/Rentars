-- Migration: record house-rules acknowledgement on bookings
-- Tenants must acknowledge house rules before a booking is created.
-- The timestamp records when they accepted.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rules_acknowledged_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.rules_acknowledged_at IS
  'UTC timestamp at which the tenant acknowledged the property house rules. NULL means not yet acknowledged (pre-rules-gate bookings).';
