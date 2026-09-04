-- =====================================================
-- Knowledge Map - Knowledge Points
-- =====================================================

-- title/content/summary 为按语言 key 的 JSONB（如 {"zh-CN":"标题", "en-US":"Title"}），
-- 与 learning_material/keywords 的多语言约定一致。存量数据迁移到 "zh-CN" key。
CREATE TABLE IF NOT EXISTS knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  content JSONB DEFAULT '{}'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  learning_material JSONB DEFAULT '{}'::jsonb,
  keywords JSONB DEFAULT '{}'::jsonb,
  properties JSONB DEFAULT '{}',
  embedding vector(1024),
  sparse_embedding sparsevec(1000000),
  visibility knowledge_point_visibility DEFAULT 'private',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mastery_level DECIMAL(3,2) DEFAULT 0,
  last_study_at TIMESTAMPTZ,
  total_study_duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_points IS '独立的知识点实体，支持跨图谱复用';
COMMENT ON COLUMN knowledge_points.visibility IS '知识点可见性：private(私有), public(公共), pending(待审核)';
COMMENT ON COLUMN knowledge_points.owner_id IS '知识点所有者，引用 auth.users(id)，私有知识点仅所有者可见';
COMMENT ON COLUMN knowledge_points.keywords IS '按语言 key 的关键词对象，结构: {"zh-CN": [{"term":"关键词", "importance":5, "category":"定义", "explanation":"简短解释"}], "en-US": [...]}';
COMMENT ON COLUMN knowledge_points.mastery_level IS '知识点掌握度 (0.00-1.00)，用于评估知识点掌握程度';
COMMENT ON COLUMN knowledge_points.last_study_at IS '最后学习时间，用于计算复习间隔';
COMMENT ON COLUMN knowledge_points.total_study_duration IS '累计学习时长（分钟）';
COMMENT ON COLUMN knowledge_points.learning_material IS '按语言 key 的学习材料对象，结构: {"zh-CN": "中文材料", "en-US": "English material"}，新增语言只需增加 key';
COMMENT ON COLUMN knowledge_points.properties IS '自定义属性，JSON格式';
COMMENT ON COLUMN knowledge_points.title IS '按语言 key 的标题对象，结构: {"zh-CN":"标题", "en-US":"Title"}，zh-CN 为基础语言';
COMMENT ON COLUMN knowledge_points.content IS '按语言 key 的内容对象，结构同 title';
COMMENT ON COLUMN knowledge_points.sparse_embedding IS '知识点稀疏向量（SPLADE 风格，最多 16000 非零元素），与 embedding 同源生成，用于关键词/术语精确匹配检索';
COMMENT ON COLUMN knowledge_points.summary IS '按语言 key 的摘要对象，结构同 title';

ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source_knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE SET NULL;
COMMENT ON COLUMN knowledge_points.source_knowledge_point_id IS '分支知识点来源ID，记录该知识点是从哪个原始知识点复制而来，仅分支副本有值';

CREATE TABLE IF NOT EXISTS knowledge_point_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title JSONB NOT NULL,
  content JSONB,
  summary JSONB,
  learning_material JSONB DEFAULT '{}'::jsonb,
  keywords JSONB DEFAULT '{}'::jsonb,
  properties JSONB DEFAULT '{}',
  change_summary TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(knowledge_point_id, version_number)
);

COMMENT ON TABLE knowledge_point_versions IS '知识点版本历史表，记录知识点的每次修改';
COMMENT ON COLUMN knowledge_point_versions.version_number IS '版本号，从1开始递增';
COMMENT ON COLUMN knowledge_point_versions.change_summary IS '本次修改的摘要说明';
COMMENT ON COLUMN knowledge_point_versions.changed_by IS '执行修改的用户ID，引用 auth.users(id)';
COMMENT ON COLUMN knowledge_point_versions.learning_material IS '按语言 key 的学习材料快照（版本记录），结构同 knowledge_points.learning_material';
COMMENT ON COLUMN knowledge_point_versions.keywords IS '按语言 key 的关键词快照（版本记录），结构同 knowledge_points.keywords';
