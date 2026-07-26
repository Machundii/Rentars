-- Add GIST spatial index on the location geography column so ST_DWithin
-- and ST_DistanceSphere can be resolved via index scan instead of a full
-- table scan.  The trigger that keeps `location` in sync with
-- `latitude`/`longitude` was created in 00014_search_analytics_and_geolocation.sql.
CREATE INDEX IF NOT EXISTS idx_properties_location_gist
  ON properties USING GIST(location);
