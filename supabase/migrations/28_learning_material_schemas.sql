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











