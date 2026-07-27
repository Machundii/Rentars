-- Migration: 002_create_blockchain_logs
-- Creates the blockchain_logs table for tracking on-chain transaction reconciliation and errors.

CREATE TABLE IF NOT EXISTS blockchain_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  TEXT NOT NULL,
  tx_hash     TEXT,
  log_type    TEXT NOT NULL CHECK (log_type IN ('reconciliation', 'error', 'success')),
  message     TEXT,
  on_chain_status TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying logs by booking
CREATE INDEX IF NOT EXISTS idx_blockchain_logs_booking
  ON blockchain_logs (booking_id, created_at DESC);

-- Index for querying by log type
CREATE INDEX IF NOT EXISTS idx_blockchain_logs_type
  ON blockchain_logs (log_type, created_at DESC);

-- Index for querying by transaction hash
CREATE INDEX IF NOT EXISTS idx_blockchain_logs_tx_hash
  ON blockchain_logs (tx_hash);

-- Auto-cleanup: remove blockchain logs older than 90 days to prevent unbounded growth.
-- Run via a scheduled job or pg_cron extension.
-- DELETE FROM blockchain_logs WHERE created_at < NOW() - INTERVAL '90 days';
