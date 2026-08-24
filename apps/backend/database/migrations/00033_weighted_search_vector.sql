-- Weighted full-text search vector
-- Rebuilds search_vector with setweight so title matches outrank description matches.
-- A = title (highest), B = city, C = description, D = amenities (lowest)

-- 1. Backfill existing rows with weighted search vector
UPDATE properties
SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(amenities, ' '), '')), 'D')
WHERE search_vector IS NOT NULL
   OR title IS NOT NULL
   OR city IS NOT NULL
   OR description IS NOT NULL
   OR amenities IS NOT NULL;

-- 2. Update the trigger to maintain weighted search vector on insert/update
CREATE OR REPLACE FUNCTION properties_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.city, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.amenities, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_properties_search_vector_update ON properties;
CREATE TRIGGER trg_properties_search_vector_update
BEFORE INSERT OR UPDATE OF title, description, city, amenities
ON properties
FOR EACH ROW
EXECUTE FUNCTION properties_search_vector_update();

-- 3. Ranked search RPC function — returns properties ordered by ts_rank_cd
CREATE OR REPLACE FUNCTION search_properties_ranked(
  search_query text,
  result_limit integer DEFAULT 20,
  result_offset integer DEFAULT 0
)
RETURNS SETOF jsonb AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(p.*) || jsonb_build_object('rank', ts_rank_cd(p.search_vector, plainto_tsquery('english', search_query)))
  FROM properties p
  WHERE p.search_vector @@ plainto_tsquery('english', search_query)
    AND p.deleted_at IS NULL
  ORDER BY ts_rank_cd(p.search_vector, plainto_tsquery('english', search_query)) DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;
