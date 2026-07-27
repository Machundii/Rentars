-- Add indexes and aggregation functions for search analytics dashboard

-- Index to support date-range aggregation queries
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at
ON search_analytics (created_at DESC);

-- Partial index for zero-result query lookups
CREATE INDEX IF NOT EXISTS idx_search_analytics_zero_result
ON search_analytics (created_at DESC)
WHERE result_count = 0;

-- Table to track suggestion events (offered / accepted)
CREATE TABLE IF NOT EXISTS search_suggestion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('offered', 'accepted')),
  suggestion_type TEXT NOT NULL,
  original_query TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_events_created_at
ON search_suggestion_events (created_at DESC);

-- Aggregation function: top queries by frequency in a date range
CREATE OR REPLACE FUNCTION get_top_queries(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (query TEXT, frequency BIGINT, avg_results INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.query,
    COUNT(*)::BIGINT AS frequency,
    AVG(sa.result_count)::INTEGER AS avg_results
  FROM search_analytics sa
  WHERE sa.created_at >= p_start_date
    AND sa.created_at < p_end_date
  GROUP BY sa.query
  ORDER BY frequency DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Aggregation function: zero-result queries by frequency in a date range
CREATE OR REPLACE FUNCTION get_zero_result_queries(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (query TEXT, frequency BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.query,
    COUNT(*)::BIGINT AS frequency
  FROM search_analytics sa
  WHERE sa.created_at >= p_start_date
    AND sa.created_at < p_end_date
    AND sa.result_count = 0
  GROUP BY sa.query
  ORDER BY frequency DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Aggregation function: daily search volume over a date range
CREATE OR REPLACE FUNCTION get_daily_search_volume(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (date DATE, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(sa.created_at AT TIME ZONE 'UTC') AS date,
    COUNT(*)::BIGINT AS count
  FROM search_analytics sa
  WHERE sa.created_at >= p_start_date
    AND sa.created_at < p_end_date
  GROUP BY DATE(sa.created_at AT TIME ZONE 'UTC')
  ORDER BY date ASC;
END;
$$ LANGUAGE plpgsql;
