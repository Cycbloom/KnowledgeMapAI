-- =====================================================
-- Knowledge Map - Knowledge Points
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(512) NOT NULL,
  content TEXT,
  summary VARCHAR(200),
  learning_material TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  properties JSONB DEFAULT '{}',
  embedding vector(1024),
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
COMMENT ON COLUMN knowledge_points.keywords IS '关键词数组，结构: [{"term": "关键词文本", "importance": 5, "category": "定义", "explanation": "简短解释"}]';
COMMENT ON COLUMN knowledge_points.mastery_level IS '知识点掌握度 (0.00-1.00)，用于 SM-2 算法和智能调度';
COMMENT ON COLUMN knowledge_points.last_study_at IS '最后学习时间，用于计算复习间隔';
COMMENT ON COLUMN knowledge_points.total_study_duration IS '累计学习时长（分钟）';
COMMENT ON COLUMN knowledge_points.learning_material IS '学习材料/补充资料';
COMMENT ON COLUMN knowledge_points.properties IS '自定义属性，JSON格式';

CREATE TABLE IF NOT EXISTS knowledge_point_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(512) NOT NULL,
  content TEXT,
  summary VARCHAR(200),
  learning_material TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
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
