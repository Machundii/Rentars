-- #67: Idempotency key store for POST /api/v1/bookings.
-- Prevents duplicate bookings from network retries and double-clicks.
-- Keys are scoped per user and expire after 24 hours (cleaned up by scheduler).

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          VARCHAR(255) NOT NULL,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_hash VARCHAR(64)  NOT NULL,
  response_body JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status_code  INTEGER      NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id  ON idempotency_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at DESC);
