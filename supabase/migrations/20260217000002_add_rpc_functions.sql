-- Add RPC functions for performance optimization

-- Get user graphs with node counts in a single query
CREATE OR REPLACE FUNCTION get_user_graphs_with_counts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
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
  ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get user trashed graphs with node counts
CREATE OR REPLACE FUNCTION get_user_trashed_graphs(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
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
    COALESCE(n.count, 0) as nodes_count
  FROM knowledge_graphs g
  LEFT JOIN (
    SELECT graph_id, COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL
    GROUP BY graph_id
  ) n ON n.graph_id = g.id
  WHERE g.user_id = p_user_id
    AND g.deleted_at IS NOT NULL
  ORDER BY g.deleted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Batch update node positions
CREATE OR REPLACE FUNCTION batch_update_positions(
  p_positions JSONB
) RETURNS void AS $$
DECLARE
  pos JSONB;
BEGIN
  FOR pos IN SELECT * FROM jsonb_array_elements(p_positions)
  LOOP
    UPDATE nodes
    SET 
      x_position = (pos->>'x')::INTEGER,
      y_position = (pos->>'y')::INTEGER,
      updated_at = NOW()
    WHERE id = (pos->>'id')::UUID;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_graphs_with_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_trashed_graphs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_positions(JSONB) TO authenticated;
