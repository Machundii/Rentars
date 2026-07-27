-- Stores single-use, time-limited password reset tokens.
-- token_hash stores the SHA-256 hex digest; the raw token is never persisted.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id
  ON password_reset_tokens(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token_hash
  ON password_reset_tokens(token_hash);

-- Track when a user's sessions were invalidated so stateless JWTs issued
-- before this timestamp can be rejected by the auth middleware.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sessions_invalidated_at TIMESTAMPTZ;
