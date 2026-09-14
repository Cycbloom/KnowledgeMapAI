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
      "instruction": "先用一个具体的现实问题、场景或简短故事切入，点出该主题为什么值得学、学了能解决什么（2-3句）；随后给出一句话的\"是什么\"定位——本主题属于哪个更大范畴、与相邻概念的关系；最后用一两句预告本教材将回答的核心问题。避免以\"什么是XX\"这样笼统开头，或堆砌背景套话。",
      "order": 1,
      "min_words": 80,
      "max_words": 200
    },
    {
      "id": "sec_core",
      "title": "核心概念 (Deep Dive)",
      "instruction": "对每个重要概念依次完成：①一句话的精确定义；②一个贴近日常的类比或直觉解释（降低理解门槛）；③该概念的适用边界/前置假设/常见例外；④与其他概念的区分。专业术语用加粗标注。避免只堆名词解释、不建立概念间的联系，也避免为了易懂而牺牲准确性。",
      "order": 2,
      "min_words": 200,
      "max_words": 500
    },
    {
      "id": "sec_mechanism",
      "title": "关键机制/工作原理",
      "instruction": "详细说明工作原理/运行逻辑：若为过程类，给出分步骤流程（每步一句说清楚行为+原因）；若为原理类，解释\"为什么\"（驱动机制/因果链）而非只列现象。配必要且完整的示意/伪代码或公式（必须用 LaTeX 包裹）。明确每步的输入与产出，以及常见失败点或边界条件。避免只罗列步骤不加解释，避免跳步。",
      "order": 3,
      "min_words": 200,
      "max_words": 400
    },
    {
      "id": "sec_examples",
      "title": "实例分析",
      "instruction": "提供2-3个具体、可验的真实应用案例或历史背景，每个案例说明：它解决什么问题、该主题在其中扮演的角色、效果/意义。每个案例后加一句点评归纳要点。优先选读者熟悉或典型的例子；若该主题较新、缺乏公开案例，则明确标注\"（此处为示意）\"，切勿虚构事实或数据。避免只讲案例、不谈原理在其中如何体现。",
      "order": 4,
      "min_words": 150,
      "max_words": 300
    },
    {
      "id": "sec_summary",
      "title": "总结回顾",
      "instruction": "提炼整章的关键要点，用要点列表列出3-7个核心 takeaways，每条必须具体且能被本章正文支撑（不得引入正文未出现的新概念）。末句给出一条可执行的后续学习方向建议。避免\"总之很重要\"式的空泛收尾。",
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
      "instruction": "用最简练的语言回答三个问题：①这是什么（一句话精确定位）；②用来解决什么问题（给出1个具体痛点场景）；③适合谁学、需要哪些前置知识。全节限定2-4句话，避免术语堆砌与背景套话。",
      "order": 1,
      "min_words": 40,
      "max_words": 100
    },
    {
      "id": "sec_terms",
      "title": "关键术语速查",
      "instruction": "列出5-8个必须先掌握的术语，每个用\"**加粗术语**：一句话解释\"格式。解释要具体（含义+一句使用场景），避免只给词典式定义；若存在易混术语，在其旁用一句点明区别。",
      "order": 2,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_hands_on",
      "title": "动手试一试",
      "instruction": "设计一个5分钟内可完成的小练习/思考实验，包含：①具体操作步骤（分步骤、可执行）；②预期观察或结果；③一句话解释\"为什么会有这个结果\"。练习须在本主题范围内、无需额外工具或成本即可完成。",
      "order": 3,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_next",
      "title": "深入学习建议",
      "instruction": "给出3条明确、可执行的后续路径建议（如读哪类资料/做哪个练习/关注哪个相关主题），每条附一句话说明\"为什么这步重要或能获得什么\"，并按难度或顺序排列。避免\"可进一步了解\"式的空泛建议。",
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
      "instruction": "列出3-6个高频考点，按重要性排序并用★标注（★越多越重要）。每个考点用一句话说明\"考什么+常见考法\"（如选择/填空/简答）。只列本章确会覆盖的内容，避免虚构\"必考\"。",
      "order": 1,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_highlights",
      "title": "重点精讲",
      "instruction": "针对最核心的3-5个考点展开：每个考点给出①关键公式/定理（必须用 LaTeX 包裹）与适用范围/前提条件；②解题套路或通用处理步骤；③常见\"坑\"（易错处/陷阱选项依据）。内容须精确，不引入正文没有的结论。",
      "order": 2,
      "min_words": 250,
      "max_words": 500
    },
    {
      "id": "sec_confusion",
      "title": "易混淆点辨析",
      "instruction": "列举2-4组经典易混概念，用对比表格或并列条目清晰呈现\"区别点+联系\"。每组附一个易记的口诀或区分技巧。对比维度须一致（如同从定义、用法、结果三方面），避免只罗列碎片化、不对齐的信息。",
      "order": 3,
      "min_words": 120,
      "max_words": 300
    },
    {
      "id": "sec_examples",
      "title": "典型例题解析",
      "instruction": "给出2-3道贴合考点的典型题（先列题目），每题给出：①思路切入点（看到这题先想什么）；②完整解答步骤；③易错点与避坑技巧。计算类题目须给出中间步骤，便于读者对照复核；解答须自洽。",
      "order": 4,
      "min_words": 150,
      "max_words": 400
    },
    {
      "id": "sec_quiz",
      "title": "自测清单",
      "instruction": "列出5-10条自测问题（不给答案），问题须覆盖记忆/理解/应用三个层次，并顺序由浅入深。每条须能仅凭本章内容作答、可自评，避免开放式到无法判断。可在开头用一句话提示\"答不出哪些就回看对应考点\"。",
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
      "instruction": "交代该主题所处的学术/工业领域背景，明确交代：①该主题针对什么问题；②既有方案/现状的不足或空白；③由此引出本研究/该主题的动机与要回答的问题。陈述背景事实时只写确定内容，不确定的年份/数据标注\"（需核实）\"。",
      "order": 1,
      "min_words": 150,
      "max_words": 300
    },
    {
      "id": "sec_contribution",
      "title": "核心贡献/创新点",
      "instruction": "提炼3-5个核心贡献/创新点，逐条说明\"做到什么+相比以往好在哪+意义\"。每条须有据可依（来自上下文/正文），避免\"意义重大\"式的空泛表述。",
      "order": 2,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_methodology",
      "title": "方法论详解",
      "instruction": "系统阐述核心方法的设计思想与实现细节：①直观思想（为什么这样设计）；②关键步骤/算法（伪代码或流程）；③公式/定理（必须用 LaTeX 包裹）与符号约定；④参数/超参数含义。避免只给结论不给推理，公式须符号自洽。",
      "order": 3,
      "min_words": 300,
      "max_words": 600
    },
    {
      "id": "sec_experiments",
      "title": "实验与验证",
      "instruction": "描述验证过程：①所用数据集/实验设置；②对比基线；③评价指标及定义；④主要结果与一句客观分析（是好是坏、为什么）。涉及具体数值时，以占位\"[数值，需核实]\"或真实上下文中的数字为准，不虚构结果。",
      "order": 4,
      "min_words": 200,
      "max_words": 400
    },
    {
      "id": "sec_limitations",
      "title": "局限性与未来方向",
      "instruction": "分别指出：①已知局限（哪类场景下效果受限）；②适用边界（什么条件下才成立）；③2-3个值得探索的未来方向。语气客观、不回避短板，避免\"无明显不足\"式的敷衍。",
      "order": 5,
      "min_words": 100,
      "max_words": 250
    },
    {
      "id": "sec_references",
      "title": "延伸阅读推荐",
      "instruction": "推荐5-8条延伸阅读（经典论文/书籍章节/可信博客），格式为\"标题（来源）+ 一句话说明其独到价值\"。仅推荐确定存在的资料；无法确认具体篇目时以\"《标题（需核实）》\"标注，不要编造。",
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
