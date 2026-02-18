-- Update RPC function to include last_used_at and sort by it
-- Must drop and recreate because return type changed

DROP FUNCTION IF EXISTS get_user_graphs_with_counts(UUID);

CREATE FUNCTION get_user_graphs_with_counts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  nodes_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.user_id,
    g.title,
    g.description,
    g.is_public,
    g.created_at,
    g.updated_at,
    g.deleted_at,
    g.last_used_at,
    COALESCE(n.count, 0) as nodes_count
  FROM knowledge_graphs g
  LEFT JOIN (
    SELECT graph_id, COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL
    GROUP BY graph_id
  ) n ON n.graph_id = g.id
  WHERE g.user_id = p_user_id
    AND g.deleted_at IS NULL
  ORDER BY g.last_used_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_user_graphs_with_counts(UUID) TO authenticated;
