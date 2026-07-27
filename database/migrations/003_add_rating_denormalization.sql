-- Add denormalized rating columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Create index for rating-based sorting
CREATE INDEX IF NOT EXISTS idx_properties_average_rating ON properties(average_rating DESC NULLS LAST);

-- Backfill existing properties with aggregate data from approved reviews
UPDATE properties
SET
  average_rating = COALESCE(
    (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews
     WHERE reviews.property_id = properties.id
     AND reviews.moderation_status = 'approved'),
    0
  ),
  review_count = COALESCE(
    (SELECT COUNT(*) FROM reviews
     WHERE reviews.property_id = properties.id
     AND reviews.moderation_status = 'approved'),
    0
  )
WHERE id IN (SELECT DISTINCT property_id FROM reviews WHERE property_id IS NOT NULL);

-- Create trigger to update average_rating and review_count when a review is created/updated
CREATE OR REPLACE FUNCTION update_property_rating_on_review_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the property's rating aggregates
  UPDATE properties
  SET
    average_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews
       WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
       AND moderation_status = 'approved'),
      0
    ),
    review_count = COALESCE(
      (SELECT COUNT(*) FROM reviews
       WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
       AND moderation_status = 'approved'),
      0
    )
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present, then create new one
DROP TRIGGER IF EXISTS trg_update_property_rating_on_review ON reviews;

CREATE TRIGGER trg_update_property_rating_on_review
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_property_rating_on_review_change();
