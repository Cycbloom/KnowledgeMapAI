-- =====================================================
-- Knowledge Map - Functions
-- =====================================================

-- Universal updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User sync trigger (Auth -> Public)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'User')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name);

  INSERT INTO public.notification_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Knowledge point version snapshot trigger
CREATE OR REPLACE FUNCTION create_knowledge_point_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO knowledge_point_versions (
      knowledge_point_id,
      version_number,
      title,
      content,
      learning_material,
      keywords,
      properties,
      changed_by
    ) VALUES (
      NEW.id,
      1,
      NEW.title,
      NEW.content,
      NEW.learning_material,
      NEW.keywords,
      NEW.properties,
      NEW.owner_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.title != NEW.title OR
       OLD.content IS DISTINCT FROM NEW.content OR
       OLD.learning_material IS DISTINCT FROM NEW.learning_material OR
       OLD.keywords IS DISTINCT FROM NEW.keywords OR
       OLD.properties IS DISTINCT FROM NEW.properties THEN

      SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
      FROM knowledge_point_versions
      WHERE knowledge_point_id = NEW.id;

      INSERT INTO knowledge_point_versions (
        knowledge_point_id,
        version_number,
        title,
        content,
        learning_material,
        keywords,
        properties,
        changed_by
      ) VALUES (
        NEW.id,
        next_version,
        NEW.title,
        NEW.content,
        NEW.learning_material,
        NEW.keywords,
        NEW.properties,
        NEW.owner_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Match knowledge points function for semantic search
-- p_user_id defaults to NULL: when NULL, only public knowledge points are returned
CREATE OR REPLACE FUNCTION match_knowledge_points (
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title varchar(255),
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp.id,
    kp.title,
    kp.content,
    1 - (kp.embedding <=> query_embedding) as similarity
  FROM knowledge_points kp
  WHERE (kp.visibility = 'public' OR (p_user_id IS NOT NULL AND kp.owner_id = p_user_id))
    AND kp.embedding IS NOT NULL
    AND 1 - (kp.embedding <=> query_embedding) > match_threshold
  ORDER BY kp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_knowledge_points_by_graph (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  p_user_id uuid,
  p_graph_id uuid
)
RETURNS TABLE (
  id uuid,
  title varchar(255),
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp.id,
    kp.title,
    kp.content,
    1 - (kp.embedding <=> query_embedding) as similarity
  FROM knowledge_points kp
  JOIN graph_nodes gn ON gn.knowledge_point_id = kp.id
  WHERE gn.graph_id = p_graph_id
    AND gn.deleted_at IS NULL
    AND (kp.visibility = 'public' OR kp.owner_id = p_user_id)
    AND kp.embedding IS NOT NULL
    AND 1 - (kp.embedding <=> query_embedding) > match_threshold
  ORDER BY kp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Get user study stats function
CREATE OR REPLACE FUNCTION get_user_study_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'metrics', (
            SELECT jsonb_build_object(
                'totalCards', COUNT(*),
                'dueToday', COUNT(*) FILTER (WHERE next_review <= (CURRENT_DATE + TIME '23:59:59')),
                'learning', COUNT(*) FILTER (WHERE fsrs_state IN ('Learning', 'Relearning')),
                'avgStability', COALESCE(ROUND(AVG(fsrs_stability) FILTER (WHERE fsrs_state != 'New')::numeric, 1), 0.0)
            )
            FROM study_cards
            WHERE user_id = p_user_id
        ),
        'distribution', (
            SELECT jsonb_agg(item)
            FROM (
                SELECT fsrs_state, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id
                GROUP BY fsrs_state
            ) t CROSS JOIN LATERAL (
                SELECT jsonb_build_object('state', fsrs_state, 'count', count) as item
            ) sub
        ),
        'heatmap', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT last_reviewed::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id
                AND last_reviewed >= (CURRENT_DATE - INTERVAL '365 days')
                AND last_reviewed IS NOT NULL
                GROUP BY last_reviewed::date
            ) t
        ),
        'growth', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT created_at::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id
                AND created_at >= (CURRENT_DATE - INTERVAL '30 days')
                GROUP BY created_at::date
            ) t
        ),
        'forecast', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'count', count)), '[]'::jsonb)
            FROM (
                SELECT next_review::date as date, COUNT(*) as count
                FROM study_cards
                WHERE user_id = p_user_id
                AND next_review >= CURRENT_DATE
                AND next_review <= (CURRENT_DATE + INTERVAL '7 days')
                GROUP BY next_review::date
            ) t
        )
    ) INTO result;
    RETURN result;
