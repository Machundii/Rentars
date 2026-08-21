-- Ensure the amenities column is a proper text array (it should already be,
-- but guard with IF NOT EXISTS to make this migration idempotent).
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';

-- GIN index allows fast "array contains all" queries used by the amenities
-- filter (the @> operator / Supabase .contains()).
CREATE INDEX IF NOT EXISTS idx_properties_amenities_gin
  ON properties USING GIN(amenities);
