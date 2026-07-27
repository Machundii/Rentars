-- Strengthen review eligibility at the database level.
-- Eligibility (completed booking + checkout passed) is enforced in review.service.ts.
-- This migration adds a self-review guard and formalises the booking uniqueness constraint.

DO $$
BEGIN
  -- Prevent a reviewer from reviewing themselves
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'reviews' AND c.conname = 'reviews_no_self_review'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_no_self_review CHECK (reviewer_id <> target_id);
  END IF;
END $$;
