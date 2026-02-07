-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('learning', 'story', 'project', 'analysis', 'custom')),
  is_system BOOLEAN DEFAULT false,
  nodes JSONB NOT NULL,
  edges JSONB DEFAULT '[]',
  layout JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);

GRANT SELECT ON templates TO anon;
GRANT ALL PRIVILEGES ON templates TO authenticated;

-- Insert preset templates
INSERT INTO templates (id, user_id, name, description, category, is_system, nodes, edges, layout) VALUES
  (gen_random_uuid(), NULL, '概念学习', '适用于学习新概念，从定义到应用的完整学习路径', 'learning', true, 
   $$[
     {"id": "node-1", "title": "主题", "level": "root", "aiPrompt": "请详细解释 {主题} 的核心概念，包括定义、起源和重要性"},
     {"id": "node-2", "title": "定义", "level": "core", "parentId": "node-1", "aiPrompt": "请提供 {主题} 的准确定义，并解释其关键要素"},
     {"id": "node-3", "title": "特点", "level": "core", "parentId": "node-1", "aiPrompt": "请列出 {主题} 的主要特点和特征"},
     {"id": "node-4", "title": "示例", "level": "sub", "parentId": "node-2", "aiPrompt": "请为 {主题} 提供 3-5 个具体的实际应用示例"},
     {"id": "node-5", "title": "应用", "level": "sub", "parentId": "node-3", "aiPrompt": "请说明 {主题} 在实际场景中的应用方法和技巧"}
   ]$$,
   $$[
     {"source": "node-1", "target": "node-2"},
     {"source": "node-1", "target": "node-3"},
     {"source": "node-2", "target": "node-4"},
     {"source": "node-3", "target": "node-5"}
   ]$$,
   NULL),

  (gen_random_uuid(), NULL, '问题解决', '系统化的问题分析到解决方案的完整流程', 'learning', true,
   $$[
     {"id": "node-1", "title": "问题", "level": "root", "aiPrompt": "请详细描述 {问题}，包括背景和影响范围"},
     {"id": "node-2", "title": "原因分析", "level": "core", "parentId": "node-1", "aiPrompt": "请分析 {问题} 的根本原因，使用 5Why 分析法或鱼骨图"},
     {"id": "node-3", "title": "解决方案", "level": "core", "parentId": "node-1", "aiPrompt": "请为 {问题} 提出多个可行的解决方案，并比较其优缺点"},
     {"id": "node-4", "title": "实施步骤", "level": "sub", "parentId": "node-3", "aiPrompt": "请详细列出实施解决方案的具体步骤和时间节点"},
     {"id": "node-5", "title": "预期效果", "level": "sub", "parentId": "node-3", "aiPrompt": "请说明实施解决方案后的预期效果和评估指标"}
   ]$$,
   $$[
     {"source": "node-1", "target": "node-2"},
     {"source": "node-1", "target": "node-3"},
     {"source": "node-3", "target": "node-4"},
     {"source": "node-3", "target": "node-5"}
   ]$$,
   NULL),

  (gen_random_uuid(), NULL, '编程学习', '编程语言和技术的系统化学习路径', 'learning', true,
   $$[
     {"id": "node-1", "title": "主题", "level": "root", "aiPrompt": "请介绍 {主题} 的基本概念、历史背景和应用领域"},
     {"id": "node-2", "title": "核心概念", "level": "core", "parentId": "node-1", "aiPrompt": "请详细解释 {主题} 的核心概念和关键术语"},
     {"id": "node-3", "title": "语法规则", "level": "core", "parentId": "node-1", "aiPrompt": "请列出 {主题} 的主要语法规则和使用规范"},
     {"id": "node-4", "title": "代码示例", "level": "sub", "parentId": "node-2", "aiPrompt": "请为 {主题} 提供 3-5 个完整的代码示例，并添加详细注释"},
     {"id": "node-5", "title": "常见错误", "level": "sub", "parentId": "node-3", "aiPrompt": "请列出 {主题} 学习中常见的错误和调试技巧"},
     {"id": "node-6", "title": "最佳实践", "level": "sub", "parentId": "node-2", "aiPrompt": "请提供 {主题} 的最佳实践和性能优化建议"}
   ]$$,
   $$[
     {"source": "node-1", "target": "node-2"},
     {"source": "node-1", "target": "node-3"},
     {"source": "node-2", "target": "node-4"},
     {"source": "node-3", "target": "node-6"}
   ]$$,
   NULL),

  (gen_random_uuid(), NULL, '历史学习', '历史事件的系统化学习框架', 'learning', true,
   $$[
     {"id": "node-1", "title": "事件", "level": "root", "aiPrompt": "请详细描述 {事件} 的背景、时间和地点"},
     {"id": "node-2", "title": "经过", "level": "core", "parentId": "node-1", "aiPrompt": "请按时间顺序详细描述 {事件} 的发展过程和关键转折点"},
     {"id": "node-3", "title": "影响", "level": "core", "parentId": "node-1", "aiPrompt": "请分析 {事件} 对当时和后世的影响，包括政治、经济、社会等方面"},
     {"id": "node-4", "title": "关键人物", "level": "sub", "parentId": "node-2", "aiPrompt": "请列出 {事件} 中的关键人物及其作用"},
     {"id": "node-5", "title": "相关事件", "level": "sub", "parentId": "node-3", "aiPrompt": "请列出与 {事件} 相关的前因后果事件"}
   ]$$,
   $$[
     {"source": "node-1", "target": "node-2"},
     {"source": "node-1", "target": "node-3"},
     {"source": "node-2", "target": "node-4"},
     {"source": "node-3", "target": "node-5"}
   ]$$,
   NULL),

  (gen_random_uuid(), NULL, '科学实验', '科学实验的完整记录和分析框架', 'learning', true,
   $$[
     {"id": "node-1", "title": "实验目的", "level": "root", "aiPrompt": "请明确说明 {实验} 的目的和预期结果"},
     {"id": "node-2", "title": "假设", "level": "core", "parentId": "node-1", "aiPrompt": "请根据实验目的提出科学假设"},
     {"id": "node-3", "title": "材料", "level": "core", "parentId": "node-1", "aiPrompt": "请列出 {实验} 所需的材料、设备和试剂"},
     {"id": "node-4", "title": "步骤", "level": "sub", "parentId": "node-2", "aiPrompt": "请详细描述 {实验} 的操作步骤，包括注意事项"},
     {"id": "node-5", "title": "结果", "level": "sub", "parentId": "node-3", "aiPrompt": "请记录 {实验} 的观察结果和数据"},
     {"id": "node-6", "title": "结论", "level": "sub", "parentId": "node-5", "aiPrompt": "请分析 {实验} 结果，验证假设并得出结论"}
   ]$$,
   $$[
     {"source": "node-1", "target": "node-2"},
     {"source": "node-1", "target": "node-3"},
     {"source": "node-2", "target": "node-4"},
     {"source": "node-3", "target": "node-5"},
     {"source": "node-5", "target": "node-6"}
   ]$$,
   NULL),

  (gen_random_uuid(), NULL, '四象限分析', '适用于SWOT分析、优先级管理等四象限分析', 'analysis', true,
   $$[
     {"id": "node-1", "title": "主题", "level": "root", "aiPrompt": "请说明 {主题} 的分析目的和背景"},
     {"id": "node-2", "title": "第一象限", "level": "core", "parentId": "node-1", "position_zone": "q1", "aiPrompt": "请分析第一象限的内容，包括特点和应对策略"},
     {"id": "node-3", "title": "第二象限", "level": "core", "parentId": "node-1", "position_zone": "q2", "aiPrompt": "请分析第二象限的内容，包括特点和应对策略"},
     {"id": "node-4", "title": "第三象限", "level": "core", "parentId": "node-1", "position_zone": "q3", "aiPrompt": "请分析第三象限的内容，包括特点和应对策略"},
     {"id": "node-5", "title": "第四象限", "level": "core", "parentId": "node-1", "position_zone": "q4", "aiPrompt": "请分析第四象限的内容，包括特点和应对策略"}
   ]$$,
   $$[
     {"source": "node-1", "target": "node-2"},
     {"source": "node-1", "target": "node-3"},
     {"source": "node-1", "target": "node-4"},
     {"source": "node-1", "target": "node-5"}
   ]$$,
   $${
     "type": "quadrant",
     "showAxes": true,
     "showLabels": true,
     "axes": {
       "x": {"label": "重要性", "min": 0, "max": 100},
       "y": {"label": "紧急性", "min": 0, "max": 100}
     },
     "zones": [
       {
         "id": "q1",
         "label": "重要且紧急",
         "bounds": {"x": 50, "y": 0, "width": 50, "height": 50},
         "color": "rgba(239, 68, 68, 0.1)"
       },
       {
         "id": "q2",
         "label": "重要不紧急",
         "bounds": {"x": 50, "y": 50, "width": 50, "height": 50},
         "color": "rgba(59, 130, 246, 0.1)"
       },
       {
         "id": "q3",
         "label": "不重要紧急",
         "bounds": {"x": 0, "y": 0, "width": 50, "height": 50},
         "color": "rgba(249, 115, 22, 0.1)"
       },
       {
         "id": "q4",
         "label": "不重要不紧急",
         "bounds": {"x": 0, "y": 50, "width": 50, "height": 50},
         "color": "rgba(107, 114, 128, 0.1)"
       }
     ]
   }$$);

-- RLS Policies for templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view templates" 
  ON templates FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can create custom templates" 
  ON templates FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" 
  ON templates FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" 
  ON templates FOR DELETE 
  USING (auth.uid() = user_id OR is_system = false);