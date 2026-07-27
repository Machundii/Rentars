-- Migration: 00023_create_host_follows_table.sql
--
-- Tracks which tenants follow which hosts.
-- A row (follower_id, host_id) means "follower_id follows host_id".
--
-- Constraints:
--   • follower_id ≠ host_id  — you cannot follow yourself
--   • UNIQUE(follower_id, host_id) — prevents duplicate follows (insert
--     on conflict is idempotent for the service layer)
--
-- Both columns reference auth.users so Supabase RLS can query them directly.
-- CASCADE on delete keeps the table clean when either account is removed.

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS host_follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate follows
  CONSTRAINT host_follows_unique UNIQUE (follower_id, host_id),

  -- Prevent self-follows
  CONSTRAINT host_follows_no_self_follow CHECK (follower_id <> host_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- "Give me everyone I follow" (used by GET /follows/hosts)
CREATE INDEX IF NOT EXISTS idx_host_follows_follower
  ON host_follows (follower_id, created_at DESC);

-- "Give me everyone who follows this host" (used by notification fan-out)
CREATE INDEX IF NOT EXISTS idx_host_follows_host
  ON host_follows (host_id, created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE host_follows ENABLE ROW LEVEL SECURITY;

-- A user may see their own follow rows (as follower or as host)
CREATE POLICY host_follows_select ON host_follows
  FOR SELECT USING (
    auth.uid() = follower_id OR auth.uid() = host_id
  );

-- A user may only create follows where they are the follower
CREATE POLICY host_follows_insert ON host_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- A user may only delete their own follows
CREATE POLICY host_follows_delete ON host_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE host_follows IS
  'Tracks tenant → host follow relationships. '
  'A row exists while the follow is active; deleting the row is an unfollow.';

COMMENT ON COLUMN host_follows.follower_id IS
  'The user who chose to follow the host.';

COMMENT ON COLUMN host_follows.host_id IS
  'The host being followed. Must differ from follower_id.';
