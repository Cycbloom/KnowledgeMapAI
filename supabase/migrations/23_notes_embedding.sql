-- =====================================================
-- Knowledge Map - Note Embeddings
-- 块编辑器 + Daily Notes P1 (AI 上下文参与 / 语义检索)
--
-- 注意:
--   1. 应用本 schema 需运行: npx supabase db reset
--   2. schema 应用后需运行: npm run db:gen-types 重新生成
--      shared/types/database.generated.ts (新增 note_embeddings 的
--      Row/Insert/Update 类型)
--   3. 简化方案: 单笔记单 embedding (note_id UNIQUE),不分块,
--      refreshEmbedding 用 UPSERT 简单处理
--   4. embedding 维度 1024, 与 document_chunks.embedding 保持一致,
--      复用同一套 embedding 模型 (text-embedding 系列)
--   5. 索引采用 hnsw + vector_cosine_ops, 与 document_chunks 索引风格一致
--      (注: tasks.md 提到 ivfflat, 但 document_chunks.sql 实际使用 hnsw,
--       此处为与现有 schema 真正一致, 同样使用 hnsw)
--   6. embedding 生成由 service 层 (notesService.refreshEmbedding) 异步调用
--      embeddingOps.generateEmbedding 完成, 触发器不可行
--      (pgvector 不能直接调用外部 embedding API)
-- =====================================================

-- =====================================================
-- match_notes 检索函数、RLS、索引、触发器分别归拢至 31_functions.sql /
-- 30_rls_policies.sql / 29_indexes.sql / 32_triggers.sql

-- 1. note_embeddings 表
-- =====================================================
CREATE TABLE IF NOT EXISTS note_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL,
  sparse_embedding sparsevec(1000000),
  chunk_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(note_id)
);

COMMENT ON TABLE note_embeddings IS '笔记 embedding 表，用于笔记内容语义检索（单笔记单 embedding）';
COMMENT ON COLUMN note_embeddings.note_id IS '笔记 ID，引用 notes(id)，删除笔记时级联删除';
COMMENT ON COLUMN note_embeddings.embedding IS '笔记内容向量嵌入，维度 1024，与 document_chunks 一致';
COMMENT ON COLUMN note_embeddings.chunk_text IS '笔记正文快照（截断前 N 字符），用于检索结果摘要展示';
COMMENT ON COLUMN note_embeddings.sparse_embedding IS '笔记内容的稀疏向量（SPLADE 风格，总维度 1000000），用于关键词/术语精确匹配检索';
COMMENT ON COLUMN note_embeddings.created_at IS '首次生成 embedding 的时间';
COMMENT ON COLUMN note_embeddings.updated_at IS '最近一次刷新 embedding 的时间';
