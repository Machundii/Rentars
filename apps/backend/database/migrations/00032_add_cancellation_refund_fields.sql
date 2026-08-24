-- Add cancellation + refund tracking columns to the bookings table.
-- Populated by the tenant-driven cancellation flow (booking.service.cancelBooking)
-- so the refund outcome is recorded alongside the booking.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_tier VARCHAR(32);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_policy_pct DOUBLE PRECISION;

COMMENT ON COLUMN bookings.cancelled_at IS 'ISO timestamp of when the booking was cancelled';
COMMENT ON COLUMN bookings.refund_amount IS 'Amount refunded to the tenant on cancellation (currency units)';
COMMENT ON COLUMN bookings.refund_tier IS 'Refund tier applied: full | partial | none';
COMMENT ON COLUMN bookings.refund_policy_pct IS 'Refund fraction (0..1) applied per the configured policy';
