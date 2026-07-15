-- =====================================================
-- Literature Sources - 文献来源信息表
-- =====================================================

CREATE TABLE IF NOT EXISTS literature_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  authors TEXT[] DEFAULT '{}',
  year INTEGER,
  type VARCHAR(20) DEFAULT 'paper' CHECK (type IN ('paper', 'book', 'article', 'report', 'webpage', 'document')),
  journal VARCHAR(255),
  doi VARCHAR(255),
  url TEXT,
  file_name VARCHAR(255),
  keywords TEXT[] DEFAULT '{}',
  abstract TEXT,
  volume VARCHAR(50),
  issue VARCHAR(50),
  pages VARCHAR(50),
  publisher VARCHAR(255),
  notes TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, title, doi)
);

COMMENT ON TABLE literature_sources IS '文献来源信息表，存储从文献中提取的完整元数据';
COMMENT ON COLUMN literature_sources.graph_id IS '所属图谱ID';
COMMENT ON COLUMN literature_sources.title IS '文献标题';
COMMENT ON COLUMN literature_sources.authors IS '作者列表';
COMMENT ON COLUMN literature_sources.year IS '发表年份';
COMMENT ON COLUMN literature_sources.type IS '文献类型：paper(论文), book(书籍), article(文章), report(报告), webpage(网页), document(文档)';
COMMENT ON COLUMN literature_sources.journal IS '期刊/会议名称';
COMMENT ON COLUMN literature_sources.doi IS '数字对象标识符 (DOI)';
COMMENT ON COLUMN literature_sources.url IS '在线链接地址';
COMMENT ON COLUMN literature_sources.file_name IS '原始文件名';
COMMENT ON COLUMN literature_sources.keywords IS '关键词列表';
COMMENT ON COLUMN literature_sources.abstract IS '摘要';
COMMENT ON COLUMN literature_sources.volume IS '卷号';
COMMENT ON COLUMN literature_sources.issue IS '期号';
COMMENT ON COLUMN literature_sources.pages IS '页码范围';
COMMENT ON COLUMN literature_sources.publisher IS '出版商';
COMMENT ON COLUMN literature_sources.notes IS '备注说明';
COMMENT ON COLUMN literature_sources.processed_at IS '处理/提取时间';
COMMENT ON COLUMN literature_sources.created_at IS '创建时间';
COMMENT ON COLUMN literature_sources.updated_at IS '最后更新时间';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_literature_sources_graph_id ON literature_sources(graph_id);
CREATE INDEX IF NOT EXISTS idx_literature_sources_title ON literature_sources(title);
CREATE INDEX IF NOT EXISTS idx_literature_sources_doi ON literature_sources(doi);
CREATE INDEX IF NOT EXISTS idx_literature_sources_type ON literature_sources(type);
CREATE INDEX IF NOT EXISTS idx_literature_sources_year ON literature_sources(year);

-- RLS Policies
ALTER TABLE literature_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view literature sources for their graphs"
  ON literature_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND (
          knowledge_graphs.user_id = auth.uid()
          OR knowledge_graphs.is_public = true
        )
    )
  );

CREATE POLICY "Users can insert literature sources for their own graphs"
  ON literature_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update literature sources for their own graphs"
  ON literature_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete literature sources for their own graphs"
  ON literature_sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );

-- Auto-update timestamp trigger
DROP TRIGGER IF EXISTS on_update_literature_sources ON literature_sources;
CREATE TRIGGER on_update_literature_sources
  BEFORE UPDATE ON literature_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
