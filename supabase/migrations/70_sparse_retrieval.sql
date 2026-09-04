-- =====================================================
-- Knowledge Map - Sparse (Keyword) Retrieval Functions
-- 稀疏向量（SPLADE 风格）检索，作为混合检索的第四条召回通道。
--
-- 背景：
--   现有 keywordSearch 基于 LIKE + pg_trgm 处理关键词匹配，对型号/编号/专业术语
--   的精确匹配能力弱。火山 doubao-embedding-vision 的 sparse_embedding 已在
--   请求中开启，但此前响应只解析了 dense 向量，sparse 被丢弃。
--   本迁移补齐 sparsevec 列（见 02/03/26/33）的检索函数。
--
-- 设计：
--   - sparsevec 用于精确关键词匹配，pgvector 提供 <#>（负内积）距离，
--     similarity = -(<#>) 即向量内积得分。
--   - sparsevec(N) 的 N 是总维度数（最大索引值），此处 1000000 与列声明一致；
--     非零元素数由 pgvector 硬上限 16000 约束，由写入侧 truncate。
--   - 每类数据源一个 RPC，风格与 14_functions.sql 的 match_* 对齐，
--     均显式按用户/公开可见性过滤，避免跨用户泄露。
--   - sparsevec 无 hnsw 近似索引，检索走精确 <#> 排序；单用户数据量下可接受。
-- =====================================================

-- 按图谱过滤的知识点稀疏检索（p_graph_id 为 NULL 时退化为全局，兼容单函数调用）
CREATE OR REPLACE FUNCTION match_knowledge_points_sparse (
  query_sparse sparsevec(1000000),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL,
  p_graph_id uuid DEFAULT NULL
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
  IF p_graph_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      kp.id,
      COALESCE(kp.title->>'zh-CN', ''),
      kp.content->>'zh-CN',
      - (kp.sparse_embedding <#> query_sparse) as similarity
    FROM knowledge_points kp
    JOIN graph_nodes gn ON gn.knowledge_point_id = kp.id
    WHERE gn.graph_id = p_graph_id
      AND gn.deleted_at IS NULL
      AND (kp.visibility = 'public' OR kp.owner_id = p_user_id)
      AND kp.sparse_embedding IS NOT NULL
      AND - (kp.sparse_embedding <#> query_sparse) > match_threshold
    ORDER BY kp.sparse_embedding <#> query_sparse
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      kp.id,
      COALESCE(kp.title->>'zh-CN', ''),
      kp.content->>'zh-CN',
      - (kp.sparse_embedding <#> query_sparse) as similarity
    FROM knowledge_points kp
    WHERE (kp.visibility = 'public' OR (p_user_id IS NOT NULL AND kp.owner_id = p_user_id))
      AND kp.sparse_embedding IS NOT NULL
      AND - (kp.sparse_embedding <#> query_sparse) > match_threshold
    ORDER BY kp.sparse_embedding <#> query_sparse
    LIMIT match_count;
  END IF;
END;
$$;

-- 知识点全局稀疏检索（无图谱过滤）
CREATE OR REPLACE FUNCTION match_knowledge_points_sparse_global (
  query_sparse sparsevec(1000000),
  match_threshold float DEFAULT 0.0,
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
    COALESCE(kp.title->>'zh-CN', ''),
    kp.content->>'zh-CN',
    - (kp.sparse_embedding <#> query_sparse) as similarity
  FROM knowledge_points kp
  WHERE (kp.visibility = 'public' OR (p_user_id IS NOT NULL AND kp.owner_id = p_user_id))
    AND kp.sparse_embedding IS NOT NULL
    AND - (kp.sparse_embedding <#> query_sparse) > match_threshold
  ORDER BY kp.sparse_embedding <#> query_sparse
  LIMIT match_count;
END;
$$;

-- 文档分块稀疏检索（关键词命中子块）
CREATE OR REPLACE FUNCTION match_document_chunks_sparse (
  query_sparse sparsevec(16000),
  match_threshold float DEFAULT 0.0,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL,
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
      - (dc.sparse_embedding <#> query_sparse) as similarity
    FROM document_chunks dc
    JOIN knowledge_points kp ON dc.knowledge_point_id = kp.id
    JOIN graph_nodes gn ON gn.knowledge_point_id = kp.id
    WHERE gn.graph_id = p_graph_id
      AND gn.deleted_at IS NULL
      AND (kp.visibility = 'public' OR kp.owner_id = p_user_id)
      AND dc.sparse_embedding IS NOT NULL
      AND - (dc.sparse_embedding <#> query_sparse) > match_threshold
    ORDER BY dc.sparse_embedding <#> query_sparse
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      dc.id,
      dc.knowledge_point_id,
      dc.chunk_index,
      dc.content,
      - (dc.sparse_embedding <#> query_sparse) as similarity
    FROM document_chunks dc
    JOIN knowledge_points kp ON dc.knowledge_point_id = kp.id
    WHERE (kp.visibility = 'public' OR kp.owner_id = p_user_id)
      AND dc.sparse_embedding IS NOT NULL
      AND - (dc.sparse_embedding <#> query_sparse) > match_threshold
    ORDER BY dc.sparse_embedding <#> query_sparse
    LIMIT match_count;
  END IF;
END;
$$;

-- 笔记稀疏检索（关键词命中笔记摘要）
CREATE OR REPLACE FUNCTION match_notes_sparse (
  query_sparse sparsevec(1000000),
  match_threshold float DEFAULT 0.0,
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
    - (ne.sparse_embedding <#> query_sparse) as similarity
  FROM note_embeddings ne
  JOIN notes n ON n.id = ne.note_id
  WHERE n.user_id = p_user_id
    AND n.deleted_at IS NULL
    AND ne.sparse_embedding IS NOT NULL
    AND - (ne.sparse_embedding <#> query_sparse) > match_threshold
  ORDER BY ne.sparse_embedding <#> query_sparse
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_knowledge_points_sparse(sparsevec, float, int, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_points_sparse_global(sparsevec, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks_sparse(sparsevec, float, int, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_notes_sparse(sparsevec, float, int, uuid) TO authenticated;