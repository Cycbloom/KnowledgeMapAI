-- =====================================================
-- Knowledge Map - pgvector 向量相似度搜索
-- =====================================================

-- 向量索引 - 使用 IVFFlat 加速近似搜索
-- 注意：IVFFlat 需要先插入足够数据才能创建（至少需要约 1000 个向量），
-- 如果表数据不足，索引创建会成功但查询性能提升不明显
-- 使用 IF NOT EXISTS 避免重复创建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_knowledge_points_embedding_ivfflat'
  ) THEN
    -- 仅在表中有足够数据且 vector 扩展可用时创建
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
      CREATE INDEX idx_knowledge_points_embedding_ivfflat 
      ON knowledge_points 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
      
      RAISE NOTICE 'Created IVFFlat index on knowledge_points.embedding';
    END IF;
  END IF;
END;
$$;