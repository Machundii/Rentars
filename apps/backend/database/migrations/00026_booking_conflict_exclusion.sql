-- Atomic booking reservation with advisory locking to prevent double-bookings.
-- Covers both booking overlaps and host-blocked availability ranges.

-- Updated atomic booking function using per-property advisory locks.
-- The advisory lock ensures only one booking attempt for a given property
-- can pass the overlap check and INSERT at a time, even under concurrent load.
CREATE OR REPLACE FUNCTION create_booking_atomic_v2(
  p_property_id UUID,
  p_tenant_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_total_price DECIMAL,
  p_guest_count INTEGER DEFAULT 1,
  p_rules_acknowledged_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  -- Acquire a transaction-scoped advisory lock keyed by property_id.
  -- Converts the UUID to a bigint via md5 bit-cast for pg_advisory_xact_lock.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(p_property_id::text), 1, 16))::bit(64)::bigint
  );

  -- Reject if any confirmed/pending booking overlaps the requested range.
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE property_id = p_property_id
      AND status NOT IN ('Cancelled')
      AND check_in < p_check_out
      AND check_out > p_check_in
  ) THEN
    RAISE EXCEPTION 'BOOKING_CONFLICT: dates overlap with an existing booking';
  END IF;

  -- Reject if the host has blocked this date range.
  IF EXISTS (
    SELECT 1 FROM availability_ranges
    WHERE property_id = p_property_id
      AND is_available = FALSE
      AND start_date < p_check_out
      AND end_date > p_check_in
  ) THEN
    RAISE EXCEPTION 'BOOKING_BLOCKED: dates are blocked by the host';
  END IF;

  INSERT INTO bookings (
    property_id,
    tenant_id,
    check_in,
    check_out,
    total_price,
    guest_count,
    status,
    rules_acknowledged_at
  )
  VALUES (
    p_property_id,
    p_tenant_id,
    p_check_in,
    p_check_out,
    p_total_price,
    p_guest_count,
    'Pending',
    p_rules_acknowledged_at
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;
