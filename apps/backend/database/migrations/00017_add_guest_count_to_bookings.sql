-- Migration: add guest_count to bookings table
-- Bookings now carry the number of guests so capacity can be enforced at query time.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_count INT NOT NULL DEFAULT 1
    CHECK (guest_count >= 1);

COMMENT ON COLUMN bookings.guest_count IS
  'Number of guests for this booking. Must not exceed properties.max_guests.';
