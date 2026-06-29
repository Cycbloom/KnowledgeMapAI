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

-- document_chunks 通过 knowledge_point_id 外键关联 knowledge_points，策略参照 knowledge_points 模式：
-- SELECT: owner_id 匹配 OR visibility='public' OR 在 public graph 内
-- INSERT/UPDATE/DELETE: 仅 owner
CREATE POLICY "Users can view own document_chunks" ON document_chunks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.visibility = 'public'
  )
  OR EXISTS (
    SELECT 1 FROM knowledge_points
    JOIN graph_nodes ON graph_nodes.knowledge_point_id = knowledge_points.id
    JOIN knowledge_graphs ON knowledge_graphs.id = graph_nodes.graph_id
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_graphs.is_public = true
    AND graph_nodes.deleted_at IS NULL
  )
);
CREATE POLICY "Users can insert own document_chunks" ON document_chunks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);
CREATE POLICY "Users can update own document_chunks" ON document_chunks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own document_chunks" ON document_chunks FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);
