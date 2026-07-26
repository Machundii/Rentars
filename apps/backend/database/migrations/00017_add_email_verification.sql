-- Email verification fields on users.
-- email_verified tracks whether the address has been confirmed.
-- The token is stored as a SHA-256 hex digest; the raw token is emailed.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_verification_token
  ON users(email_verification_token)
  WHERE email_verification_token IS NOT NULL;
