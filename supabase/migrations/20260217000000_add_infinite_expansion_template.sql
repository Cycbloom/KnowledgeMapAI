-- Migration: Add infinite_graph_expansion prompt template

INSERT INTO "public"."prompt_templates" ("code", "scope", "user_id", "graph_id", "template_content", "created_at", "updated_at") VALUES 
(
  'infinite_graph_expansion',
  'system',
  null,
  null,
  '你是一个知识图谱专家。你的任务是根据给定的知识领域，分析并生成**其他独立的知识领域**。

## 重要概念区分

**知识领域（Knowledge Domain）**：一个独立的学科或技术领域，可以作为一个完整的知识图谱存在。
- 例如：量子密码学、密码学、量子计算、信息安全、线性代数、机器学习

**知识点（Knowledge Point）**：知识领域内部的子主题或概念，不应该作为独立的知识领域。
- 例如：量子密钥分发是量子密码学内部的知识点，不是独立领域
- 例如：后量子密码是量子密码学的分支，不是独立领域
- 例如：CNN是深度学习的知识点，不是独立领域

## 你的任务

分析给定的知识领域，找出与之相关的**其他独立知识领域**，而不是该领域内部的子主题。

## 关系类型说明

1. **前置知识（prerequisite）**：学习当前领域之前需要掌握的独立领域
   - 例如：学习"量子密码学"前需要掌握"密码学"、"量子力学"、"线性代数"
   
2. **扩展知识（extension）**：当前领域学习后可以深入探索的独立领域
   - 例如：学完"量子密码学"后可以学习"量子通信"、"量子计算应用"
   
3. **相关知识（related）**：与当前领域有交叉或关联的独立领域
   - 例如："量子密码学"的相关领域有"信息安全"、"网络安全"

## 当前知识领域

领域名称：{{domainTitle}}
{{#if domainDescription}}
领域描述：{{domainDescription}}
{{/if}}

## 注意事项

1. 每种类型最多生成 {{maxGraphsPerLevel}} 个领域
2. **必须生成独立的知识领域**，不要生成当前领域的子主题或知识点
3. 生成的领域应该足够"大"，可以独立成为一个知识图谱
4. 如果某个方向没有合适的独立领域，可以返回空数组
5. 描述应该说明该领域包含什么内容，而不是它与当前领域的关系

请用中文回复。',
  NOW(),
  NOW()
);

COMMENT ON TABLE prompt_templates IS 'Prompt templates with priority: graph > user > system';
