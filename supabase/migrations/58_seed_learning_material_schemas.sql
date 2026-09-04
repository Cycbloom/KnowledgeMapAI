-- =====================================================
-- Seed: Learning Material Chapter Schemas (system defaults)
-- =====================================================
-- 插入系统预设的章节配置方案，提供可视化编辑器的默认模板

-- 方案1：标准教材结构（默认，对应现有 learning_material prompt）
INSERT INTO learning_material_schemas (name, description, scope, user_id, graph_id, sections, is_default, created_at, updated_at)
VALUES (
  '标准教材结构',
  '适合大多数概念学习的经典五段式结构：引言 → 核心概念 → 关键机制 → 实例分析 → 总结回顾',
  'system',
  NULL,
  NULL,
  $JSON$
  [
    {
      "id": "sec_intro",
      "title": "引言 (Hook)",
      "instruction": "简要介绍该主题是什么，以及为什么它很重要。用一个有趣的切入点、现实问题或故事来激发读者的学习兴趣。",
      "order": 1,
      "min_words": 80,
      "max_words": 200
    },
    {
      "id": "sec_core",
      "title": "核心概念 (Deep Dive)",
      "instruction": "深入讲解该主题的理论基础和核心概念。对于每个重要概念，给出清晰的定义，并使用通俗易懂的类比帮助读者理解。",
      "order": 2,
      "min_words": 200,
      "max_words": 500
    },
    {
      "id": "sec_mechanism",
      "title": "关键机制/工作原理",
      "instruction": "详细解释该主题的技术细节、工作原理或运行逻辑。如果是过程类主题，给出逐步的操作步骤或逻辑流程。",
      "order": 3,
      "min_words": 200,
      "max_words": 400
    },
    {
      "id": "sec_examples",
      "title": "实例分析",
      "instruction": "提供2-3个具体的真实世界应用案例或历史背景，展示该主题在实际中如何被使用。每个案例后可以加一句点评说明其意义。",
      "order": 4,
      "min_words": 150,
      "max_words": 300
    },
    {
      "id": "sec_summary",
      "title": "总结回顾",
      "instruction": "提炼整章的关键要点，用列表形式列出3-7个核心 takeaways。可以附加一句关于后续学习方向的建议。",
      "order": 5,
      "min_words": 60,
      "max_words": 150
    }
  ]
  $JSON$::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- 方案2：快速入门结构
INSERT INTO learning_material_schemas (name, description, scope, user_id, graph_id, sections, is_default, created_at, updated_at)
VALUES (
  '快速入门结构',
  '适合快速了解一个新概念：快速概览 → 关键术语 → 动手试试 → 下一步',
  'system',
  NULL,
  NULL,
  $JSON$
  [
    {
      "id": "sec_overview",
      "title": "30秒概览",
      "instruction": "用最简练的语言（2-3句话）回答：这是什么？用来解决什么问题？适合谁学习？",
      "order": 1,
      "min_words": 40,
      "max_words": 100
    },
    {
      "id": "sec_terms",
      "title": "关键术语速查",
      "instruction": "列出5-8个理解本主题必须知道的术语，每个术语给出一句话的简明解释。使用加粗术语+冒号+解释的格式。",
      "order": 2,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_hands_on",
      "title": "动手试一试",
      "instruction": "设计一个5分钟内可以完成的小练习或思考实验，让读者边学边实践。给出具体步骤和预期观察结果。",
      "order": 3,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_next",
      "title": "深入学习建议",
      "instruction": "给出3条进一步学习的路径建议：例如阅读什么资料、做什么练习、关注什么相关主题。",
      "order": 4,
      "min_words": 60,
      "max_words": 150
    }
  ]
  $JSON$::jsonb,
  false,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- 方案3：考试复习结构
INSERT INTO learning_material_schemas (name, description, scope, user_id, graph_id, sections, is_default, created_at, updated_at)
VALUES (
  '考试复习结构',
  '适合备考冲刺：考点清单 → 重点精讲 → 易混淆辨析 → 真题/例题 → 自测清单',
  'system',
  NULL,
  NULL,
  $JSON$
  [
    {
      "id": "sec_checklist",
      "title": "考点清单",
      "instruction": "列出本章所有高频考点，按重要性排序（用★标注）。每个考点给出一句话说明考什么、怎么考。",
      "order": 1,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_highlights",
      "title": "重点精讲",
      "instruction": "针对最核心的3-5个考点，展开详细讲解。重点突出公式、定理、适用条件、解题套路。",
      "order": 2,
      "min_words": 250,
      "max_words": 500
    },
    {
      "id": "sec_confusion",
      "title": "易混淆点辨析",
      "instruction": "列举2-4组考生经常混淆的概念，以对比表格或并列方式说明它们的区别和联系。附带记忆口诀或区分技巧。",
      "order": 3,
      "min_words": 120,
      "max_words": 300
    },
    {
      "id": "sec_examples",
      "title": "典型例题解析",
      "instruction": "给出2-3道典型真题/模拟题，先列题目再给出详细解答过程。注意标注思路切入点、易错点和解题技巧。",
      "order": 4,
      "min_words": 150,
      "max_words": 400
    },
    {
      "id": "sec_quiz",
      "title": "自测清单",
      "instruction": "列出5-10条自测问题（不带答案），让读者检验自己是否真正掌握。问题覆盖记忆、理解、应用三个层次。",
      "order": 5,
      "min_words": 80,
      "max_words": 200
    }
  ]
  $JSON$::jsonb,
  false,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- 方案4：深度研究结构
INSERT INTO learning_material_schemas (name, description, scope, user_id, graph_id, sections, is_default, created_at, updated_at)
VALUES (
  '深度研究结构',
  '适合论文研读/专题研究：背景 → 核心贡献 → 方法论 → 实验验证 → 局限性与展望 → 参考资料',
  'system',
  NULL,
  NULL,
  $JSON$
  [
    {
      "id": "sec_background",
      "title": "研究背景与动机",
      "instruction": "交代该主题所处的学术/工业领域背景，指出现有方案存在什么问题，从而引出做这件事的动机。",
      "order": 1,
      "min_words": 150,
      "max_words": 300
    },
    {
      "id": "sec_contribution",
      "title": "核心贡献/创新点",
      "instruction": "提炼该主题的3-5个核心贡献或创新点，用简洁的列表形式呈现并逐一说明其意义。",
      "order": 2,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_methodology",
      "title": "方法论详解",
      "instruction": "系统阐述核心方法/算法/框架的设计思想与实现细节。必要时配合公式或伪代码说明。",
      "order": 3,
      "min_words": 300,
      "max_words": 600
    },
    {
      "id": "sec_experiments",
      "title": "实验与验证",
      "instruction": "描述如何验证该方法的有效性：数据集、对比基线、评价指标、主要结果及结果分析。",
      "order": 4,
      "min_words": 200,
      "max_words": 400
    },
    {
      "id": "sec_limitations",
      "title": "局限性与未来方向",
      "instruction": "诚实地讨论当前方案的已知局限性、适用边界，并指出值得进一步探索的未来研究方向。",
      "order": 5,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_references",
      "title": "延伸阅读推荐",
      "instruction": "推荐5-8篇相关的经典论文、书籍章节或博客文章，每条推荐附上一句话说明为什么值得读。",
      "order": 6,
      "min_words": 80,
      "max_words": 200
    }
  ]
  $JSON$::jsonb,
  false,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
