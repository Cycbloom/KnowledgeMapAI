-- =====================================================
-- Knowledge Map - [Seed: AI Actions v2]
-- 新增系统级 AI 动作：标题润色 / 分支总结
-- =====================================================

-- 标题润色：只更新节点 title（update_node 模式）
INSERT INTO ai_actions (name, description, icon, target_mode, scope, prompt_template, variables) VALUES
  ('标题润色', '将节点标题改写得更精炼、规范、易于理解', 'Type', 'update_node', 'system',
   '请将以下节点标题改写得更精炼、规范、易于理解。要求：
1. 保留核心概念，去掉冗余修饰词
2. 长度控制在 2-15 个字，专业术语可适当放宽
3. 不要改变原意，不要添加新内容
4. 只返回 JSON 格式：{"title": "改写后的标题"}

当前标题：
{{nodeTitle}}

当前内容（供理解上下文）：
{{nodeContent}}',
   '{"includeParent": true}'),
  ('分支总结', '总结该节点及其子节点的核心内容，生成结构化摘要', 'ListTree', 'show_result', 'system',
   '请总结以下知识节点及其全部子节点的核心内容，生成一份结构化摘要。要求：
1. 用 Markdown 格式输出
2. 先给出 2-3 句总览，再分点列出关键知识点
3. 突出概念之间的关系和层次
4. 控制在 300 字以内

节点标题：{{nodeTitle}}
节点内容：{{nodeContent}}

子节点列表：
{{children}}',
   '{"includeChildren": true}')
ON CONFLICT DO NOTHING;
