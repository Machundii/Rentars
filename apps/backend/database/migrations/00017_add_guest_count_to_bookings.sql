-- Migration: add guest_count to bookings table
-- Bookings now carry the number of guests so capacity can be enforced at query time.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guest_count INT NOT NULL DEFAULT 1
    CHECK (guest_count >= 1);

COMMENT ON COLUMN bookings.guest_count IS
  'Number of guests for this booking. Must not exceed properties.max_guests.';

-- Backfill guard: clamp any pre-existing rows that exceed the listing capacity
-- (or are below the minimum) so the constraints below can be applied safely.
UPDATE bookings b
SET guest_count = LEAST(
  GREATEST(b.guest_count, 1),
  COALESCE(p.max_guests, b.guest_count)
)
FROM properties p
WHERE b.property_id = p.id
  AND (b.guest_count < 1 OR b.guest_count > COALESCE(p.max_guests, b.guest_count));

-- Enforce guest_count >= 1 at the DB layer (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_guest_count_min_check'
      AND conrelid = 'bookings'::regclass
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_guest_count_min_check
      CHECK (guest_count >= 1);
  END IF;
END $$;

-- Enforce guest_count <= properties.max_guests on insert/update via trigger.
CREATE OR REPLACE FUNCTION enforce_booking_guest_count_within_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_guests INT;
BEGIN
  IF NEW.guest_count IS NULL OR NEW.guest_count < 1 THEN
    RAISE EXCEPTION 'bookings.guest_count must be >= 1 (got %)', NEW.guest_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT max_guests INTO v_max_guests
  FROM properties
  WHERE id = NEW.property_id;

  IF v_max_guests IS NULL THEN
    RAISE EXCEPTION 'property % not found or has no max_guests', NEW.property_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.guest_count > v_max_guests THEN
    RAISE EXCEPTION
      'bookings.guest_count (%) exceeds properties.max_guests (%) for property %',
      NEW.guest_count, v_max_guests, NEW.property_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_guest_count_capacity ON bookings;
CREATE TRIGGER trg_bookings_guest_count_capacity
  BEFORE INSERT OR UPDATE OF guest_count, property_id ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_guest_count_within_capacity();

-- Equivalent checks on booking_modifications.requested_guest_count.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_modifications'
      AND column_name = 'requested_guest_count'
  ) THEN
    -- Backfill guard for existing modification requests.
    UPDATE booking_modifications m
    SET requested_guest_count = LEAST(
      GREATEST(m.requested_guest_count, 1),
      COALESCE(p.max_guests, m.requested_guest_count)
    )
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    WHERE m.booking_id = b.id
      AND m.requested_guest_count IS NOT NULL
      AND (
        m.requested_guest_count < 1
        OR m.requested_guest_count > COALESCE(p.max_guests, m.requested_guest_count)
      );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'booking_modifications_requested_guest_count_min_check'
        AND conrelid = 'booking_modifications'::regclass
    ) THEN
      ALTER TABLE booking_modifications
        ADD CONSTRAINT booking_modifications_requested_guest_count_min_check
        CHECK (requested_guest_count IS NULL OR requested_guest_count >= 1);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_booking_modification_guest_count_within_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_guests INT;
BEGIN
  IF NEW.requested_guest_count IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.requested_guest_count < 1 THEN
    RAISE EXCEPTION 'booking_modifications.requested_guest_count must be >= 1 (got %)',
      NEW.requested_guest_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT p.max_guests INTO v_max_guests
  FROM bookings b
  JOIN properties p ON p.id = b.property_id
  WHERE b.id = NEW.booking_id;

  IF v_max_guests IS NULL THEN
    RAISE EXCEPTION 'booking % not found or has no associated property capacity', NEW.booking_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.requested_guest_count > v_max_guests THEN
    RAISE EXCEPTION
      'booking_modifications.requested_guest_count (%) exceeds properties.max_guests (%) for booking %',
      NEW.requested_guest_count, v_max_guests, NEW.booking_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'booking_modifications'
      AND column_name = 'requested_guest_count'
  ) THEN
    DROP TRIGGER IF EXISTS trg_booking_modifications_guest_count_capacity ON booking_modifications;
    CREATE TRIGGER trg_booking_modifications_guest_count_capacity
      BEFORE INSERT OR UPDATE OF requested_guest_count, booking_id ON booking_modifications
      FOR EACH ROW
      EXECUTE FUNCTION enforce_booking_modification_guest_count_within_capacity();
  END IF;
END $$;