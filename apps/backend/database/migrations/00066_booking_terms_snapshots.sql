-- #755: Freeze the listing terms a tenant agreed to on each booking.
--
-- Hosts may change price, rules, or capacity after a booking is made. The terms
-- captured here are the ones that applied when the tenant committed, and they are
-- never rewritten.
--
-- #763: Occupancy (adults/children/infants) and the occupancy policy version are
-- part of the frozen terms so capacity and fee validation can be reconciled
-- against what applied at booking time.
--
-- #764: The policy version captured here is the one receipts reference when
-- rendering the immutable financial snapshot.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS listing_terms_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS listing_revision       INTEGER,
  ADD COLUMN IF NOT EXISTS occupancy_adults       INTEGER,
  ADD COLUMN IF NOT EXISTS occupancy_children     INTEGER,
  ADD COLUMN IF NOT EXISTS occupancy_infants      INTEGER,
  ADD COLUMN IF NOT EXISTS occupancy_policy_version INTEGER;

COMMENT ON COLUMN bookings.listing_terms_snapshot IS
  'Booking-relevant listing fields captured when the booking was created. Immutable once recorded.';

COMMENT ON COLUMN bookings.listing_revision IS
  'Listing revision number (property_versions.version_number) in effect when the booking was created.';

COMMENT ON COLUMN bookings.occupancy_adults IS
  'Number of adults on the booking, frozen at creation. Immutable once recorded.';

COMMENT ON COLUMN bookings.occupancy_children IS
  'Number of children on the booking, frozen at creation. Immutable once recorded.';

COMMENT ON COLUMN bookings.occupancy_infants IS
  'Number of infants on the booking, frozen at creation. Immutable once recorded.';

COMMENT ON COLUMN bookings.occupancy_policy_version IS
  'Occupancy policy version applied when the booking was created. Immutable once recorded.';

-- Occupancy counts must be non-negative integers when present.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_occupancy_adults_nonneg,
  DROP CONSTRAINT IF EXISTS bookings_occupancy_children_nonneg,
  DROP CONSTRAINT IF EXISTS bookings_occupancy_infants_nonneg,
  DROP CONSTRAINT IF EXISTS bookings_occupancy_policy_version_nonneg;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_occupancy_adults_nonneg
    CHECK (occupancy_adults IS NULL OR occupancy_adults >= 0),
  ADD CONSTRAINT bookings_occupancy_children_nonneg
    CHECK (occupancy_children IS NULL OR occupancy_children >= 0),
  ADD CONSTRAINT bookings_occupancy_infants_nonneg
    CHECK (occupancy_infants IS NULL OR occupancy_infants >= 0),
  ADD CONSTRAINT bookings_occupancy_policy_version_nonneg
    CHECK (occupancy_policy_version IS NULL OR occupancy_policy_version >= 0);

CREATE OR REPLACE FUNCTION prevent_booking_terms_snapshot_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.listing_terms_snapshot IS NOT NULL
     AND (NEW.listing_terms_snapshot IS DISTINCT FROM OLD.listing_terms_snapshot
          OR NEW.listing_revision    IS DISTINCT FROM OLD.listing_revision) THEN
    RAISE EXCEPTION 'listing terms snapshot is immutable once recorded';
  END IF;

  -- Occupancy and policy version are frozen once recorded, matching the
  -- immutability semantics of the listing terms snapshot.
  IF OLD.occupancy_adults IS NOT NULL
     AND (NEW.occupancy_adults         IS DISTINCT FROM OLD.occupancy_adults
          OR NEW.occupancy_children    IS DISTINCT FROM OLD.occupancy_children
          OR NEW.occupancy_infants     IS DISTINCT FROM OLD.occupancy_infants
          OR NEW.occupancy_policy_version IS DISTINCT FROM OLD.occupancy_policy_version) THEN
    RAISE EXCEPTION 'booking occupancy snapshot is immutable once recorded';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_booking_terms_snapshot_change ON bookings;
CREATE TRIGGER trg_prevent_booking_terms_snapshot_change
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION prevent_booking_terms_snapshot_change();