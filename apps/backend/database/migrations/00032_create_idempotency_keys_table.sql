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

-- #766: Replay ledger for escrow and payment provider callbacks.
-- Every callback (valid or not) is recorded here keyed by the provider event
-- identifier so replayed callbacks are harmless (unique constraint) and
-- mismatched/quarantined events remain auditable.
CREATE TABLE IF NOT EXISTS payment_callback_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         VARCHAR(255) NOT NULL,
  provider         VARCHAR(64)  NOT NULL DEFAULT 'unknown',
  booking_id       UUID         NULL REFERENCES bookings(id) ON DELETE SET NULL,
  payment_id       UUID         NULL,
  event_hash       VARCHAR(64)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'received',
  quarantine_reason TEXT        NULL,
  payload          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  received_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at     TIMESTAMP    NULL,
  CONSTRAINT uq_payment_callback_events_event_id UNIQUE (event_id),
  CONSTRAINT ck_payment_callback_events_status CHECK (
    status IN ('received', 'processed', 'duplicate', 'quarantined', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_booking_id
  ON payment_callback_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_callback_events_status
  ON payment_callback_events(status);
CREATE INDEX IF NOT EXISTS idx_payment_callback_events_received_at
  ON payment_callback_events(received_at DESC);

-- Audit reference linking a payment to the callback event that last applied
-- state to it, so valid callbacks leave a traceable audit reference.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS callback_event_id UUID NULL
    REFERENCES payment_callback_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_callback_event_id
  ON payments(callback_event_id);