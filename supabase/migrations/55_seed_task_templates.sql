-- =====================================================
-- Knowledge Map - [Seed: Task Templates]
-- =====================================================
-- Note: 旧分类 study/work/life/health/custom 已废弃，新分类为
--   knowledge / project / analysis / architecture / topicResearch / creative
-- 详见 src/services/api/taskTemplates.ts 的 TEMPLATE_CATEGORIES。
-- 本文件直接使用新分类以保持与前端展示一致。

INSERT INTO task_templates (name, description, category, title_template, description_template, estimated_duration, tags, priority, is_system, is_default) VALUES
-- knowledge templates
('深度学习', '专注学习新知识', 'knowledge', '学习：{{topic}}', '深入学习 {{topic}}，理解核心概念和应用场景', 45, ARRAY['学习', '专注'], 3, TRUE, TRUE),
('复习巩固', '复习已学内容', 'knowledge', '复习：{{topic}}', '复习 {{topic}}，巩固知识点，查漏补缺', 25, ARRAY['学习', '复习'], 2, TRUE, FALSE),
('阅读笔记', '阅读并做笔记', 'knowledge', '阅读：{{book_name}}', '阅读 {{book_name}}，记录要点和心得', 30, ARRAY['学习', '阅读'], 2, TRUE, FALSE),
('练习题', '做练习题巩固知识', 'knowledge', '练习：{{subject}}', '完成 {{subject}} 相关练习题', 40, ARRAY['学习', '练习'], 2, TRUE, FALSE),

-- project templates
('项目开发', '开发项目任务', 'project', '开发：{{feature}}', '开发 {{feature}} 功能，包括设计、编码和测试', 60, ARRAY['工作', '开发'], 3, TRUE, TRUE),
('会议准备', '准备会议材料', 'project', '准备会议：{{meeting_name}}', '准备 {{meeting_name}} 会议材料和演示文稿', 30, ARRAY['工作', '会议'], 2, TRUE, FALSE),
('代码审查', '审查代码', 'project', '代码审查：{{project}}', '审查 {{project}} 项目代码，检查代码质量和规范', 45, ARRAY['工作', '代码'], 2, TRUE, FALSE),
('文档编写', '编写文档', 'project', '文档：{{doc_name}}', '编写 {{doc_name}} 相关文档', 40, ARRAY['工作', '文档'], 2, TRUE, FALSE),
('邮件处理', '处理邮件', 'project', '处理邮件', '检查和回复重要邮件', 15, ARRAY['工作', '邮件'], 1, TRUE, FALSE),

-- creative templates (生活类任务)
('购物清单', '采购物品', 'creative', '购物：{{items}}', '购买 {{items}}', 30, ARRAY['生活', '购物'], 1, TRUE, TRUE),
('家务整理', '整理家务', 'creative', '家务：{{task}}', '完成 {{task}} 家务整理', 30, ARRAY['生活', '家务'], 1, TRUE, FALSE),
('账单支付', '支付账单', 'creative', '支付账单', '处理各类账单支付', 15, ARRAY['生活', '财务'], 2, TRUE, FALSE),

-- creative templates (健康类任务)
('运动健身', '锻炼身体', 'creative', '运动：{{type}}', '进行 {{type}} 运动，保持身体健康', 45, ARRAY['健康', '运动'], 2, TRUE, TRUE),
('冥想放松', '冥想放松身心', 'creative', '冥想放松', '进行冥想练习，放松身心', 15, ARRAY['健康', '冥想'], 1, TRUE, FALSE),
('健康检查', '健康相关事项', 'creative', '健康：{{item}}', '处理 {{item}} 健康相关事项', 30, ARRAY['健康'], 2, TRUE, FALSE)
ON CONFLICT DO NOTHING;
