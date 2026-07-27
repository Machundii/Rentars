-- Migration: add structured house rules and draft status to properties
-- Adds boolean rule flags, free-text additional_rules, and ensures 'draft'
-- is a valid status value alongside 'available' and 'unavailable'.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS pets_allowed        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS smoking_allowed     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS events_allowed      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start   TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end     TIME,
  ADD COLUMN IF NOT EXISTS additional_rules    TEXT;

COMMENT ON COLUMN properties.pets_allowed      IS 'Whether pets are permitted on the property';
COMMENT ON COLUMN properties.smoking_allowed   IS 'Whether smoking is permitted on the property';
COMMENT ON COLUMN properties.events_allowed    IS 'Whether parties / events are permitted';
COMMENT ON COLUMN properties.quiet_hours_start IS 'Start of quiet hours window, e.g. 22:00';
COMMENT ON COLUMN properties.quiet_hours_end   IS 'End of quiet hours window, e.g. 08:00';
COMMENT ON COLUMN properties.additional_rules  IS 'Free-text field for any extra house rules';

-- Ensure the status column accepts 'draft'.
-- The existing column is VARCHAR(50) with no constraint so no ALTER needed,
-- but we document the full set of valid values here for clarity:
--   draft       – cloned/new listing not yet published
--   available   – published and bookable
--   unavailable – published but not currently bookable
COMMENT ON COLUMN properties.status IS
  'Lifecycle status: draft | available | unavailable';
