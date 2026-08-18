-- =====================================================
-- Knowledge Map - Learning Material Chapter Schemas
-- =====================================================
-- 允许用户自由组合学习材料的章节结构，替代直接编辑完整 prompt 文本
-- 支持 system / user / graph 三级作用域，优先级与 prompt_templates 一致

CREATE TABLE IF NOT EXISTS learning_material_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope prompt_scope NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lms_user_id_check CHECK (
    (scope = 'system' AND user_id IS NULL) OR
    (scope IN ('user', 'graph') AND user_id IS NOT NULL)
  ),
  CONSTRAINT lms_graph_id_check CHECK (
    (scope IN ('system', 'user') AND graph_id IS NULL) OR
    (scope = 'graph' AND graph_id IS NOT NULL)
  )
);

COMMENT ON TABLE learning_material_schemas IS '学习材料章节结构配置，支持用户可视化自由组合章节';
COMMENT ON COLUMN learning_material_schemas.sections IS '章节数组 JSON: [{id, title, instruction, order, min_words?, max_words?}]';
COMMENT ON COLUMN learning_material_schemas.scope IS '作用域：system(系统预设) / user(用户自定义) / graph(图谱专属)';

-- 索引：加速按 (scope, user_id, graph_id) 查询
CREATE INDEX IF NOT EXISTS idx_lms_scope_user_graph
  ON learning_material_schemas(scope, user_id, graph_id);

-- 索引：每个用户/图谱只能有一个 is_default=true
CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_user_default_unique
  ON learning_material_schemas(user_id)
  WHERE scope = 'user' AND is_default = true AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_graph_default_unique
  ON learning_material_schemas(graph_id)
  WHERE scope = 'graph' AND is_default = true AND graph_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_system_default_unique
  ON learning_material_schemas(scope)
  WHERE scope = 'system' AND is_default = true;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE learning_material_schemas ENABLE ROW LEVEL SECURITY;

-- System schemas: 所有登录用户可见
CREATE POLICY "System learning schemas are viewable by everyone"
  ON learning_material_schemas FOR SELECT
  USING (scope = 'system');

-- Graph-level schemas: 对应图谱内用户可见（图谱所有权在 service 层校验）
CREATE POLICY "Users can view graph-level learning schemas"
  ON learning_material_schemas FOR SELECT
  USING (scope = 'graph' AND auth.uid() = user_id);

-- User-level schemas: 只有拥有者可见
CREATE POLICY "Users can view their own learning schemas"
  ON learning_material_schemas FOR SELECT
  USING (scope = 'user' AND auth.uid() = user_id);

-- User/Graph schema 写入: 只有拥有者
CREATE POLICY "Users can insert their own learning schemas"
  ON learning_material_schemas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning schemas"
  ON learning_material_schemas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning schemas"
  ON learning_material_schemas FOR DELETE
  USING (auth.uid() = user_id);