END;
$$;

-- Get user graphs with node counts in a single query
CREATE OR REPLACE FUNCTION get_user_graphs_with_counts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title VARCHAR(512),
  description TEXT,
  is_public BOOLEAN,
  is_favorite BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  nodes_count BIGINT,
  template_type VARCHAR(64)
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
    COALESCE(n.count, 0) as nodes_count,
    g.template_type
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

-- Get user trashed graphs with node counts
CREATE OR REPLACE FUNCTION get_user_trashed_graphs(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title VARCHAR(512),
  description TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  nodes_count BIGINT,
  template_type VARCHAR(64)
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
    COALESCE(n.count, 0) as nodes_count,
    g.template_type
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

-- Batch update node positions
CREATE OR REPLACE FUNCTION batch_update_positions(
  p_positions JSONB
) RETURNS void AS $$
DECLARE
  pos JSONB;
BEGIN
  FOR pos IN SELECT * FROM jsonb_array_elements(p_positions)
  LOOP
    UPDATE graph_nodes
    SET
      x_position = (pos->>'x')::INTEGER,
      y_position = (pos->>'y')::INTEGER,
      updated_at = NOW()
    WHERE id = (pos->>'id')::UUID;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get accessible knowledge points (public + own private)
CREATE OR REPLACE FUNCTION get_accessible_knowledge_points(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title VARCHAR(512),
  content TEXT,
  learning_material TEXT,
  keywords JSONB,
  properties JSONB,
  visibility knowledge_point_visibility,
  owner_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp.id,
    kp.title,
    kp.content,
    kp.learning_material,
    kp.keywords,
    kp.properties,
    kp.visibility,
    kp.owner_id,
    kp.created_at,
    kp.updated_at
  FROM knowledge_points kp
  WHERE kp.visibility = 'public' OR kp.owner_id = p_user_id
  ORDER BY kp.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Search similar knowledge points (for AI reuse)
CREATE OR REPLACE FUNCTION search_similar_knowledge_points(
  p_query_embedding vector(1024),
  p_user_id UUID,
  p_match_threshold FLOAT DEFAULT 0.8,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(512),
  content TEXT,
  similarity FLOAT,
  visibility knowledge_point_visibility
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp.id,
    kp.title,
    kp.content,
    1 - (kp.embedding <=> p_query_embedding) as similarity,
    kp.visibility
  FROM knowledge_points kp
  WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
    AND (1 - (kp.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY kp.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get knowledge point graphs
CREATE OR REPLACE FUNCTION get_knowledge_point_graphs(p_knowledge_point_id UUID, p_user_id UUID)
RETURNS TABLE (
  graph_id UUID,
  graph_title VARCHAR(512),
  x_position FLOAT,
  y_position FLOAT,
  level VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kg.id,
    kg.title,
    gn.x_position,
    gn.y_position,
    gn.level
  FROM graph_nodes gn
  JOIN knowledge_graphs kg ON gn.graph_id = kg.id
  WHERE gn.knowledge_point_id = p_knowledge_point_id
    AND gn.deleted_at IS NULL
    AND kg.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Soft delete graph node (remove from graph)
CREATE OR REPLACE FUNCTION soft_delete_graph_node(
  p_graph_node_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_graph_id UUID;
BEGIN
  SELECT gn.graph_id INTO v_graph_id
  FROM graph_nodes gn
  JOIN knowledge_graphs kg ON gn.graph_id = kg.id
  WHERE gn.id = p_graph_node_id AND kg.user_id = p_user_id;

  IF v_graph_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM edges
  WHERE (source_knowledge_point_id IN (
      SELECT knowledge_point_id FROM graph_nodes WHERE id = p_graph_node_id
    ) OR target_knowledge_point_id IN (
      SELECT knowledge_point_id FROM graph_nodes WHERE id = p_graph_node_id
    ))
    AND graph_id = v_graph_id;

  UPDATE graph_nodes
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_graph_node_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hard delete knowledge point (complete deletion)
CREATE OR REPLACE FUNCTION hard_delete_knowledge_point(
  p_knowledge_point_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_graph_count INT;
  v_deleted_graph_nodes INT;
  v_deleted_edges INT;
  v_deleted_cards INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM knowledge_points WHERE id = p_knowledge_point_id AND owner_id = p_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Permission denied');
  END IF;

  SELECT COUNT(*) INTO v_graph_count
  FROM graph_nodes
  WHERE knowledge_point_id = p_knowledge_point_id AND deleted_at IS NULL;

  DELETE FROM edges e
  WHERE EXISTS (
    SELECT 1 FROM graph_nodes gn
    WHERE gn.knowledge_point_id = p_knowledge_point_id
      AND (e.source_knowledge_point_id = gn.knowledge_point_id OR e.target_knowledge_point_id = gn.knowledge_point_id)
  );

  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;

  DELETE FROM graph_nodes WHERE knowledge_point_id = p_knowledge_point_id;
  GET DIAGNOSTICS v_deleted_graph_nodes = ROW_COUNT;

  DELETE FROM study_cards WHERE knowledge_point_id = p_knowledge_point_id;
  GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;

  DELETE FROM knowledge_points WHERE id = p_knowledge_point_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'affected_graphs', v_graph_count,
    'deleted_graph_nodes', v_deleted_graph_nodes,
    'deleted_edges', v_deleted_edges,
    'deleted_cards', v_deleted_cards
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search similar graphs by topic embedding
CREATE OR REPLACE FUNCTION search_similar_graphs(
  p_query_embedding vector(1024),
  p_user_id UUID,
  p_match_threshold FLOAT DEFAULT 0.85,
  p_match_count INT DEFAULT 10,
  p_exclude_graph_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(512),
  description TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kg.id,
    kg.title,
    kg.description,
    1 - (kg.embedding <=> p_query_embedding) as similarity
  FROM knowledge_graphs kg
  WHERE kg.user_id = p_user_id
    AND kg.deleted_at IS NULL
    AND kg.embedding IS NOT NULL
    AND (p_exclude_graph_id IS NULL OR kg.id != p_exclude_graph_id)
    AND (1 - (kg.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY kg.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if a topic is duplicate
CREATE OR REPLACE FUNCTION check_duplicate_graph_topic(
  p_topic VARCHAR(255),
  p_user_id UUID,
  p_threshold FLOAT DEFAULT 0.85,
  p_exclude_graph_id UUID DEFAULT NULL
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  similar_graph_id UUID,
  similar_graph_title VARCHAR(512),
  similarity FLOAT
) AS $$
DECLARE
  v_embedding vector(1024);
  v_similar record;
BEGIN
  RETURN QUERY
  SELECT
    FALSE as is_duplicate,
    NULL::UUID as similar_graph_id,
    NULL::VARCHAR(512) as similar_graph_title,
    0.0::FLOAT as similarity;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-create task settings for new users
CREATE OR REPLACE FUNCTION handle_new_user_task_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update user focus stats
CREATE OR REPLACE FUNCTION update_user_focus_stats()
RETURNS TRIGGER AS $$
DECLARE
  focus_date DATE;
  prev_focus_date DATE;
  new_streak INTEGER;
BEGIN
  focus_date := NEW.started_at::date;

  INSERT INTO user_focus_stats (user_id, total_focus_seconds, total_sessions, total_pomodoros, current_streak, longest_streak, last_focus_date)
  VALUES (
    NEW.user_id,
    COALESCE(NEW.duration, 0),
    1,
    COALESCE(NEW.pomodoro_count, 0),
    1,
    1,
    focus_date
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_focus_seconds = user_focus_stats.total_focus_seconds + COALESCE(NEW.duration, 0),
    total_sessions = user_focus_stats.total_sessions + 1,
    total_pomodoros = user_focus_stats.total_pomodoros + COALESCE(NEW.pomodoro_count, 0),
    last_focus_date = focus_date,
    updated_at = NOW();

  IF COALESCE(NEW.is_break, FALSE) = FALSE THEN
    SELECT last_focus_date INTO prev_focus_date
    FROM user_focus_stats
    WHERE user_id = NEW.user_id;

    IF prev_focus_date IS NOT NULL THEN
      IF prev_focus_date = focus_date - 1 THEN
        new_streak := (SELECT current_streak FROM user_focus_stats WHERE user_id = NEW.user_id) + 1;
        UPDATE user_focus_stats
        SET current_streak = new_streak,
            longest_streak = GREATEST(longest_streak, new_streak)
        WHERE user_id = NEW.user_id;
      ELSIF prev_focus_date < focus_date - 1 THEN
        UPDATE user_focus_stats
        SET current_streak = 1
        WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update stats on task complete
CREATE OR REPLACE FUNCTION update_stats_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE user_focus_stats
    SET total_tasks_completed = total_tasks_completed + 1,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;

    IF NOT FOUND THEN
      INSERT INTO user_focus_stats (user_id, total_tasks_completed)
      VALUES (NEW.user_id, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Match document chunks function for semantic search
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  p_user_id uuid,
  p_graph_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  knowledge_point_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_graph_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      dc.id,
      dc.knowledge_point_id,
      dc.chunk_index,
      dc.content,
      1 - (dc.embedding <=> query_embedding) as similarity
    FROM document_chunks dc
    JOIN knowledge_points kp ON dc.knowledge_point_id = kp.id
    JOIN graph_nodes gn ON gn.knowledge_point_id = kp.id
    WHERE gn.graph_id = p_graph_id
      AND gn.deleted_at IS NULL
      AND (kp.visibility = 'public' OR kp.owner_id = p_user_id)
      AND dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      dc.id,
      dc.knowledge_point_id,
      dc.chunk_index,
      dc.content,
      1 - (dc.embedding <=> query_embedding) as similarity
    FROM document_chunks dc
    JOIN knowledge_points kp ON dc.knowledge_point_id = kp.id
    WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
      AND dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$$;

-- GraphRAG: BFS traverse neighbors from seed nodes
CREATE OR REPLACE FUNCTION graph_traverse_neighbors(
  p_graph_id uuid,
  p_source_ids uuid[],
  p_max_hops int DEFAULT 2,
  p_relationship_types text[] DEFAULT NULL
)
RETURNS TABLE (
  knowledge_point_id uuid,
  title varchar,
  content text,
  hop_distance int,
  relationship_path text,
  relationship_type text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_hop int := 0;
  v_frontier uuid[];
  v_next_frontier uuid[];
  v_source_id uuid;
  v_target_id uuid;
  v_rel_type text;
  v_source_title varchar;
  v_target_title varchar;
  v_path_text text;
BEGIN
  -- Return empty if no source IDs provided
  IF p_source_ids IS NULL OR array_length(p_source_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Initialize visited set with source IDs (excluded from results)
  CREATE TEMP TABLE _visited (
    kp_id uuid PRIMARY KEY,
    hop int NOT NULL,
    path text,
    rel_type text
  ) ON COMMIT DROP;

  -- Mark source IDs as visited at hop 0
  INSERT INTO _visited (kp_id, hop, path, rel_type)
  SELECT unnest(p_source_ids), 0, NULL, NULL;

  -- Initialize frontier with source IDs
  v_frontier := p_source_ids;

  -- BFS loop
  WHILE v_current_hop < p_max_hops AND array_length(v_frontier, 1) IS NOT NULL LOOP
    v_current_hop := v_current_hop + 1;
    v_next_frontier := ARRAY[]::uuid[];

    -- Find all edges from current frontier nodes
    FOR v_source_id, v_target_id, v_rel_type, v_source_title, v_target_title IN
      SELECT
        e.source_knowledge_point_id,
        e.target_knowledge_point_id,
        e.relationship_type,
        src_kp.title,
        tgt_kp.title
      FROM edges e
      JOIN knowledge_points src_kp ON src_kp.id = e.source_knowledge_point_id
      JOIN knowledge_points tgt_kp ON tgt_kp.id = e.target_knowledge_point_id
      WHERE e.graph_id = p_graph_id
        AND e.deleted_at IS NULL
        AND e.source_knowledge_point_id = ANY(v_frontier)
        AND (p_relationship_types IS NULL OR e.relationship_type = ANY(p_relationship_types))
    LOOP
      -- Skip if already visited (cycle detection)
      IF EXISTS (SELECT 1 FROM _visited WHERE kp_id = v_target_id) THEN
        CONTINUE;
      END IF;

      -- Build path text
      SELECT path INTO v_path_text FROM _visited WHERE kp_id = v_source_id;
      IF v_path_text IS NULL THEN
        v_path_text := v_source_title || ' → ' || COALESCE(v_rel_type, '') || ' → ' || v_target_title;
      ELSE
        v_path_text := v_path_text || ' → ' || COALESCE(v_rel_type, '') || ' → ' || v_target_title;
      END IF;

      -- Mark as visited
      INSERT INTO _visited (kp_id, hop, path, rel_type)
      VALUES (v_target_id, v_current_hop, v_path_text, v_rel_type);

      -- Add to next frontier
      v_next_frontier := v_next_frontier || v_target_id;
    END LOOP;

    v_frontier := v_next_frontier;
  END LOOP;

  -- Return results (exclude source IDs at hop 0), ordered by hop_distance
  RETURN QUERY
  SELECT
    v.kp_id AS knowledge_point_id,
    kp.title,
    kp.content,
    v.hop AS hop_distance,
    v.path AS relationship_path,
    v.rel_type AS relationship_type
  FROM _visited v
  JOIN knowledge_points kp ON kp.id = v.kp_id
  WHERE v.hop > 0
  ORDER BY v.hop ASC;
END;
$$;

-- ============================================================
-- Graph deletion functions (soft delete & permanent delete)
-- ============================================================

-- 1. Permanent delete a single graph and all its cascading data
CREATE OR REPLACE FUNCTION permanent_delete_graph(p_graph_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_graphs int;
  v_deleted_nodes int;
  v_deleted_edges int;
  v_deleted_cards int;
  v_graph_ids uuid[];
BEGIN
  -- Verify ownership
  SELECT id INTO v_deleted_graphs
  FROM knowledge_graphs
  WHERE id = p_graph_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Graph not found or user does not own it';
  END IF;

  -- Collect main graph + branch graph IDs
  SELECT array_agg(id) INTO v_graph_ids
  FROM knowledge_graphs
  WHERE (id = p_graph_id OR (parent_graph_id = p_graph_id AND is_branch = true));

  -- Delete study_cards associated with graph_nodes in these graphs
  DELETE FROM study_cards
  WHERE graph_id = ANY(v_graph_ids);

  GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;

  -- Delete edges for these graphs
  DELETE FROM edges
  WHERE graph_id = ANY(v_graph_ids);

  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;

  -- Delete graph_nodes for these graphs
  DELETE FROM graph_nodes
  WHERE graph_id = ANY(v_graph_ids);

  GET DIAGNOSTICS v_deleted_nodes = ROW_COUNT;

  -- Delete branches first, then main graph
  DELETE FROM knowledge_graphs
  WHERE id = ANY(v_graph_ids);

  GET DIAGNOSTICS v_deleted_graphs = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_graphs', v_deleted_graphs,
    'deleted_nodes', v_deleted_nodes,
    'deleted_edges', v_deleted_edges,
    'deleted_cards', v_deleted_cards
  );
END;
$$;

-- 2. Soft delete a single graph and its branches
CREATE OR REPLACE FUNCTION soft_delete_graph_with_branches(p_graph_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_soft_deleted_graphs int;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE id = p_graph_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Graph not found or user does not own it';
  END IF;

  -- Soft delete main graph + branches
  UPDATE knowledge_graphs
  SET deleted_at = NOW()
  WHERE (id = p_graph_id OR (parent_graph_id = p_graph_id AND is_branch = true AND deleted_at IS NULL))
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_soft_deleted_graphs = ROW_COUNT;

  RETURN jsonb_build_object(
    'soft_deleted_graphs', v_soft_deleted_graphs
  );
END;
$$;

-- 3. Batch soft delete multiple graphs and their branches
CREATE OR REPLACE FUNCTION batch_soft_delete_graphs(p_graph_ids uuid[], p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_soft_deleted_graphs int;
  v_owned_count int;
BEGIN
  -- Verify ownership for all graphs
  SELECT count(*) INTO v_owned_count
  FROM knowledge_graphs
  WHERE id = ANY(p_graph_ids) AND user_id = p_user_id;

  IF v_owned_count <> array_length(p_graph_ids, 1) THEN
    RAISE EXCEPTION 'One or more graphs not found or user does not own them';
  END IF;

  -- Soft delete specified graphs + their branches
  UPDATE knowledge_graphs
  SET deleted_at = NOW()
  WHERE (
    id = ANY(p_graph_ids)
    OR (parent_graph_id = ANY(p_graph_ids) AND is_branch = true AND deleted_at IS NULL)
  ) AND user_id = p_user_id;

  GET DIAGNOSTICS v_soft_deleted_graphs = ROW_COUNT;

  RETURN jsonb_build_object(
    'soft_deleted_graphs', v_soft_deleted_graphs
  );
END;
$$;

-- 4. Batch permanent delete multiple graphs and their cascading data
CREATE OR REPLACE FUNCTION batch_permanent_delete_graphs(p_graph_ids uuid[], p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_graphs int;
  v_deleted_nodes int;
  v_deleted_edges int;
  v_deleted_cards int;
  v_all_graph_ids uuid[];
  v_owned_count int;
BEGIN
  -- Verify ownership for all graphs
  SELECT count(*) INTO v_owned_count
  FROM knowledge_graphs
  WHERE id = ANY(p_graph_ids) AND user_id = p_user_id;

  IF v_owned_count <> array_length(p_graph_ids, 1) THEN
    RAISE EXCEPTION 'One or more graphs not found or user does not own them';
  END IF;

  -- Collect all graph IDs (main + branches)
  SELECT array_agg(id) INTO v_all_graph_ids
  FROM knowledge_graphs
  WHERE (id = ANY(p_graph_ids) OR (parent_graph_id = ANY(p_graph_ids) AND is_branch = true));

  -- Delete study_cards associated with graph_nodes in these graphs
  DELETE FROM study_cards
  WHERE graph_id = ANY(v_all_graph_ids);

  GET DIAGNOSTICS v_deleted_cards = ROW_COUNT;

  -- Delete edges for these graphs
  DELETE FROM edges
  WHERE graph_id = ANY(v_all_graph_ids);

  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;

  -- Delete graph_nodes for these graphs
  DELETE FROM graph_nodes
  WHERE graph_id = ANY(v_all_graph_ids);

  GET DIAGNOSTICS v_deleted_nodes = ROW_COUNT;

  -- Delete the graphs themselves
  DELETE FROM knowledge_graphs
  WHERE id = ANY(v_all_graph_ids);

  GET DIAGNOSTICS v_deleted_graphs = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_graphs', v_deleted_graphs,
    'deleted_nodes', v_deleted_nodes,
    'deleted_edges', v_deleted_edges,
    'deleted_cards', v_deleted_cards
  );
END;
$$;

-- ============================================================
-- Knowledge Point & Graph Node Transaction Functions
-- ============================================================

CREATE OR REPLACE FUNCTION create_knowledge_point_with_node(
  p_user_id uuid,
  p_graph_id uuid,
  p_title varchar,
  p_content text DEFAULT '',
  p_x_position float DEFAULT 0,
  p_y_position float DEFAULT 0,
  p_level varchar DEFAULT 'normal',
  p_properties jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_knowledge_point_id uuid;
  v_graph_node_id uuid;
  v_graph_owner_id uuid;
BEGIN
  -- Verify user owns the graph
  SELECT user_id INTO v_graph_owner_id
  FROM knowledge_graphs
  WHERE id = p_graph_id AND deleted_at IS NULL;

  IF v_graph_owner_id IS NULL THEN
    RAISE EXCEPTION 'Graph not found';
  END IF;

  IF v_graph_owner_id != p_user_id THEN
    RAISE EXCEPTION 'User does not own this graph';
  END IF;

  -- Insert knowledge point
  INSERT INTO knowledge_points (title, content, visibility, owner_id, properties)
  VALUES (p_title, p_content, 'private', p_user_id, p_properties)
  RETURNING id INTO v_knowledge_point_id;

  -- Insert graph node
  BEGIN
    INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted)
    VALUES (p_graph_id, v_knowledge_point_id, p_x_position, p_y_position, p_level, true)
    RETURNING id INTO v_graph_node_id;
  EXCEPTION WHEN OTHERS THEN
    -- Roll back the knowledge point insert on failure
    DELETE FROM knowledge_points WHERE id = v_knowledge_point_id;
    RAISE EXCEPTION 'Failed to create graph node: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'knowledge_point_id', v_knowledge_point_id,
    'graph_node_id', v_graph_node_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION remove_node_with_edges(
  p_graph_node_id uuid,
  p_graph_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_knowledge_point_id uuid;
  v_deleted_edges int;
BEGIN
  -- Find the knowledge_point_id from the graph node
  SELECT knowledge_point_id INTO v_knowledge_point_id
  FROM graph_nodes
  WHERE id = p_graph_node_id AND graph_id = p_graph_id AND deleted_at IS NULL;

  IF v_knowledge_point_id IS NULL THEN
    RAISE EXCEPTION 'Graph node not found';
  END IF;

  -- Soft-delete associated edges
  UPDATE edges
  SET deleted_at = NOW()
  WHERE graph_id = p_graph_id
    AND (source_knowledge_point_id = v_knowledge_point_id OR target_knowledge_point_id = v_knowledge_point_id)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;

  -- Soft-delete the graph node
  UPDATE graph_nodes
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_graph_node_id AND graph_id = p_graph_id AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'deleted_edges', v_deleted_edges,
    'success', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION batch_remove_nodes_with_edges(
  p_graph_node_ids uuid[],
  p_graph_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_knowledge_point_ids uuid[];
  v_deleted_nodes int;
  v_deleted_edges int;
BEGIN
  -- Get all knowledge_point_ids for the given graph_node_ids
  SELECT array_agg(knowledge_point_id) INTO v_knowledge_point_ids
  FROM graph_nodes
  WHERE id = ANY(p_graph_node_ids)
    AND graph_id = p_graph_id
    AND deleted_at IS NULL;

  IF v_knowledge_point_ids IS NULL OR array_length(v_knowledge_point_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'deleted_nodes', 0,
      'deleted_edges', 0,
      'success', true
    );
  END IF;

  -- Soft-delete all edges connected to those knowledge_point_ids in the graph
  UPDATE edges
  SET deleted_at = NOW()
  WHERE graph_id = p_graph_id
    AND (source_knowledge_point_id = ANY(v_knowledge_point_ids) OR target_knowledge_point_id = ANY(v_knowledge_point_ids))
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_deleted_edges = ROW_COUNT;

  -- Soft-delete all the specified graph_nodes
  UPDATE graph_nodes
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = ANY(p_graph_node_ids)
    AND graph_id = p_graph_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_deleted_nodes = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_nodes', v_deleted_nodes,
    'deleted_edges', v_deleted_edges,
    'success', true
  );
END;
$$;

-- ============================================================
-- Task Atomic Operations
-- ============================================================

-- Start a task and create an execution record atomically
CREATE OR REPLACE FUNCTION start_task_with_execution(
  p_task_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  task_id uuid,
  task_status text,
  task_queue_level integer,
  execution_id uuid,
  execution_started_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_level integer;
  v_execution_id uuid;
  v_started_at timestamptz;
BEGIN
  -- Update task status
  UPDATE user_tasks
  SET status = 'in_progress',
      updated_at = now()
  WHERE id = p_task_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  RETURNING queue_level INTO v_queue_level;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or already deleted';
  END IF;

  -- Create execution record
  INSERT INTO task_executions (task_id, user_id, started_at, queue_level, status)
  VALUES (p_task_id, p_user_id, now(), v_queue_level, 'in_progress')
  RETURNING id, started_at INTO v_execution_id, v_started_at;

  RETURN QUERY SELECT
    p_task_id AS task_id,
    'in_progress'::text AS task_status,
    v_queue_level AS task_queue_level,
    v_execution_id AS execution_id,
    v_started_at AS execution_started_at;
END;
$$;

-- Complete a task and end its latest execution atomically
CREATE OR REPLACE FUNCTION complete_task_with_execution(
  p_task_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  task_id uuid,
  task_status text,
  execution_id uuid,
  execution_duration integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution_id uuid;
  v_duration integer;
BEGIN
  -- End the latest open execution
  UPDATE task_executions
  SET ended_at = now(),
      duration = EXTRACT(EPOCH FROM (now() - started_at))::integer
  WHERE id = (
    SELECT id FROM task_executions
    WHERE task_id = p_task_id
      AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  )
  RETURNING id, duration INTO v_execution_id, v_duration;

  -- Update task status
  UPDATE user_tasks
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_task_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or already deleted';
  END IF;

  RETURN QUERY SELECT
    p_task_id AS task_id,
    'completed'::text AS task_status,
    v_execution_id AS execution_id,
    COALESCE(v_duration, 0) AS execution_duration;
END;
$$;

-- Reorder tasks in a queue atomically
CREATE OR REPLACE FUNCTION reorder_tasks(
  p_user_id uuid,
  p_queue_level integer,
  p_task_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_task_id uuid;
  v_position integer;
BEGIN
  FOR i IN 1..array_length(p_task_ids, 1) LOOP
    v_task_id := p_task_ids[i];
    v_position := i - 1; -- 0-based position

    UPDATE user_tasks
    SET position = v_position,
        queue_level = p_queue_level,
        updated_at = now()
    WHERE id = v_task_id
      AND user_id = p_user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
