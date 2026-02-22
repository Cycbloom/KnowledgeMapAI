-- Fix match_knowledge_points function return type
DROP FUNCTION IF EXISTS match_knowledge_points(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION match_knowledge_points (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  p_user_id uuid
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
  WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
    AND kp.embedding IS NOT NULL
    AND 1 - (kp.embedding <=> query_embedding) > match_threshold
  ORDER BY kp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
