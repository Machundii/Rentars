-- Migration: 00022_add_featured_until_to_properties.sql
--
-- Adds featured listing support to the properties table.
--
-- A property is considered "currently featured" when:
--   featured_until IS NOT NULL AND featured_until > NOW()
--
-- featured_until is set by admin endpoints and cleared automatically by
-- expiry — no background job is needed because the service layer checks
-- the timestamp on every read.
--
-- featured_weight is a tiebreaker for the within-featured ordering when
-- multiple properties are featured simultaneously (higher = shown first).
-- Defaults to 0 so existing rows are unaffected without an UPDATE.

-- ── Schema changes ────────────────────────────────────────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS featured_until  TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS featured_weight SMALLINT     NOT NULL DEFAULT 0;

-- ── Index ─────────────────────────────────────────────────────────────────────
-- Partial index: only rows that are currently featured (or scheduled to be)
-- need to be in scope for the featured-listings query.  The NULL check in the
-- WHERE clause keeps the index small — unfeatured properties are excluded.

CREATE INDEX IF NOT EXISTS idx_properties_featured_until
  ON properties (featured_until DESC, featured_weight DESC)
  WHERE featured_until IS NOT NULL;

-- ── Comment ───────────────────────────────────────────────────────────────────

COMMENT ON COLUMN properties.featured_until IS
  'Timestamp until which this property is promoted as a featured listing. '
  'NULL means not featured. A value in the past means the feature window has expired.';

COMMENT ON COLUMN properties.featured_weight IS
  'Ordering tiebreaker for featured listings (higher value = shown first). '
  'Only meaningful when featured_until is in the future.';
