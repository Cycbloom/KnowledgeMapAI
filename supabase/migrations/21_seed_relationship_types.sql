-- =====================================================
-- Knowledge Map - [Seed: Relationship Types]
-- =====================================================

-- 层级结构 (hierarchical)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('contains', '包含', 'hierarchical', '#3B82F6', 'solid', 'auto', true),
  ('part_of', '属于', 'hierarchical', '#3B82F6', 'solid', 'auto', true),
  ('parent_child', '父子', 'hierarchical', '#3B82F6', 'solid', 'auto', true)
ON CONFLICT (name) DO NOTHING;

-- 依赖约束 (dependency)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('depends_on', '依赖', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('prerequisite', '前提', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('constrains', '制约', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('supports', '支撑', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('mutex', '互斥', 'dependency', '#EF4444', 'dotted', 'false', true),
  ('exclusive', '排他', 'dependency', '#EF4444', 'dotted', 'false', true)
ON CONFLICT (name) DO NOTHING;

-- 语义关系 (semantic)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('related', '相关', 'semantic', '#6B7280', 'solid', 'false', true),
  ('similar_to', '相似', 'semantic', '#8B5CF6', 'solid', 'false', true),
  ('opposite', '相反', 'semantic', '#EC4899', 'solid', 'false', true),
  ('synonym', '同义', 'semantic', '#8B5CF6', 'solid', 'false', true),
  ('equivalent', '等价', 'semantic', '#8B5CF6', 'solid', 'false', true),
  ('generalization', '泛化', 'semantic', '#10B981', 'solid', 'true', true),
  ('specialization', '特化', 'semantic', '#10B981', 'solid', 'true', true)
ON CONFLICT (name) DO NOTHING;

-- 时序流程 (temporal)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('follows', '后续', 'temporal', '#06B6D4', 'dashed', 'true', true),
  ('parallel', '并行', 'temporal', '#06B6D4', 'solid', 'false', true),
  ('branch', '分支', 'temporal', '#06B6D4', 'solid', 'true', true),
  ('merge', '汇合', 'temporal', '#06B6D4', 'solid', 'true', true),
  ('trigger', '触发', 'temporal', '#06B6D4', 'dashed', 'true', true),
  ('loop', '循环', 'temporal', '#06B6D4', 'dashed', 'true', true)
ON CONFLICT (name) DO NOTHING;

-- 交互行为 (interaction)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('points_to', '指向', 'interaction', '#F97316', 'solid', 'true', true),
  ('acts_on', '作用', 'interaction', '#F97316', 'solid', 'true', true),
  ('influences', '影响', 'interaction', '#F97316', 'dashed', 'true', true),
  ('feedback', '反馈', 'interaction', '#F97316', 'dashed', 'true', true),
  ('calls', '调用', 'interaction', '#F97316', 'solid', 'true', true)
ON CONFLICT (name) DO NOTHING;

-- 因果推导 (causal)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('causes', '因果', 'causal', '#DC2626', 'solid', 'true', true),
  ('derives', '推导', 'causal', '#DC2626', 'solid', 'true', true),
  ('proportional', '正比', 'causal', '#DC2626', 'solid', 'false', true),
  ('inverse', '反比', 'causal', '#DC2626', 'solid', 'false', true)
ON CONFLICT (name) DO NOTHING;
