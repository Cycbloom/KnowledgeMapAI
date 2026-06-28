-- =====================================================
-- Knowledge Map - Document Chunks
-- =====================================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(knowledge_point_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_kp_id
  ON document_chunks(knowledge_point_id);

COMMENT ON TABLE document_chunks IS '文档分块表，将知识点内容拆分为更小的片段用于精确语义检索';
COMMENT ON COLUMN document_chunks.knowledge_point_id IS '所属知识点ID，引用 knowledge_points(id)，级联删除';
COMMENT ON COLUMN document_chunks.chunk_index IS '分块序号，从0开始递增，与 knowledge_point_id 组成唯一约束';
COMMENT ON COLUMN document_chunks.content IS '分块文本内容';
COMMENT ON COLUMN document_chunks.embedding IS '分块文本的向量嵌入，维度1024，用于语义相似度检索';
COMMENT ON COLUMN document_chunks.created_at IS '分块创建时间';

-- Enable Row Level Security
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
