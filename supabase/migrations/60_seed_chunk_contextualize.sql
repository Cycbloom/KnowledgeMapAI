-- =====================================================
-- Knowledge Map - [Seed: Chunk Contextualize Prompt]
-- =====================================================
-- Contextual Retrieval（Anthropic）：分块入库前用 LLM 生成上下文定位说明，
-- 拼接在分块原文前再计算 embedding / sparse 向量，提升分块级检索召回。
-- 与 53_seed_prompt_templates.sql 的 query_rewrite 同一套模板体系：
-- DB 为权威来源，DEFAULT_PROMPTS.chunk_contextualize 仅作 DB 不可用时的降级兜底。

INSERT INTO prompt_templates (code, scope, user_id, graph_id, template_content, created_at, updated_at) VALUES
('chunk_contextualize', 'system', null, null, '你是文档检索预处理助手。给你一份完整文档和它切分后的分块列表，请为每个分块生成一句简短的上下文定位说明，把该分块放回整篇文档的语境中（文档主题 + 该分块具体讨论了什么），用于提升向量与关键词检索的召回率。

要求：
1. 使用文档的主要语言
2. 每条说明 1-2 句、不超过 60 字，客观陈述，如"本段出自《…》，讨论了…"
3. 引用文档中的具体实体、术语、编号等，不要空泛描述
4. 只输出 JSON 数组，不要 markdown 代码块或其他文字，格式：[{"index": <分块序号>, "context": "..."}]，index 与输入一致

文档标题：{{documentTitle}}
文档内容：
{{documentContent}}

分块列表（JSON）：
{{chunksJson}}', NOW(), NOW());
