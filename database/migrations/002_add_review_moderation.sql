-- Add review moderation columns
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- Create index for efficient moderation queue queries
CREATE INDEX IF NOT EXISTS idx_reviews_moderation_status ON reviews(moderation_status) WHERE moderation_status != 'approved';

-- Update existing reviews to approved (backfill)
UPDATE reviews SET moderation_status = 'approved' WHERE moderation_status IS NULL AND is_approved = true;
UPDATE reviews SET moderation_status = 'rejected' WHERE moderation_status IS NULL AND is_approved = false;
UPDATE reviews SET moderation_status = 'pending' WHERE moderation_status IS NULL;
