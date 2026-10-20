-- Migration: 00062_add_guest_count_to_booking_modifications
-- Creates booking_modifications if it doesn't yet exist and adds guest-count
-- columns so modification requests can include an occupancy change that is
-- validated against property capacity before it is accepted.
--
-- Occupancy is tracked with explicit adult/child/infant/pet semantics on both
-- bookings and booking_modifications. Integer CHECK constraints enforce
-- server-side bounds, and a trigger validates total occupancy against
-- properties.max_guests so every persisted booking satisfies listing limits.

CREATE TABLE IF NOT EXISTS booking_modifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_start  DATE,
  requested_end    DATE,
  original_start   DATE,
  original_end     DATE,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
  requested_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_modifications_booking_id
  ON booking_modifications (booking_id);

-- Guest-count columns (added by this migration)
ALTER TABLE booking_modifications
  ADD COLUMN IF NOT EXISTS original_guest_count  INTEGER
    CHECK (original_guest_count  IS NULL OR original_guest_count  >= 1),
  ADD COLUMN IF NOT EXISTS requested_guest_count INTEGER
    CHECK (requested_guest_count IS NULL OR requested_guest_count >= 1);

COMMENT ON COLUMN booking_modifications.original_guest_count
  IS 'Guest count on the booking at the time the modification was requested.';
COMMENT ON COLUMN booking_modifications.requested_guest_count
  IS 'New guest count being requested; NULL means no occupancy change.';

-- ---------------------------------------------------------------------------
-- Structured occupancy columns on bookings
-- ---------------------------------------------------------------------------
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS adults   INTEGER NOT NULL DEFAULT 1
    CHECK (adults   >= 1 AND adults   <= 100),
  ADD COLUMN IF NOT EXISTS children INTEGER NOT NULL DEFAULT 0
    CHECK (children >= 0 AND children <= 100),
  ADD COLUMN IF NOT EXISTS infants  INTEGER NOT NULL DEFAULT 0
    CHECK (infants  >= 0 AND infants  <= 100),
  ADD COLUMN IF NOT EXISTS pets     INTEGER NOT NULL DEFAULT 0
    CHECK (pets     >= 0 AND pets     <= 100);

COMMENT ON COLUMN bookings.adults   IS 'Number of adult guests (>= 1).';
COMMENT ON COLUMN bookings.children IS 'Number of child guests (>= 0).';
COMMENT ON COLUMN bookings.infants  IS 'Number of infant guests (>= 0).';
COMMENT ON COLUMN bookings.pets     IS 'Number of pets (>= 0).';

-- ---------------------------------------------------------------------------
-- Structured occupancy columns on booking_modifications
-- ---------------------------------------------------------------------------
ALTER TABLE booking_modifications
  ADD COLUMN IF NOT EXISTS original_adults    INTEGER
    CHECK (original_adults    IS NULL OR (original_adults    >= 1 AND original_adults    <= 100)),
  ADD COLUMN IF NOT EXISTS original_children  INTEGER
    CHECK (original_children  IS NULL OR (original_children  >= 0 AND original_children  <= 100)),
  ADD COLUMN IF NOT EXISTS original_infants   INTEGER
    CHECK (original_infants   IS NULL OR (original_infants   >= 0 AND original_infants   <= 100)),
  ADD COLUMN IF NOT EXISTS original_pets      INTEGER
    CHECK (original_pets      IS NULL OR (original_pets      >= 0 AND original_pets      <= 100)),
  ADD COLUMN IF NOT EXISTS requested_adults   INTEGER
    CHECK (requested_adults   IS NULL OR (requested_adults   >= 1 AND requested_adults   <= 100)),
  ADD COLUMN IF NOT EXISTS requested_children INTEGER
    CHECK (requested_children IS NULL OR (requested_children >= 0 AND requested_children <= 100)),
  ADD COLUMN IF NOT EXISTS requested_infants  INTEGER
    CHECK (requested_infants  IS NULL OR (requested_infants  >= 0 AND requested_infants  <= 100)),
  ADD COLUMN IF NOT EXISTS requested_pets     INTEGER
    CHECK (requested_pets     IS NULL OR (requested_pets     >= 0 AND requested_pets     <= 100));

COMMENT ON COLUMN booking_modifications.original_adults
  IS 'Adult count on the booking when the modification was requested.';
COMMENT ON COLUMN booking_modifications.requested_adults
  IS 'Requested adult count; NULL means no occupancy change.';

-- ---------------------------------------------------------------------------
-- Trigger: validate total occupancy against properties.max_guests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_booking_occupancy()
RETURNS TRIGGER AS $$
DECLARE
  v_max_guests INTEGER;
  v_total      INTEGER;
BEGIN
  -- Infants and pets do not count toward sleeping capacity.
  v_total := COALESCE(NEW.adults, 0) + COALESCE(NEW.children, 0);

  SELECT p.max_guests
    INTO v_max_guests
    FROM properties p
   WHERE p.id = NEW.property_id;

  IF v_max_guests IS NOT NULL AND v_total > v_max_guests THEN
    RAISE EXCEPTION
      'Occupancy % exceeds property % max_guests %',
      v_total, NEW.property_id, v_max_guests
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_booking_occupancy ON bookings;
CREATE TRIGGER trg_validate_booking_occupancy
  BEFORE INSERT OR UPDATE OF adults, children, property_id
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_occupancy();

-- ---------------------------------------------------------------------------
-- Trigger: validate requested occupancy on booking_modifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_booking_modification_occupancy()
RETURNS TRIGGER AS $$
DECLARE
  v_property_id UUID;
  v_max_guests  INTEGER;
  v_total       INTEGER;
BEGIN
  IF NEW.requested_adults   IS NULL
     AND NEW.requested_children IS NULL
     AND NEW.requested_infants  IS NULL
     AND NEW.requested_pets     IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.property_id INTO v_property_id
    FROM bookings b
   WHERE b.id = NEW.booking_id;

  SELECT p.max_guests INTO v_max_guests
    FROM properties p
   WHERE p.id = v_property_id;

  v_total := COALESCE(NEW.requested_adults, 0) + COALESCE(NEW.requested_children, 0);

  IF v_max_guests IS NOT NULL AND v_total > v_max_guests THEN
    RAISE EXCEPTION
      'Requested occupancy % exceeds property % max_guests %',
      v_total, v_property_id, v_max_guests
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_booking_modification_occupancy ON booking_modifications;
CREATE TRIGGER trg_validate_booking_modification_occupancy
  BEFORE INSERT OR UPDATE OF requested_adults, requested_children, requested_infants, requested_pets
  ON booking_modifications
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_modification_occupancy();
