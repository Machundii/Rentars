-- Migration: 006_create_booking_modifications
-- Creates the booking_modifications table for date-change request lifecycle.

CREATE TABLE IF NOT EXISTS booking_modifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_start DATE NOT NULL,
  requested_end   DATE NOT NULL,
  original_start  DATE NOT NULL,
  original_end    DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  requested_by    UUID NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_modifications_booking
  ON booking_modifications (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_modifications_status
  ON booking_modifications (status, created_at DESC);
