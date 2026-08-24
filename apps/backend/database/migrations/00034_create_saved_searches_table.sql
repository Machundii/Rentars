-- Saved searches for tenants
-- Stores search queries with serialized filters so tenants can
-- reuse them and receive notifications when new listings match.

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);

-- RLS: users can only read/write their own saved searches
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_select_own ON saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY saved_searches_insert_own ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_searches_delete_own ON saved_searches
  FOR DELETE USING (auth.uid() = user_id);
