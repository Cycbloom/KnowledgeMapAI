-- =====================================================
-- Knowledge Map - Graph Structure
-- =====================================================

CREATE TABLE IF NOT EXISTS graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  knowledge_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  x_position FLOAT DEFAULT 0,
  y_position FLOAT DEFAULT 0,
  level VARCHAR(20) DEFAULT 'normal' CHECK (level IN ('root', 'core', 'sub', 'normal', 'leaf')),
  is_accepted BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, knowledge_point_id)
);

COMMENT ON TABLE graph_nodes IS '图谱与知识点的关联表，存储图谱特定的属性';
COMMENT ON COLUMN graph_nodes.x_position IS '知识点在图谱中的X坐标';
COMMENT ON COLUMN graph_nodes.y_position IS '知识点在图谱中的Y坐标';
COMMENT ON COLUMN graph_nodes.level IS '知识点在图谱中的层级：root(根), core(核心), sub(子), normal(普通), leaf(叶子)';
COMMENT ON COLUMN graph_nodes.is_accepted IS '是否已接受（AI生成的节点需用户确认）';
COMMENT ON COLUMN graph_nodes.deleted_at IS '软删除时间，非null表示已删除';

CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
  target_knowledge_point_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'contains',
  weight INTEGER DEFAULT 1,
  custom_label TEXT,
  custom_color TEXT,
  custom_line_style TEXT DEFAULT 'solid',
  show_arrow BOOLEAN,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type),
  CONSTRAINT chk_line_style CHECK (custom_line_style IS NULL OR custom_line_style IN ('solid', 'dashed', 'dotted', 'double'))
);

COMMENT ON TABLE edges IS '知识图谱边表，存储知识点之间的关系';
COMMENT ON COLUMN edges.relationship_type IS '关系类型名称，关联 relationship_types 表';
COMMENT ON COLUMN edges.weight IS '关系权重';
COMMENT ON COLUMN edges.custom_label IS '自定义标签，覆盖默认的 relationship_type 显示';
COMMENT ON COLUMN edges.custom_color IS '自定义颜色，覆盖关系类型默认颜色';
COMMENT ON COLUMN edges.custom_line_style IS '线型：solid, dashed, dotted, double';
COMMENT ON COLUMN edges.show_arrow IS '是否显示箭头，null表示根据关系类型自动判断';
COMMENT ON COLUMN edges.deleted_at IS '软删除时间，非null表示已删除';




CREATE TABLE IF NOT EXISTS relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  color TEXT NOT NULL DEFAULT '#6B7280',
  line_style TEXT NOT NULL DEFAULT 'solid',
  show_arrow TEXT NOT NULL DEFAULT 'auto',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_relationship_line_style CHECK (line_style IN ('solid', 'dashed', 'dotted', 'double')),
  CONSTRAINT chk_show_arrow CHECK (show_arrow IN ('true', 'false', 'auto'))
);

COMMENT ON TABLE relationship_types IS '关系类型配置表，存储预设和用户自定义的关系类型';
COMMENT ON COLUMN relationship_types.name IS '关系类型名称，用于程序标识';
COMMENT ON COLUMN relationship_types.display_name IS '显示名称，用于UI展示';
COMMENT ON COLUMN relationship_types.category IS '分类：hierarchical, dependency, semantic, temporal, interaction, causal, custom';
COMMENT ON COLUMN relationship_types.color IS '默认颜色，十六进制格式';
COMMENT ON COLUMN relationship_types.line_style IS '默认线型';
COMMENT ON COLUMN relationship_types.show_arrow IS '箭头显示：true, false, auto';
COMMENT ON COLUMN relationship_types.is_builtin IS '是否为内置预设类型';
COMMENT ON COLUMN relationship_types.user_id IS '创建用户ID，引用 auth.users(id)，内置类型为null';