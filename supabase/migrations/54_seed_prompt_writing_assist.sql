-- =====================================================
-- Knowledge Map - [Seed: Notes 写作辅助 Prompt]
-- 对应 spec: extend-notes-p2-writing-refresh-search (Task 1)
-- =====================================================
-- 注意：本文件为 seed 数据，需要执行以下命令使其生效：
--   npx supabase db reset
-- （或在新环境中通过 supabase 迁移自动执行）
-- =====================================================

-- 写作辅助三个 Prompt（均 system scope，user_id/graph_id 为 null）
-- 变量占位：{{selectedText}} / {{contextBefore}} / {{contextAfter}}
INSERT INTO prompt_templates (code, scope, user_id, graph_id, template_content, created_at, updated_at) VALUES
('notes_writing_continue', 'system', null, null, '你是写作助手。基于用户选中的文本与上下文，续写后续内容，保持语气风格一致。

任务要求：
1. 紧接选中文本之后继续写作，不要重复选中内容。
2. 严格保持原文的语气、人称、时态与措辞风格。
3. 内容应自然延伸选中文字的逻辑，不要凭空跳转主题。
4. 输出纯文本续写片段（不要包装为 Markdown 代码块，不要附加解释说明）。

选中文字：
{{selectedText}}

前文上下文：
{{contextBefore}}

后文上下文：
{{contextAfter}}

请直接输出续写内容：', NOW(), NOW()),
('notes_writing_rewrite', 'system', null, null, '你是写作助手。改写用户选中的文字，保持原意优化表达。

任务要求：
1. 严格保留原文核心意思，不要增删信息点。
2. 优化表达：使语句更通顺、用词更准确、逻辑更清晰。
3. 保持原文的语气、人称与情感色彩，不要改变风格。
4. 输出纯文本改写片段（不要包装为 Markdown 代码块，不要附加解释说明）。

选中文字：
{{selectedText}}

前文上下文：
{{contextBefore}}

后文上下文：
{{contextAfter}}

请直接输出改写后的内容：', NOW(), NOW()),
('notes_writing_expand', 'system', null, null, '你是写作助手。扩写用户选中的文字，添加细节 / 举例 / 论证。

任务要求：
1. 在保留原文核心意思的基础上进行扩写，不要删减原有信息点。
2. 通过补充细节、举例、对比、论证等方式丰富内容，使表达更具体、更有说服力。
3. 保持原文的语气、人称与逻辑走向，扩写内容应自然衔接上下文。
4. 输出纯文本扩写片段（不要包装为 Markdown 代码块，不要附加解释说明）。

选中文字：
{{selectedText}}

前文上下文：
{{contextBefore}}

后文上下文：
{{contextAfter}}

请直接输出扩写后的内容：', NOW(), NOW());
