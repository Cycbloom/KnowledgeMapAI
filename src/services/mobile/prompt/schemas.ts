import { GENERATE_CARDS_SCHEMA } from './templates';

export const OUTPUT_SCHEMAS: Record<string, string> = {
  learning_material: `
You must respond with a JSON object containing:
1. 'content': The learning material in Markdown format (as a string)
2. 'keywords': An array of 5-15 keywords extracted from the content

Each keyword object must have:
- 'term': The keyword text (string)
- 'importance': Importance level 1-5 (number, where 5 is most important)
- 'category': Category type - one of: '定义', '概念', '方法', '结论', '原理', '应用', '术语' (string)
- 'explanation': Brief explanation of the keyword (string, max 50 chars)

Please respond in Chinese.`,

  expand_knowledge: `
Return a JSON object with a 'suggestions' array. Each object in the array must have 'title' and 'content' fields.
Example format: { "suggestions": [{ "title": "Example Title", "content": "Example content" }] }
Please respond in Chinese.`,

  auto_graph_init: `
Return a JSON object with the following structure:
{
  "root": {
    "title": "Root Node Title",
    "content": "Comprehensive overview of the topic (100-150 words)"
  },
  "coreNodes": [
    { "title": "Core Node 1", "content": "Description of core concept (80-120 words)" },
    { "title": "Core Node 2", "content": "Description of core concept (80-120 words)" }
  ]
}

Important:
- Generate exactly 1 root node and 3-5 core nodes
- Each node must have title and content
- Respond in Chinese`,

  auto_graph_expand: `
Return a JSON object with the following structure:
{
  "children": [
    { "title": "Child Node 1", "content": "Description (60-100 words)" },
    { "title": "Child Node 2", "content": "Description (60-100 words)" }
  ]
}

Important:
- Generate 3-5 child nodes
- Each node must have title and content
- Respond in Chinese`,

  learning_path_generate: `
Return a JSON object with the following structure:
{
  "path": [
    {
      "nodeTitle": "Node Title",
      "priority": "high|medium|low",
      "reason": "Why this node should be learned at this position",
      "estimatedTime": 15,
      "prerequisites": ["prerequisite-node-title-1", "prerequisite-node-title-2"]
    }
  ],
  "suggestions": [
    "Suggestion 1 for the learner",
    "Suggestion 2 for the learner"
  ]
}

Important:
- **CRITICAL**: You MUST ONLY include nodes that are directly relevant to achieving the target goal. Do NOT include all nodes from the graph.
- Select only the essential learning path - typically 5-15 nodes that form the optimal path to the goal.
- Skip nodes that are not necessary for achieving the goal.
- Order nodes in optimal learning sequence
- nodeTitle must be the exact title from the input nodes (will be matched)
- estimatedTime should be in minutes (5-60)
- priority determines learning importance
- prerequisites should reference node titles from earlier in the path
- Provide 2-4 helpful suggestions
- Respond in Chinese`,

  learning_path_questions: `
Return a JSON object with the following structure:
{
  "suggestedGoals": [
    "Goal 1: Clear, specific learning objective",
    "Goal 2: Another achievable goal",
    "Goal 3: Advanced mastery goal"
  ],
  "prerequisiteQuestions": [
    {
      "topic": "Knowledge area name",
      "description": "Brief description of what this includes",
      "options": ["不了解", "了解一点", "比较熟悉", "非常熟悉"]
    }
  ]
}

Important:
- Generate 3-4 suggested goals with different difficulty levels
- Generate 3-5 prerequisite questions relevant to the topic
- Goals should be specific and motivating
- Questions should identify knowledge that helps learn this topic
- Always use the exact 4 options: 不了解, 了解一点, 比较熟悉, 非常熟悉
- Respond in Chinese`,

  generate_cards: GENERATE_CARDS_SCHEMA,
  generate_cards_qa: GENERATE_CARDS_SCHEMA,
  generate_cards_choice: GENERATE_CARDS_SCHEMA,
  generate_cards_true_false: GENERATE_CARDS_SCHEMA,
  generate_cards_multi_choice: GENERATE_CARDS_SCHEMA,
  generate_cards_fill_blank: GENERATE_CARDS_SCHEMA,
  generate_cards_essay: GENERATE_CARDS_SCHEMA,

  branch_suggestions: `
Return a JSON object with a 'suggestions' array. Each object must have:
- 'id': Unique identifier for this suggestion
- 'title': Brief, catchy title for the branch (max 20 chars)
- 'description': Short description explaining what this branch explores (max 100 chars)
- 'priority': 'high', 'medium', or 'low' based on importance
- 'estimatedDifficulty': Number from 1-5 indicating difficulty
- 'relatedTopics': Array of 2-3 related topic keywords
Example format: { "suggestions": [{ "id": "branch_1", "title": "深入原理", "description": "探索核心原理", "priority": "high", "estimatedDifficulty": 4, "relatedTopics": ["theory", "fundamentals"] }] }
Please respond in Chinese.`,

  text_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship_type": "relationship_type_name" }

Relationship Types (choose the most appropriate one based on the semantic relationship between nodes):

**层级结构 (hierarchical)**:
- contains: A 包含 B（如：章节包含知识点，文献综述包含对比分析）
- parent_child: A 是 B 的父节点（如：研究背景是论文的父级主题）
- part_of: A 是 B 的一部分（如：车轮是汽车的一部分）
- derived_from: A 从 B 派生而来（如：改进方法由基础方法派生）

**依赖约束 (dependency)**:
- depends_on: A 依赖于 B（如：高级功能依赖于基础功能）
- prerequisite: B 是 A 的前置知识（如：学习微积分前需要先学代数）
- constrains: A 制约 B（如：资源限制制约系统设计）
- supports: A 支撑 B（如：理论框架支撑实验设计）
- mutex: A 与 B 互斥（如：两种方案不能同时采用）
- exclusive: A 与 B 排他（如：选择A则排除B）

**语义关系 (semantic)**:
- related: A 与 B 相关（一般性关联）
- similar_to: A 与 B 相似（如：Java 与 C# 语法相似）
- opposite: A 与 B 对立/对比（如：面向对象与面向过程对比）
- synonym: A 是 B 的同义词（如：函数与方法）
- equivalent: A 与 B 等价（如：两种表示方式等价）
- generalization: A 是 B 的泛化（如：动物是猫的泛化）
- specialization: A 是 B 的特化（如：猫是动物的特化）

**时序流程 (temporal)**:
- follows: A 跟随/在 B 之后（如：测试跟随开发）
- parallel: A 与 B 并行进行（如：前端与后端并行开发）
- branch: A 从 B 分支出来（如：分支方案从主路径分出）
- merge: A 与 B 汇合（如：多个分支汇合到主线）
- trigger: A 触发 B（如：事件触发处理流程）
- loop: A 形成循环（如：迭代优化形成循环）

**交互行为 (interaction)**:
- points_to: A 指向 B（如：引用指向被引用内容）
- acts_on: A 作用于 B（如：算法作用于数据集）
- influences: A 影响 B（如：参数影响结果）
- feedback: A 对 B 有反馈（如：输出反馈回输入）
- calls: A 调用 B（如：模块调用服务）

**因果推导 (causal)**:
- causes: A 导致 B（如：错误配置导致系统崩溃）
- derives: A 推导出 B（如：公式推导出结论）
- proportional: A 与 B 成正比（如：输入量与输出量成正比）
- inverse: A 与 B 成反比（如：速度与时间成反比）

Important:
- For parent-child hierarchical relationships, use "contains", "parent_child" or "part_of"
- For knowledge prerequisites, use "prerequisite" or "depends_on"
- For similar concepts, use "similar_to" or "synonym"
- For contrasting/comparing concepts, use "opposite"
- For cause-effect relationships, use "causes" or "derives"
- Choose the most specific relationship type that accurately describes the connection
Please respond in Chinese.`,

  document_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship_type": "relationship_type_name" }

Relationship Types (choose the most appropriate one based on the semantic relationship between nodes):

**层级结构 (hierarchical)**:
- contains: A 包含 B（如：章节包含知识点，文献综述包含对比分析）
- parent_child: A 是 B 的父节点（如：研究背景是论文的父级主题）
- part_of: A 是 B 的一部分（如：车轮是汽车的一部分）
- derived_from: A 从 B 派生而来（如：改进方法由基础方法派生）

**依赖约束 (dependency)**:
- depends_on: A 依赖于 B（如：高级功能依赖于基础功能）
- prerequisite: B 是 A 的前置知识（如：学习微积分前需要先学代数）
- constrains: A 制约 B（如：资源限制制约系统设计）
- supports: A 支撑 B（如：理论框架支撑实验设计）
- mutex: A 与 B 互斥（如：两种方案不能同时采用）
- exclusive: A 与 B 排他（如：选择A则排除B）

**语义关系 (semantic)**:
- related: A 与 B 相关（一般性关联）
- similar_to: A 与 B 相似（如：Java 与 C# 语法相似）
- opposite: A 与 B 对立/对比（如：面向对象与面向过程对比）
- synonym: A 是 B 的同义词（如：函数与方法）
- equivalent: A 与 B 等价（如：两种表示方式等价）
- generalization: A 是 B 的泛化（如：动物是猫的泛化）
- specialization: A 是 B 的特化（如：猫是动物的特化）

**时序流程 (temporal)**:
- follows: A 跟随/在 B 之后（如：测试跟随开发）
- parallel: A 与 B 并行进行（如：前端与后端并行开发）
- branch: A 从 B 分支出来（如：分支方案从主路径分出）
- merge: A 与 B 汇合（如：多个分支汇合到主线）
- trigger: A 触发 B（如：事件触发处理流程）
- loop: A 形成循环（如：迭代优化形成循环）

**交互行为 (interaction)**:
- points_to: A 指向 B（如：引用指向被引用内容）
- acts_on: A 作用于 B（如：算法作用于数据集）
- influences: A 影响 B（如：参数影响结果）
- feedback: A 对 B 有反馈（如：输出反馈回输入）
- calls: A 调用 B（如：模块调用服务）

**因果推导 (causal)**:
- causes: A 导致 B（如：错误配置导致系统崩溃）
- derives: A 推导出 B（如：公式推导出结论）
- proportional: A 与 B 成正比（如：输入量与输出量成正比）
- inverse: A 与 B 成反比（如：速度与时间成反比）

Important:
- For parent-child hierarchical relationships, use "contains", "parent_child" or "part_of"
- For knowledge prerequisites, use "prerequisite" or "depends_on"
- For similar concepts, use "similar_to" or "synonym"
- For contrasting/comparing concepts, use "opposite"
- For cause-effect relationships, use "causes" or "derives"
- Choose the most specific relationship type that accurately describes the connection
Please respond in Chinese.`,

  recommend_connections: `
Return a JSON object with a 'recommendations' array. Each item should have 'node_title' and 'reason'.
Respond in Chinese.`,

  term_annotation: `
Return a JSON array where each object has "term" (the exact text found in the source) and "explanation" (a concise definition under 20 words).
Example format: [{"term": "RAG", "explanation": "检索增强生成，一种结合检索系统和生成模型的技术。"}]
Please respond in Chinese.`,

  infinite_graph_expansion: `
Return a JSON object with the following structure:
{
  "prerequisite": [
    { "title": "领域名称", "description": "该领域的简要描述（说明包含什么内容）", "reason": "为什么是前置知识" }
  ],
  "extension": [
    { "title": "领域名称", "description": "该领域的简要描述（说明包含什么内容）", "reason": "为什么是扩展知识" }
  ],
  "related": [
    { "title": "领域名称", "description": "该领域的简要描述（说明包含什么内容）", "reason": "为什么是相关知识" }
  ]
}

Important:
- Each array can be empty if no suitable domains exist
- title should be a concise domain name (2-10 characters preferred)
- description should explain what the domain contains, NOT its relationship to the current domain
- reason should explain why this domain has this relationship type
- Respond in Chinese`,

  cross_graph_connection_analysis: `
Return a JSON object with the following structure:
{
  "connections": [
    {
      "node1_title": "图谱1中的节点标题",
      "node2_title": "图谱2中的节点标题",
      "connection_type": "same_concept|related_concept|complementary|prerequisite",
      "similarity": 0.85,
      "reason": "为什么这两个节点应该连接（简短说明）"
    }
  ],
  "summary": {
    "total_connections": 5,
    "by_type": {
      "same_concept": 2,
      "related_concept": 2,
      "complementary": 1,
      "prerequisite": 0
    },
    "overall_relationship": "这两个图谱的关系描述"
  }
}

Connection Types:
- same_concept: 两个节点描述的是同一个概念或知识点
- related_concept: 两个节点描述的是相关但不同的概念
- complementary: 两个节点互为补充，可以一起学习
- prerequisite: 一个节点是另一个节点的前置知识

Important:
- Only suggest connections with similarity >= 0.5
- Provide clear reasons in Chinese
- similarity should be between 0 and 1
- Use exact node titles from the input for matching
- Respond in Chinese`,

  generate_task_details: `
Return a JSON object with the following structure:
{
  "description": "任务的详细描述（50-150字，说明任务目标、关键步骤、预期成果）",
  "tags": ["标签1", "标签2", "标签3"],
  "estimated_duration": 30,
  "priority": 2,
  "suggested_queue": 1
}

Field descriptions:
- description: Detailed task description (50-150 characters, explain goals, key steps, expected outcomes)
- tags: Array of 2-5 relevant tags (e.g., 学习, 工作, 阅读, 编程, 复习, 项目, 会议, 运动, 休息)
- estimated_duration: Estimated completion time in minutes (range: 15-180)
- priority: Priority level (1=Low, 2=Medium, 3=High, 4=Urgent)
- suggested_queue: Suggested queue level (0=Urgent queue Q0, 1=Important queue Q1, 2=Normal queue Q2)

Queue determination criteria:
- Q0 (Urgent): Tasks requiring immediate attention, urgent deadlines, high priority
- Q1 (Important): Important but not urgent, requires focused completion
- Q2 (Normal): Regular tasks, can be handled later

Important:
- Respond in Chinese
- Tags should be practical and commonly used
- Duration should be realistic for the task complexity`,

  discover_graph_relations: `
Return a JSON object with the following structure:
{
  "discovered_relations": [
    {
      "source_graph_title": "源图谱标题",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "confidence": 0.85,
      "reason": "为什么这两个图谱应该建立关系",
      "shared_concepts": ["共享概念1", "共享概念2"],
      "suggested_learning_order": "source_first|target_first|parallel"
    }
  ],
  "cross_domain_insights": [
    {
      "domains": ["领域1", "领域2"],
      "intersection_topics": ["交叉主题1", "交叉主题2"],
      "description": "跨领域交叉分析描述",
      "related_graph_titles": ["图谱标题1", "图谱标题2"]
    }
  ]
}

Relation Types:
- prerequisite: 学习目标图谱前需要先学习源图谱（源图谱是目标图谱的前置知识）
- extension: 源图谱是目标图谱的扩展深入内容
- related: 两个图谱有概念交叉但无直接学习依赖
- cross_domain: 两个图谱属于不同学科领域但有交叉点

Learning Order:
- source_first: 建议先学习源图谱
- target_first: 建议先学习目标图谱
- parallel: 可以同时学习

Important:
- Only suggest relations that do NOT already exist in existing_relations
- confidence should be between 0 and 1 (higher means more confident)
- Provide clear reasons in Chinese
- shared_concepts should list 2-5 key concepts that appear in both graphs
- Use exact graph titles from the input for matching
- Respond in Chinese`,
};
