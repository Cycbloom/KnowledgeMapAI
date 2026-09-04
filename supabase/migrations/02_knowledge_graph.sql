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
  parent_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL,
  is_branch BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  embedding vector(1024),
  sparse_embedding sparsevec(1000000),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  template_type VARCHAR(64),
  tags TEXT[] DEFAULT '{}'
);

COMMENT ON TABLE knowledge_graphs IS '知识图谱主表，存储图谱的基本信息和配置';
COMMENT ON COLUMN knowledge_graphs.user_id IS '图谱所有者，引用 auth.users(id)';
COMMENT ON COLUMN knowledge_graphs.domain IS 'The domain/field this graph belongs to, used for star map visualization';
COMMENT ON COLUMN knowledge_graphs.is_public IS '是否公开，公开图谱对所有用户可见';
COMMENT ON COLUMN knowledge_graphs.is_favorite IS '是否收藏';
COMMENT ON COLUMN knowledge_graphs.parent_graph_id IS '父图谱ID，用于子图谱关系';
COMMENT ON COLUMN knowledge_graphs.is_branch IS '是否为分支图谱';
COMMENT ON COLUMN knowledge_graphs.last_used_at IS '最后使用时间，用于排序';
COMMENT ON COLUMN knowledge_graphs.embedding IS '图谱嵌入向量，用于语义搜索';
COMMENT ON COLUMN knowledge_graphs.sparse_embedding IS '图谱稀疏向量（SPLADE 风格，总维度 1000000），用于关键词/术语精确匹配检索';
COMMENT ON COLUMN knowledge_graphs.deleted_at IS '软删除时间，非null表示已删除';
COMMENT ON COLUMN knowledge_graphs.template_type IS '图谱模板类型，如 topic_research, knowledge_tree 等';
COMMENT ON COLUMN knowledge_graphs.tags IS '图谱级标签，用于 Dashboard 筛选与管理';

-- =====================================================
-- Knowledge Graph Contents (1:1 子表)
-- 存储内容性字段，避免列表查询拉取大字段
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_graph_contents (
  graph_id UUID PRIMARY KEY REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  podcast_script TEXT,
  reference_books JSONB DEFAULT '[]'::jsonb,
  external_links JSONB DEFAULT '[]'::jsonb,
  learning_guide TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_graph_contents IS '知识图谱内容子表（1:1），存储大字段以避免列表查询拉取';
COMMENT ON COLUMN knowledge_graph_contents.graph_id IS '关联的图谱ID（主键 + 外键）';
COMMENT ON COLUMN knowledge_graph_contents.podcast_script IS '播客脚本内容';
COMMENT ON COLUMN knowledge_graph_contents.reference_books IS '参考书籍列表，结构: [{"title": "书籍标题", "author": "作者", "isbn": "ISBN号", "description": "简介", "url": "链接"}]';
COMMENT ON COLUMN knowledge_graph_contents.external_links IS '外部链接列表，结构: [{"title": "链接标题", "url": "链接地址", "type": "article|video|course|tool|other", "description": "简介"}]';
COMMENT ON COLUMN knowledge_graph_contents.learning_guide IS '学习指南/建议，支持 Markdown 格式';
COMMENT ON COLUMN knowledge_graph_contents.updated_at IS '最后更新时间';
