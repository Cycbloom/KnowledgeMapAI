-- Add embedding column to knowledge_graphs for topic similarity detection
ALTER TABLE knowledge_graphs 
ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_graphs_embedding_idx 
ON knowledge_graphs 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to search similar graphs by topic embedding
CREATE OR REPLACE FUNCTION search_similar_graphs(
  p_query_embedding vector(1024),
  p_user_id UUID,
  p_match_threshold FLOAT DEFAULT 0.85,
  p_match_count INT DEFAULT 10,
  p_exclude_graph_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
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

-- Function to check if a topic is duplicate
CREATE OR REPLACE FUNCTION check_duplicate_graph_topic(
  p_topic VARCHAR(255),
  p_user_id UUID,
  p_threshold FLOAT DEFAULT 0.85,
  p_exclude_graph_id UUID DEFAULT NULL
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  similar_graph_id UUID,
  similar_graph_title VARCHAR(255),
  similarity FLOAT
) AS $$
DECLARE
  v_embedding vector(1024);
  v_similar record;
BEGIN
  -- Generate embedding for the topic (this needs to be done in application layer)
  -- This function is a placeholder for the check logic
  -- The actual embedding generation happens in the service layer
  
  RETURN QUERY
  SELECT 
    FALSE as is_duplicate,
    NULL::UUID as similar_graph_id,
    NULL::VARCHAR(255) as similar_graph_title,
    0.0::FLOAT as similarity;
END;
$$ LANGUAGE plpgsql STABLE;
