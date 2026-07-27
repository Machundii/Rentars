-- Migration: 00024_add_slug_to_properties.sql
--
-- Adds a human-readable URL slug to the properties table.
--
-- Slug format: <sanitised-title>-<sanitised-city>-<id-prefix>
-- Example:     "cozy-loft-downtown-paris-a1b2c3"
--
-- The id prefix (first 6 chars of the UUID without hyphens) guarantees
-- global uniqueness without exposing the full UUID in the URL.
-- Slugs are stable: updating title/city does NOT auto-update the slug so
-- existing URLs stay valid.  An explicit admin operation is needed to
-- regenerate a slug (POST /api/v1/properties/:id/regenerate-slug).
--
-- Backfill: a DO $$ block generates slugs for all existing rows so the
-- NOT NULL constraint and unique index can be applied immediately.

-- ── Column ────────────────────────────────────────────────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- ── Backfill helper function ──────────────────────────────────────────────────
-- Produces the same deterministic slug the application layer generates:
--   lower(title + city) → strip non-alphanum → collapse hyphens → truncate
--   → append 6-char id prefix

CREATE OR REPLACE FUNCTION generate_property_slug(
  p_title TEXT,
  p_city  TEXT,
  p_id    UUID
) RETURNS TEXT AS $$
DECLARE
  base        TEXT;
  id_suffix   TEXT;
BEGIN
  -- Combine title and city, lower-case everything
  base := lower(coalesce(p_title, '') || ' ' || coalesce(p_city, ''));

  -- Replace non-alphanumeric characters (including spaces) with hyphens
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');

  -- Strip leading/trailing hyphens
  base := trim(both '-' from base);

  -- Truncate to 60 chars to keep URLs manageable
  base := left(base, 60);

  -- Strip any trailing hyphen that the truncation may have introduced
  base := rtrim(base, '-');

  -- 6-char suffix from the UUID (remove hyphens, take first 6)
  id_suffix := left(replace(p_id::TEXT, '-', ''), 6);

  RETURN base || '-' || id_suffix;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Backfill existing rows ────────────────────────────────────────────────────

DO $$
BEGIN
  UPDATE properties
  SET    slug = generate_property_slug(title, city, id)
  WHERE  slug IS NULL;
END $$;

-- ── Constraints & index ───────────────────────────────────────────────────────

-- Now that all rows have a slug, enforce NOT NULL
ALTER TABLE properties
  ALTER COLUMN slug SET NOT NULL;

-- Unique index — slugs must be globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_slug
  ON properties (slug);

-- ── Comment ───────────────────────────────────────────────────────────────────

COMMENT ON COLUMN properties.slug IS
  'URL-safe human-readable identifier. '
  'Format: <title>-<city>-<6-char-id-prefix>. '
  'Stable after creation — changing title/city does not auto-update the slug.';
