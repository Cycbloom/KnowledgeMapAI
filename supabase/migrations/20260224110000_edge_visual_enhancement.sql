-- =====================================================
-- Edge Visual Enhancement Migration
-- 为边可视化增强功能添加数据库支持
-- =====================================================

-- 1. 为 edges 表添加新字段
ALTER TABLE edges
  ADD COLUMN IF NOT EXISTS custom_label text,
  ADD COLUMN IF NOT EXISTS custom_color text,
  ADD COLUMN IF NOT EXISTS custom_line_style text DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS show_arrow boolean;

-- 添加字段注释
COMMENT ON COLUMN edges.custom_label IS '自定义标签，覆盖默认的 relationship_type 显示';
COMMENT ON COLUMN edges.custom_color IS '自定义颜色，覆盖关系类型默认颜色';
COMMENT ON COLUMN edges.custom_line_style IS '线型：solid, dashed, dotted, double';
COMMENT ON COLUMN edges.show_arrow IS '是否显示箭头，null表示根据关系类型自动判断';

-- 添加约束检查线型值
ALTER TABLE edges
  ADD CONSTRAINT chk_line_style
  CHECK (custom_line_style IS NULL OR custom_line_style IN ('solid', 'dashed', 'dotted', 'double'));

-- 2. 创建关系类型配置表
CREATE TABLE IF NOT EXISTS relationship_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  color text NOT NULL DEFAULT '#6B7280',
  line_style text NOT NULL DEFAULT 'solid',
  show_arrow text NOT NULL DEFAULT 'auto',
  is_builtin boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_relationship_line_style CHECK (line_style IN ('solid', 'dashed', 'dotted', 'double')),
  CONSTRAINT chk_show_arrow CHECK (show_arrow IN ('true', 'false', 'auto'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_relationship_types_category ON relationship_types(category);
CREATE INDEX IF NOT EXISTS idx_relationship_types_user ON relationship_types(user_id);

-- 添加表和字段注释
COMMENT ON TABLE relationship_types IS '关系类型配置表，存储预设和用户自定义的关系类型';
COMMENT ON COLUMN relationship_types.name IS '关系类型名称，用于程序标识';
COMMENT ON COLUMN relationship_types.display_name IS '显示名称，用于UI展示';
COMMENT ON COLUMN relationship_types.category IS '分类：hierarchical, dependency, semantic, temporal, interaction, causal, custom';
COMMENT ON COLUMN relationship_types.color IS '默认颜色，十六进制格式';
COMMENT ON COLUMN relationship_types.line_style IS '默认线型';
COMMENT ON COLUMN relationship_types.show_arrow IS '箭头显示：true, false, auto';
COMMENT ON COLUMN relationship_types.is_builtin IS '是否为内置预设类型';
COMMENT ON COLUMN relationship_types.user_id IS '创建用户ID，内置类型为null';

-- 3. 插入预设关系类型数据

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

-- 4. 配置 RLS 策略
ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;

-- 所有人可以查看内置关系类型
CREATE POLICY "Anyone can view builtin relationship types" ON relationship_types
  FOR SELECT USING (is_builtin = true);

-- 用户可以查看自己创建的关系类型
CREATE POLICY "Users can view own relationship types" ON relationship_types
  FOR SELECT USING (user_id = auth.uid());

-- 用户可以创建自己的关系类型
CREATE POLICY "Users can insert own relationship types" ON relationship_types
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 用户可以更新自己的关系类型
CREATE POLICY "Users can update own relationship types" ON relationship_types
  FOR UPDATE USING (user_id = auth.uid() AND is_builtin = false);

-- 用户可以删除自己的关系类型（不能删除内置类型）
CREATE POLICY "Users can delete own relationship types" ON relationship_types
  FOR DELETE USING (user_id = auth.uid() AND is_builtin = false);

-- 5. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_relationship_types_updated_at
  BEFORE UPDATE ON relationship_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
