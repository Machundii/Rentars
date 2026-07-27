-- Migration: 00020_add_property_views
-- Adds a property_views table for deduplicated view tracking
-- and a denormalized view_count column on the properties table.

-- ── property_views ────────────────────────────────────────────────────────────
-- Each row records one deduplicated view event per viewer per property.
-- viewer_key is either the authenticated user_id (UUID) or an anonymous
-- fingerprint string. The unique index on (property_id, viewer_key, window_start)
-- enforces the 1-hour deduplication window at the DB level as a safety net
-- (the service layer also checks before inserting).

CREATE TABLE IF NOT EXISTS property_views (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  viewer_key   TEXT        NOT NULL,          -- user_id or anon fingerprint
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  ip_hash      TEXT,                          -- SHA-256 of IP, for analytics only
  user_agent   TEXT,
  window_start TIMESTAMPTZ NOT NULL,          -- start of the 1-hour dedup window
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce dedup: one row per (property, viewer, hour window)
CREATE UNIQUE INDEX IF NOT EXISTS uix_property_views_dedup
  ON property_views (property_id, viewer_key, window_start);

-- Fast lookup for host dashboard queries
CREATE INDEX IF NOT EXISTS idx_property_views_property_id
  ON property_views (property_id);

CREATE INDEX IF NOT EXISTS idx_property_views_viewed_at
  ON property_views (viewed_at);

-- ── view_count on properties ──────────────────────────────────────────────────
-- Denormalized counter updated asynchronously by the view service.
-- Avoids a COUNT(*) on every read.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing rows (safe to run on empty table too)
UPDATE properties p
SET view_count = (
  SELECT COUNT(*) FROM property_views v WHERE v.property_id = p.id
);
