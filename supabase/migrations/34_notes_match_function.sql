-- =====================================================
-- Knowledge Map - Note Match Function
-- 块编辑器 + Daily Notes P1 (RAG 与搜索扩展纳入笔记)
--
-- 注意:
--   1. 应用本 schema 需运行: npx supabase db reset
--   2. 为 note_embeddings 表新增 match_notes 向量检索函数,
--      风格与 14_functions.sql 中的 match_knowledge_points / match_document_chunks 一致
--   3. 函数仅返回当前用户未软删除笔记的 embedding 命中,
--      RLS 已在 33_notes_embedding.sql 中通过 note_id JOIN notes 验证 user_id,
--      此处再显式过滤 n.user_id = p_user_id AND n.deleted_at IS NULL 做双重保险
--   4. similarity = 1 - (embedding <=> query_embedding),与现有函数一致
-- =====================================================

-- Match notes function for semantic search (笔记内容向量检索)
-- 参数与 match_knowledge_points 对齐: query_embedding / match_threshold / match_count / p_user_id
-- 注意: p_user_id 必须给 DEFAULT NULL（PostgreSQL 要求有默认值的参数之后所有参数也有默认值），
--       调用方 ragSearchService.noteSemanticSearch 已显式传 user_id，不会走到默认值。
CREATE OR REPLACE FUNCTION match_notes (
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  note_id uuid,
  chunk_text text,
  title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ne.id,
    ne.note_id,
    ne.chunk_text,
    n.title,
    1 - (ne.embedding <=> query_embedding) as similarity
  FROM note_embeddings ne
  JOIN notes n ON n.id = ne.note_id
  WHERE n.user_id = p_user_id
    AND n.deleted_at IS NULL
    AND ne.embedding IS NOT NULL
    AND 1 - (ne.embedding <=> query_embedding) > match_threshold
  ORDER BY ne.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_notes IS '笔记内容向量检索函数，按用户隔离，返回未软删除笔记的 embedding 命中（含 chunk_text 摘要与 title）';

-- 授予 authenticated 角色执行权限（与 16_grants.sql 中 match_knowledge_points 风格一致）
GRANT EXECUTE ON FUNCTION match_notes(vector(1024), float, int, uuid) TO authenticated;
