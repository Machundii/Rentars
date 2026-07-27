-- Add host responses and moderation fields to reviews table
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS host_response TEXT,
  ADD COLUMN IF NOT EXISTS host_response_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_reviews_is_flagged ON reviews(is_flagged) WHERE is_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);
