-- Migration: 00028_create_audit_and_payments.sql
-- Creates the audit_logs table for structured audit trail (issue #376)
-- and the payments table for payment state tracking (issue #378).

-- ─── audit_logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   TEXT,
  ip            TEXT,
  meta          JSONB,

  -- Index on actor to support "show audit history for user X"
  CONSTRAINT audit_logs_action_not_empty CHECK (char_length(action) > 0)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor     ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource  ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);

-- RLS: Only admins (service-role) can read audit_logs.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_service_role_only ON audit_logs
  USING (auth.role() = 'service_role');

-- ─── payments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usdc     NUMERIC(20, 7) NOT NULL CHECK (amount_usdc > 0),
  stellar_tx_hash TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'timed_out')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB,

  CONSTRAINT payments_booking_id_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_booking    ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant     ON payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash    ON payments (stellar_tx_hash) WHERE stellar_tx_hash IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();

-- RLS: Tenants can read their own payments; service role has full access.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_tenant_read ON payments
  FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY payments_service_role_all ON payments
  USING (auth.role() = 'service_role');

-- ─── booking_receipts ─────────────────────────────────────────────────────────
-- Immutable, versioned financial snapshots for completed bookings (issue #039).
-- Each row stores the canonical settled snapshot (JSONB) plus the policy
-- version that applied at booking time, so receipts are reproducible and
-- regeneration never mutates financial data.

CREATE TABLE IF NOT EXISTS booking_receipts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  version        INTEGER     NOT NULL CHECK (version > 0),
  snapshot       JSONB       NOT NULL,
  rendered_pdf   BYTEA,
  storage_ref    TEXT,
  policy_version TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_receipts_version_unique UNIQUE (booking_id, version),
  CONSTRAINT booking_receipts_render_target CHECK (rendered_pdf IS NOT NULL OR storage_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_booking_receipts_booking ON booking_receipts (booking_id, version DESC);

-- Immutability: receipts may only be updated to attach rendered output
-- (rendered_pdf / storage_ref) when it was previously NULL. Financial data
-- (snapshot, policy_version, version, booking_id) can never change.
CREATE OR REPLACE FUNCTION booking_receipts_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_id     IS DISTINCT FROM OLD.booking_id
     OR NEW.version        IS DISTINCT FROM OLD.version
     OR NEW.snapshot       IS DISTINCT FROM OLD.snapshot
     OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
     OR NEW.created_at     IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'booking_receipts rows are immutable';
  END IF;

  IF OLD.rendered_pdf IS NOT NULL AND NEW.rendered_pdf IS DISTINCT FROM OLD.rendered_pdf THEN
    RAISE EXCEPTION 'booking_receipts rendered_pdf is immutable once set';
  END IF;

  IF OLD.storage_ref IS NOT NULL AND NEW.storage_ref IS DISTINCT FROM OLD.storage_ref THEN
    RAISE EXCEPTION 'booking_receipts storage_ref is immutable once set';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_receipts_immutable ON booking_receipts;
CREATE TRIGGER trg_booking_receipts_immutable
  BEFORE UPDATE ON booking_receipts
  FOR EACH ROW EXECUTE FUNCTION booking_receipts_immutable();

-- RLS: only the booking participant (tenant or host) may read receipts;
-- service role has full access. No client-side writes are permitted.
ALTER TABLE booking_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_receipts_participant_read ON booking_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_receipts.booking_id
        AND (b.tenant_id = auth.uid() OR b.host_id = auth.uid())
    )
  );

CREATE POLICY booking_receipts_service_role_all ON booking_receipts
  USING (auth.role() = 'service_role');
