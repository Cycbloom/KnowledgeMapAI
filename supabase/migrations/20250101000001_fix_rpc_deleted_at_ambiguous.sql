-- Fix ambiguous column reference "deleted_at" in RPC functions
-- The subquery needs to explicitly reference graph_nodes.deleted_at

CREATE OR REPLACE FUNCTION get_user_graphs_with_counts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  is_public BOOLEAN,
  is_favorite BOOLEAN,
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
    COALESCE(g.is_favorite, false) as is_favorite,
    g.created_at,
    g.updated_at,
    g.deleted_at,
    g.last_used_at,
    COALESCE(n.count, 0) as nodes_count
  FROM knowledge_graphs g
  LEFT JOIN (
    SELECT graph_id, COUNT(*) as count
    FROM graph_nodes gn
    WHERE gn.deleted_at IS NULL
    GROUP BY graph_id
  ) n ON n.graph_id = g.id
  WHERE g.user_id = p_user_id
    AND g.deleted_at IS NULL
  ORDER BY COALESCE(g.is_favorite, false) DESC, g.last_used_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

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
    FROM graph_nodes gn
    WHERE gn.deleted_at IS NULL
    GROUP BY graph_id
  ) n ON n.graph_id = g.id
  WHERE g.user_id = p_user_id
    AND g.deleted_at IS NOT NULL
  ORDER BY g.deleted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;
