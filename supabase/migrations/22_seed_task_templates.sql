-- =====================================================
-- Knowledge Map - [Seed: Task Templates]
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
('健康检查', '健康相关事项', 'health', '健康：{{item}}', '处理 {{item}} 健康相关事项', 30, ARRAY['健康'], 2, TRUE, FALSE)
ON CONFLICT DO NOTHING;
