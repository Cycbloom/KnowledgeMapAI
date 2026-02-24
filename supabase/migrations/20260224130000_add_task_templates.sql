-- =====================================================
-- Task Templates System
-- Created: 2026-02-24
-- =====================================================

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  title_template TEXT NOT NULL,
  description_template TEXT,
  estimated_duration INTEGER DEFAULT 25,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 2,
  is_default BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE task_templates IS 'Task templates for quick task creation';
COMMENT ON COLUMN task_templates.category IS 'Template category: study, work, life, health, custom';
COMMENT ON COLUMN task_templates.title_template IS 'Template for task title, supports placeholders like {{topic}}';
COMMENT ON COLUMN task_templates.description_template IS 'Template for task description';
COMMENT ON COLUMN task_templates.is_default IS 'Whether this is a default template for the category';
COMMENT ON COLUMN task_templates.is_system IS 'Whether this is a system preset template';
COMMENT ON COLUMN task_templates.usage_count IS 'Number of times this template has been used';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);
CREATE INDEX IF NOT EXISTS idx_task_templates_system ON task_templates(is_system) WHERE is_system = TRUE;
CREATE INDEX IF NOT EXISTS idx_task_templates_user_category ON task_templates(user_id, category) WHERE user_id IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task templates" 
  ON task_templates FOR SELECT 
  USING (auth.uid() = user_id OR is_system = TRUE);

CREATE POLICY "Users can insert own task templates" 
  ON task_templates FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR is_system = TRUE);

CREATE POLICY "Users can update own task templates" 
  ON task_templates FOR UPDATE 
  USING (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can delete own task templates" 
  ON task_templates FOR DELETE 
  USING (auth.uid() = user_id AND is_system = FALSE);

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_task_templates_updated_at();

-- =====================================================
-- SYSTEM PRESET TEMPLATES
-- =====================================================

INSERT INTO task_templates (name, description, category, title_template, description_template, estimated_duration, tags, priority, is_system, is_default) VALUES
-- Study templates
('深度学习', '专注学习新知识', 'study', '学习：{{topic}}', '深入学习 {{topic}}，理解核心概念和应用场景', 45, ARRAY['学习', '专注'], 3, TRUE, TRUE),
('复习巩固', '复习已学内容', 'study', '复习：{{topic}}', '复习 {{topic}}，巩固知识点，查漏补缺', 25, ARRAY['学习', '复习'], 2, TRUE, FALSE),
('阅读笔记', '阅读并做笔记', 'study', '阅读：{{book_name}}', '阅读 {{book_name}}，记录要点和心得', 30, ARRAY['学习', '阅读'], 2, TRUE, FALSE),
('练习题', '做练习题巩固知识', 'study', '练习：{{subject}}', '完成 {{subject}} 相关练习题', 40, ARRAY['学习', '练习'], 2, TRUE, FALSE),

-- Work templates
('项目开发', '开发项目任务', 'work', '开发：{{feature}}', '开发 {{feature}} 功能，包括设计、编码和测试', 60, ARRAY['工作', '开发'], 3, TRUE, TRUE),
('会议准备', '准备会议材料', 'work', '准备会议：{{meeting_name}}', '准备 {{meeting_name}} 会议材料和演示文稿', 30, ARRAY['工作', '会议'], 2, TRUE, FALSE),
('代码审查', '审查代码', 'work', '代码审查：{{project}}', '审查 {{project}} 项目代码，检查代码质量和规范', 45, ARRAY['工作', '代码'], 2, TRUE, FALSE),
('文档编写', '编写文档', 'work', '文档：{{doc_name}}', '编写 {{doc_name}} 相关文档', 40, ARRAY['工作', '文档'], 2, TRUE, FALSE),
('邮件处理', '处理邮件', 'work', '处理邮件', '检查和回复重要邮件', 15, ARRAY['工作', '邮件'], 1, TRUE, FALSE),

-- Life templates
('购物清单', '采购物品', 'life', '购物：{{items}}', '购买 {{items}}', 30, ARRAY['生活', '购物'], 1, TRUE, TRUE),
('家务整理', '整理家务', 'life', '家务：{{task}}', '完成 {{task}} 家务整理', 30, ARRAY['生活', '家务'], 1, TRUE, FALSE),
('账单支付', '支付账单', 'life', '支付账单', '处理各类账单支付', 15, ARRAY['生活', '财务'], 2, TRUE, FALSE),

-- Health templates
('运动健身', '锻炼身体', 'health', '运动：{{type}}', '进行 {{type}} 运动，保持身体健康', 45, ARRAY['健康', '运动'], 2, TRUE, TRUE),
('冥想放松', '冥想放松身心', 'health', '冥想放松', '进行冥想练习，放松身心', 15, ARRAY['健康', '冥想'], 1, TRUE, FALSE),
('健康检查', '健康相关事项', 'health', '健康：{{item}}', '处理 {{item}} 健康相关事项', 30, ARRAY['健康'], 2, TRUE, FALSE);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT ALL PRIVILEGES ON task_templates TO authenticated;
GRANT SELECT ON task_templates TO anon;
