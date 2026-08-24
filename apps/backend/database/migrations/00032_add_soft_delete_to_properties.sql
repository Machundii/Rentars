-- Migration 00032: Add soft-delete support to the properties table
-- Adds a nullable `deleted_at` timestamp column so property deletions
-- set a tombstone timestamp instead of removing the row, preserving the
-- history needed for past bookings, reviews, and on-chain references.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index: only non-deleted rows are indexed, so public queries that
-- filter `WHERE deleted_at IS NULL` hit a small, efficient index.
CREATE INDEX IF NOT EXISTS idx_properties_not_deleted
  ON properties (id)
  WHERE deleted_at IS NULL;

-- Comment documenting the column's intent for future maintainers.
COMMENT ON COLUMN properties.deleted_at IS
  'Soft-delete tombstone. NULL means the listing is active. A non-NULL value '
  'means the host has removed the listing; the row is preserved for historical '
  'bookings, reviews, and on-chain references.';
