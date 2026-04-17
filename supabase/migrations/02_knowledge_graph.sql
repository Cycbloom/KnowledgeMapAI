-- =====================================================
-- Knowledge Map - Knowledge Graphs
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  description TEXT,
  domain VARCHAR(255),
  settings JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  podcast_script TEXT,
  parent_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  embedding vector(1024),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reference_books JSONB DEFAULT '[]'::jsonb,
  external_links JSONB DEFAULT '[]'::jsonb,
  learning_guide TEXT
);

COMMENT ON TABLE knowledge_graphs IS '知识图谱主表，存储图谱的基本信息和配置';
COMMENT ON COLUMN knowledge_graphs.user_id IS '图谱所有者，引用 auth.users(id)';
COMMENT ON COLUMN knowledge_graphs.domain IS 'The domain/field this graph belongs to, used for star map visualization';
COMMENT ON COLUMN knowledge_graphs.reference_books IS '参考书籍列表，结构: [{"title": "书籍标题", "author": "作者", "isbn": "ISBN号", "description": "简介", "url": "链接"}]';
COMMENT ON COLUMN knowledge_graphs.external_links IS '外部链接列表，结构: [{"title": "链接标题", "url": "链接地址", "type": "article|video|course|tool|other", "description": "简介"}]';
COMMENT ON COLUMN knowledge_graphs.learning_guide IS '学习指南/建议，支持 Markdown 格式';
COMMENT ON COLUMN knowledge_graphs.is_public IS '是否公开，公开图谱对所有用户可见';
COMMENT ON COLUMN knowledge_graphs.is_favorite IS '是否收藏';
COMMENT ON COLUMN knowledge_graphs.podcast_script IS '播客脚本内容';
COMMENT ON COLUMN knowledge_graphs.parent_graph_id IS '父图谱ID，用于子图谱关系';
COMMENT ON COLUMN knowledge_graphs.last_used_at IS '最后使用时间，用于排序';
COMMENT ON COLUMN knowledge_graphs.embedding IS '图谱嵌入向量，用于语义搜索';
COMMENT ON COLUMN knowledge_graphs.deleted_at IS '软删除时间，非null表示已删除';
