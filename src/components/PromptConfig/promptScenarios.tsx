import { FileText, BrainCircuit, BookOpen, GraduationCap, Network, GitBranch, Route, AlertTriangle, LayoutTemplate } from 'lucide-react';

export interface PromptScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  variables: string[];
  defaultTemplate: string;
  category: 'creation' | 'generation' | 'analysis';
  supportsThreeTier?: boolean;
}

export const PROMPT_SCENARIOS: PromptScenario[] = [
  {
    id: 'learning_material',
    name: '学习资料生成',
    description: '生成学习教材时的提示词模板',
    icon: <GraduationCap size={20} />,
    variables: ['topic', 'context', 'level'],
    defaultTemplate: `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

Target Audience: University students or professionals learning this concept.

Structure:
1. **Introduction (Hook)**: Briefly explain what this is and why it matters.
2. **Core Concepts (Deep Dive)**: Explain the theoretical foundations. Use analogies.
3. **Key Mechanisms/Details**: Technical details, 'how it works', or step-by-step logic.
4. **Real-world Examples**: Concrete use cases or historical context.
5. **Summary**: Key takeaways.

Formatting:
- Use Markdown headers (##, ###).
- Use bolding for key terms.
- **IMPORTANT**: Wrap ALL mathematical formulas in LaTeX: $inline$ or $$block$$.
- Use lists and bullet points for readability.
- Length: Comprehensive (approx 800-1500 words).

Topic: {{topic}}
Context/Background: {{context}}
{{#if level}}Knowledge Level: {{level}}{{/if}}`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'graph_creation',
    name: '图谱创建',
    description: '创建新知识图谱时的AI生成提示词',
    icon: <BookOpen size={20} />,
    variables: ['graphTitle', 'description', 'relatedGraph', 'relationType'],
    defaultTemplate: `请根据以下信息创建知识图谱：

图谱标题：{{graphTitle}}
描述：{{description}}
{{#if relatedGraph}}
关联图谱：{{relatedGraph}}
关系类型：{{relationType}}
{{/if}}

请生成该知识图谱的初始知识点结构，包括：
1. 核心概念（3-5个）
2. 每个概念的简要说明
3. 概念之间的关系

要求：
- 内容准确、专业
- 结构清晰、层次分明
- 适合学习者理解`,
    category: 'creation',
  },
  {
    id: 'quiz_generation',
    name: '测验生成',
    description: 'AI生成测验题目时的提示词',
    icon: <BrainCircuit size={20} />,
    variables: [
      'quizTitle',
      'knowledgePoints',
      'difficulty',
      'questionTypes',
      'cardsPerType',
    ],
    defaultTemplate: `请根据以下知识点生成测验题目：

测验标题：{{quizTitle}}
知识点：{{knowledgePoints}}
难度：{{difficulty}}
题型配置：{{questionTypes}}
每类题目数量：{{cardsPerType}}

请按照以下要求生成题目：
1. 题目内容准确，符合知识点
2. 难度适中，符合设定的难度级别
3. 题目表述清晰，无歧义
4. 选择题选项具有迷惑性但不刁钻
5. 问答题答案完整、准确

注意：
- 确保题目覆盖所有选定的知识点
- 避免重复或相似的题目
- 题目应具有实际应用价值`,
    category: 'generation',
  },
  {
    id: 'content_expansion',
    name: '内容扩充',
    description: '扩充知识点内容时的提示词',
    icon: <FileText size={20} />,
    variables: ['nodeTitle', 'nodeContent', 'parentContext', 'childContext'],
    defaultTemplate: `请扩充以下知识点的内容：

标题：{{nodeTitle}}
当前内容：{{nodeContent}}
{{#if parentContext}}
上级知识点：{{parentContext}}
{{/if}}
{{#if childContext}}
下级知识点：{{childContext}}
{{/if}}

请从以下方面扩充内容：
1. 概念定义的完善
2. 核心要点的提炼
3. 实际应用案例
4. 常见误区说明
5. 学习建议

要求：
- 内容专业、准确
- 语言简洁明了
- 适合学习者理解`,
    category: 'generation',
  },
  {
    id: 'relation_discovery',
    name: '关系发现分析',
    description: '发现图谱间潜在关联关系的AI提示词',
    icon: <Network size={20} />,
    variables: ['graphs', 'existing_relations', 'concepts', 'max_suggestions'],
    defaultTemplate: `分析以下知识图谱，发现它们之间潜在的关联关系。

图谱列表：
{{#each graphs}}
- {{this.title}}: {{this.description}}
{{/each}}

已存在的关系：
{{#each existing_relations}}
- {{this.source}} -> {{this.target}}: {{this.type}}
{{/each}}

核心概念：
{{#each concepts}}
- {{this}}
{{/each}}

请分析并发现新的潜在关系，返回JSON格式：
{
  "discovered_relations": [
    {
      "source_graph_id": "图谱ID",
      "target_graph_id": "图谱ID",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "confidence": 0.0-1.0,
      "reason": "关系原因说明",
      "shared_concepts": ["共享概念"]
    }
  ]
}`,
    category: 'analysis',
    supportsThreeTier: true,
  },
  {
    id: 'cross_domain_insights',
    name: '跨学科洞察',
    description: '分析跨领域知识交叉点的AI提示词',
    icon: <GitBranch size={20} />,
    variables: ['graphs', 'domains', 'concepts', 'min_intersection'],
    defaultTemplate: `分析以下知识图谱，发现跨学科的洞察和交叉点。

图谱列表：
{{#each graphs}}
- {{this.title}} (领域: {{this.domain}}): {{this.description}}
{{/each}}

领域分布：
{{#each domains}}
- {{this.name}}: {{this.count}} 个图谱
{{/each}}

核心概念：
{{#each concepts}}
- {{this}}
{{/each}}

请分析并发现跨学科洞察，返回JSON格式：
{
  "cross_domain_insights": [
    {
      "domains": ["领域1", "领域2"],
      "intersection_topics": ["交叉主题"],
      "insight": "洞察描述",
      "related_graphs": ["图谱ID"],
      "potential_connections": "潜在连接说明"
    }
  ],
  "domain_distribution": {"领域": 数量}
}`,
    category: 'analysis',
    supportsThreeTier: true,
  },
  {
    id: 'learning_path_suggestions',
    name: '学习路径建议',
    description: '推荐最优学习顺序的AI提示词',
    icon: <Route size={20} />,
    variables: ['graphs', 'relations', 'difficulty', 'user_level'],
    defaultTemplate: `基于以下知识图谱和关系，推荐最优的学习路径。

图谱列表：
{{#each graphs}}
- {{this.title}} (难度: {{this.difficulty}}): {{this.description}}
{{/each}}

图谱关系：
{{#each relations}}
- {{this.source}} -> {{this.target}} ({{this.type}})
{{/each}}

目标难度：{{difficulty}}
用户水平：{{user_level}}

请生成学习路径建议，返回JSON格式：
{
  "learning_path_suggestions": [
    {
      "path": ["图谱ID1", "图谱ID2", "..."],
      "path_titles": ["标题1", "标题2", "..."],
      "description": "路径描述",
      "estimated_time": "预计时间",
      "difficulty": "beginner|intermediate|advanced",
      "prerequisites": ["前置知识"]
    }
  ]
}`,
    category: 'analysis',
    supportsThreeTier: true,
  },
  {
    id: 'knowledge_gaps',
    name: '知识缺口分析',
    description: '识别知识体系空白的AI提示词',
    icon: <AlertTriangle size={20} />,
    variables: ['graphs', 'concepts', 'relations', 'min_importance'],
    defaultTemplate: `分析以下知识图谱，识别知识体系中的缺口和空白。

图谱列表：
{{#each graphs}}
- {{this.title}}: {{this.description}}
  概念: {{this.concepts}}
{{/each}}

已有关系：
{{#each relations}}
- {{this.source}} -> {{this.target}}
{{/each}}

请分析并识别知识缺口，返回JSON格式：
{
  "knowledge_gaps": [
    {
      "missing_topic": "缺失主题名称",
      "related_graphs": ["相关图谱ID"],
      "related_graph_titles": ["相关图谱标题"],
      "importance": "high|medium|low",
      "suggested_action": "create|merge|expand",
      "reason": "原因说明",
      "concepts_to_add": ["建议添加的概念"]
    }
  ]
}`,
    category: 'analysis',
    supportsThreeTier: true,
  },
  {
    id: 'template_generation',
    name: '模板生成',
    description: '自定义各模板类型的 AI 生成指导文本',
    icon: <LayoutTemplate size={20} />,
    variables: ['templateType', 'topic'],
    defaultTemplate: `请根据以下信息生成知识图谱模板：

模板类型：{{templateType}}
主题：{{topic}}

请生成该类型的知识图谱结构，包括：
1. 核心节点（3-5个）
2. 每个节点的简要说明
3. 节点之间的关系

要求：
- 内容准确、专业
- 结构清晰、层次分明
- 适合学习者理解`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_knowledge_tree',
    name: '模板: 知识树',
    description: '层级学习，从基础到进阶的知识树模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成知识树结构的知识图谱模板。

知识树特点：层级学习，从基础到进阶

请生成以下结构：
1. 根节点：主题核心概念
2. 核心层：3-5个主要知识分支
3. 扩展层：每个分支的子知识点
4. 细节层：具体实例和应用

要求：
- 层级清晰，由浅入深
- 每个节点内容简洁准确
- 知识点之间逻辑连贯`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_skill_map',
    name: '模板: 技能图谱',
    description: '前置技能关系与学习路径的技能图谱模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成技能图谱结构的知识图谱模板。

技能图谱特点：前置技能关系，学习路径

请生成以下结构：
1. 核心技能：必须掌握的基础技能
2. 前置关系：技能之间的依赖关系
3. 学习路径：推荐的学习顺序
4. 进阶方向：技能的延伸和应用

要求：
- 明确技能间的依赖关系
- 提供合理的学习顺序建议
- 标注关键技能节点`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_concept_network',
    name: '模板: 概念网络',
    description: '概念间关联和交叉的概念网络模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成概念网络结构的知识图谱模板。

概念网络特点：概念间关联和交叉

请生成以下结构：
1. 核心概念：领域内的关键概念
2. 关联关系：概念之间的各种联系
3. 交叉点：多个概念交汇的知识点
4. 边界概念：与其他领域相关的概念

要求：
- 突出概念间的多维度关联
- 标注概念交叉区域
- 体现知识的网络化特征`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_learning_path',
    name: '模板: 学习路径',
    description: '循序渐进的学习步骤模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成学习路径结构的知识图谱模板。

学习路径特点：循序渐进的学习步骤

请生成以下结构：
1. 起步阶段：入门知识和基础概念
2. 进阶阶段：核心技能和深入理解
3. 实践阶段：项目实战和应用练习
4. 精通阶段：高级主题和专业方向

要求：
- 步骤清晰，循序渐进
- 每个阶段有明确的学习目标
- 标注阶段间的过渡条件`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_topic_research',
    name: '模板: 专题研究',
    description: '深度探索某个专题的模板生成提示词，包含六大骨干模块',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成专题研究结构的知识图谱模板。

专题研究特点：深度探索某个专题，采用骨干网络结构

## 骨干网络结构

专题研究模板由根节点和六个核心骨干模块组成：

1. **研究背景**：专题的起源、历史和发展脉络
2. **文献综述**：关键文献、理论和研究现状
3. **研究方法**：常用方法、工具和研究途径
4. **核心概念**：基础概念、定义和理论框架
5. **应用领域**：实际应用场景和案例
6. **未来方向**：发展趋势、挑战和研究机遇

## 节点结构

- **根节点**：研究主题（level: root）
- **核心节点**：六大骨干模块（level: core），标记为待完善状态
- **子节点**：各模块的详细内容（level: sub）- 后续展开

## 边关系

- 根节点连接所有六个核心模块
- 核心模块之间有顺序关系，展示研究流程
- 相关模块之间可以有交叉连接

## 特殊属性

- 每个核心节点有 backboneModule 属性标识模块类型
- 核心节点标记 needsRefinement=true 表示需要用户补充
- 使用径向布局获得最佳可视化效果

要求：
- 初始化时只生成 root 和 core 级别节点
- 所有核心节点标记为待完善状态
- 为每个核心节点分配对应的骨干模块类型
- 使用预定义的模块颜色进行视觉区分`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_project_lifecycle',
    name: '模板: 项目生命周期',
    description: '规划→执行→交付全流程的项目生命周期模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成项目生命周期结构的知识图谱模板。

项目生命周期特点：规划→执行→交付全流程

请生成以下结构：
1. 规划阶段：需求分析、目标设定、资源规划
2. 设计阶段：方案设计、技术选型、风险评估
3. 执行阶段：开发实施、进度管理、质量控制
4. 交付阶段：测试验收、部署上线、文档交付
5. 复盘阶段：项目总结、经验沉淀、改进建议

要求：
- 阶段划分清晰
- 每个阶段包含关键活动和交付物
- 标注阶段间的依赖关系`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_dev_workflow',
    name: '模板: 开发流程',
    description: '需求→设计→开发→测试→部署的开发流程模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成开发流程结构的知识图谱模板。

开发流程特点：需求→设计→开发→测试→部署

请生成以下结构：
1. 需求分析：功能需求、非功能需求、用户故事
2. 系统设计：架构设计、数据库设计、接口设计
3. 编码开发：编码规范、代码审查、版本管理
4. 测试验证：单元测试、集成测试、性能测试
5. 部署运维：部署策略、监控告警、故障处理

要求：
- 流程步骤完整
- 每个环节包含最佳实践
- 标注关键质量门禁`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_task_breakdown',
    name: '模板: 任务分解',
    description: 'WBS 工作分解结构的任务分解模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成任务分解结构的知识图谱模板。

任务分解特点：WBS 工作分解结构

请生成以下结构：
1. 项目总目标：最终交付物和成功标准
2. 一级分解：主要工作包
3. 二级分解：具体任务和活动
4. 三级分解：可执行的工作项

要求：
- 遵循 MECE 原则（相互独立、完全穷尽）
- 每个任务可度量、可分配
- 标注任务间的依赖关系`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_sprint_planning',
    name: '模板: 迭代规划',
    description: 'Sprint 迭代规划的模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成迭代规划结构的知识图谱模板。

迭代规划特点：Sprint 迭代规划

请生成以下结构：
1. 产品待办：需求池和优先级排序
2. Sprint 规划：迭代目标和任务分配
3. 每日站会：进度同步和障碍清除
4. Sprint 评审：成果展示和反馈收集
5. 回顾改进：流程优化和团队提升

要求：
- 迭代周期明确
- 每个迭代有清晰的目标
- 包含持续改进机制`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_root_cause',
    name: '模板: 根因分析',
    description: '5Why/鱼骨图式分析的根因分析模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成根因分析结构的知识图谱模板。

根因分析特点：5Why/鱼骨图式分析

请生成以下结构：
1. 问题描述：现象和影响范围
2. 直接原因：导致问题的表层因素
3. 根本原因：深层次的系统性原因
4. 改进措施：针对根因的解决方案
5. 预防机制：防止问题再次发生的措施

要求：
- 逐层深入，找到根本原因
- 区分症状和原因
- 改进措施可执行、可验证`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_swot',
    name: '模板: SWOT 分析',
    description: '优势/劣势/机会/威胁的 SWOT 分析模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成 SWOT 分析结构的知识图谱模板。

SWOT 分析特点：优势/劣势/机会/威胁

请生成以下结构：
1. 优势 (Strengths)：内部有利因素
2. 劣势 (Weaknesses)：内部不利因素
3. 机会 (Opportunities)：外部有利因素
4. 威胁 (Threats)：外部不利因素
5. 战略组合：SO/WO/ST/WT 策略

要求：
- 内外部因素区分明确
- 分析客观全面
- 战略建议具有可操作性`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_comparison',
    name: '模板: 对比分析',
    description: '多维度对比分析的模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成对比分析结构的知识图谱模板。

对比分析特点：多维度对比分析

请生成以下结构：
1. 对比对象：需要比较的方案/技术/产品
2. 对比维度：功能、性能、成本、生态等
3. 各维度分析：每个维度的详细对比
4. 综合评价：整体优劣势总结
5. 选择建议：基于场景的推荐

要求：
- 对比维度全面客观
- 数据支撑充分
- 结论有理有据`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_decision_tree',
    name: '模板: 决策树',
    description: '条件分支决策的决策树模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成决策树结构的知识图谱模板。

决策树特点：条件分支决策

请生成以下结构：
1. 决策起点：需要做出的核心决策
2. 判断条件：影响决策的关键因素
3. 分支路径：不同条件下的选择
4. 决策结果：每个路径的预期结果
5. 风险评估：各路径的风险和概率

要求：
- 条件判断清晰明确
- 分支覆盖所有可能情况
- 结果可量化评估`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_tech_ecosystem',
    name: '模板: 技术生态',
    description: '技术栈关系和依赖的技术生态模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成技术生态结构的知识图谱模板。

技术生态特点：技术栈关系和依赖

请生成以下结构：
1. 核心技术：生态系统的核心技术
2. 依赖关系：技术间的依赖和兼容性
3. 替代方案：可替换的技术选型
4. 生态工具：配套工具和插件
5. 发展趋势：技术演进方向

要求：
- 技术关系标注清晰
- 包含版本和兼容性信息
- 体现技术选型的权衡`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_org_structure',
    name: '模板: 组织架构',
    description: '层级与职能关系的组织架构模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成组织架构结构的知识图谱模板。

组织架构特点：层级与职能关系

请生成以下结构：
1. 组织层级：从高层到基层的层级划分
2. 职能部门：各部门的职责和范围
3. 汇报关系：上下级汇报线
4. 协作关系：跨部门协作机制
5. 决策流程：关键决策的审批路径

要求：
- 层级关系清晰
- 职责边界明确
- 体现协作和决策流程`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_system_architecture',
    name: '模板: 系统架构',
    description: '模块与依赖关系的系统架构模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成系统架构结构的知识图谱模板。

系统架构特点：模块与依赖关系

请生成以下结构：
1. 系统概览：整体架构风格和设计原则
2. 核心模块：主要功能模块
3. 模块依赖：模块间的调用和依赖关系
4. 数据流：数据在模块间的流转路径
5. 非功能性：性能、安全、可扩展性设计

要求：
- 架构层次分明
- 依赖关系标注清晰
- 包含关键设计决策及理由`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_knowledge_system',
    name: '模板: 知识体系',
    description: '跨领域知识关联的知识体系模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成知识体系结构的知识图谱模板。

知识体系特点：跨领域知识关联

请生成以下结构：
1. 核心领域：主题的核心知识领域
2. 关联领域：与核心领域相关的其他领域
3. 交叉知识：跨领域的共享知识点
4. 知识层次：从基础到应用的知识层级
5. 学习路径：推荐的知识学习顺序

要求：
- 跨领域关联清晰
- 知识层次分明
- 体现知识的系统性`,
    category: 'generation',
    supportsThreeTier: true,
  },
  {
    id: 'template_type_blank',
    name: '模板: 空白图谱',
    description: '自由创建，不使用特定结构的空白图谱模板生成提示词',
    icon: <LayoutTemplate size={20} />,
    variables: ['topic'],
    defaultTemplate: `请为主题 "{{topic}}" 生成空白图谱结构的知识图谱模板。

空白图谱特点：自由创建，不使用特定结构

请生成以下结构：
1. 中心主题：图谱的核心主题
2. 自由分支：根据主题自由发散的知识点
3. 关联连接：知识点之间的自然关联

要求：
- 不限制结构形式
- 鼓励自由发散思维
- 知识点间关联自然`,
    category: 'generation',
    supportsThreeTier: true,
  },
];

export const getScenarioById = (id: string): PromptScenario | undefined => {
  return PROMPT_SCENARIOS.find((s) => s.id === id);
};

export const getScenariosByCategory = (
  category: PromptScenario['category']
): PromptScenario[] => {
  return PROMPT_SCENARIOS.filter((s) => s.category === category);
};
