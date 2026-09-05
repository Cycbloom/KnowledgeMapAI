-- =====================================================
-- Knowledge Map - Document Chunks
-- =====================================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  context TEXT,
  embedding vector(1024),
  sparse_embedding sparsevec(1000000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(knowledge_point_id, chunk_index)
);



COMMENT ON TABLE document_chunks IS '文档分块表，将知识点内容拆分为更小的片段用于精确语义检索';
COMMENT ON COLUMN document_chunks.knowledge_point_id IS '所属知识点ID，引用 knowledge_points(id)，级联删除';
COMMENT ON COLUMN document_chunks.chunk_index IS '分块序号，从0开始递增，与 knowledge_point_id 组成唯一约束';
COMMENT ON COLUMN document_chunks.content IS '分块文本内容';
COMMENT ON COLUMN document_chunks.context IS 'Contextual Retrieval：LLM 生成的分块上下文定位说明（1-2 句，基于整篇文档语境）。embedding/sparse_embedding 按 context + content 计算，content 本身保持原文用于展示';
COMMENT ON COLUMN document_chunks.embedding IS '分块文本的向量嵌入，维度1024，输入为 context + content（无 context 时为原文），用于语义相似度检索';
COMMENT ON COLUMN document_chunks.sparse_embedding IS '分块文本的稀疏向量（SPLADE 风格，总维度 1000000），输入与 embedding 一致，用于关键词/术语精确匹配检索';
COMMENT ON COLUMN document_chunks.created_at IS '分块创建时间';
