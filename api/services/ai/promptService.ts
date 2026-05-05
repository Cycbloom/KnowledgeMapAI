import { SupabaseClient } from "@supabase/supabase-js";
import { TemplateEngine } from "../../utils/templateEngine";
import { cacheService, CacheKeys } from "../common/cacheService";
import { logger } from "../../utils/logger";

export type PromptScope = "system" | "user" | "graph";

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  "zh-CN": "Please respond in Chinese.",
  "en-US": "Please respond in English.",
  zh: "Please respond in Chinese.",
  en: "Please respond in English.",
};

function isEnglishLanguage(language?: string): boolean {
  if (!language) return false;
  return language === "en-US" || language === "en" || language.startsWith("en");
}

export function getLanguageInstruction(language?: string): string {
  if (!language) return LANGUAGE_INSTRUCTIONS["zh-CN"];
  if (isEnglishLanguage(language)) return LANGUAGE_INSTRUCTIONS["en-US"];
  return LANGUAGE_INSTRUCTIONS["zh-CN"];
}

export interface PromptTemplate {
  id: string;
  code: string;
  scope: PromptScope;
  user_id?: string;
  graph_id?: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

const GENERATE_CARDS_SCHEMA = `
Return a JSON object with a 'cards' array. Each card object must have: 
- 'type' (qa|choice|true_false|multi_choice|fill_in_the_blank|essay)
- 'question'
- 'answer'
- 'explanation' (Detailed analysis/reasoning)
- 'options' (Array of 4 strings, ONLY for 'choice' and 'multi_choice' types)`;

const DEFAULT_PROMPTS: Record<string, string> = {
  learning_material: `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

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

  podcast_script: `You are a professional podcast host. 
Your task is to create an engaging, educational podcast script based on the provided knowledge graph content.
The script should be:
1. Conversational and easy to listen to.
2. Structured with an intro, key points (deep dive), and a conclusion.
3. About 3-5 minutes long when spoken.
4. Written in {{language}} (if the content is mixed, prefer {{language}}).
5. Use clear markers for the speaker (e.g., "Host:").

Content to cover:
{{context}}

Please output the script in raw Markdown format.
IMPORTANT: Do NOT wrap the output in a code block (e.g., no \`\`\`markdown ... \`\`\`). Just return the raw Markdown text directly.`,

  podcast_system: `You are an expert podcast script writer.`,

  generate_cards: `You are an educational expert. Generate {{count}} flashcards based on the provided topic.

{{typeRestriction}}

{{difficultyInstruction}}

Context: {{context}}

Topic: {{topic}}
Content: {{content}}

Please respond with a valid JSON object.`,

  rag_chat: `你是一个智能知识图谱助手，专门帮助用户理解和探索知识图谱中的内容。

你的能力：
1. 基于提供的知识上下文回答用户问题
2. 如果上下文中没有相关信息，可以基于你的知识回答，但要明确说明
3. 帮助用户发现知识之间的关联
4. 建议用户可能感兴趣的相关问题

回答规则：
1. 优先使用提供的知识上下文回答问题
2. 如果上下文不足以回答，可以补充你的知识，但要说明"根据我的知识..."
3. 使用清晰的 Markdown 格式组织回答
4. 如果涉及数学公式，使用 LaTeX 格式: $inline$ 或 $$block$$
5. 在回答末尾，可以建议 1-3 个相关的后续问题

知识上下文：
{{context}}`,

  knowledge_gap_analysis: `你是一个知识图谱分析专家。分析给定的知识节点列表，找出可能缺失的知识领域或概念。

返回 JSON 格式: { "suggestions": ["建议1", "建议2", "建议3"] }

每个建议应该是一个简短的知识领域或概念名称。`,

  suggest_questions: `基于用户的原始问题和回答，生成 2-3 个相关的后续问题。
这些问题应该：
1. 帮助用户深入理解当前话题
2. 探索相关的知识节点
3. 具有启发性和探索性

返回 JSON 格式: { "questions": ["问题1", "问题2", "问题3"] }`,

  backbone_generation: `你是一个专业的知识图谱架构师，专门为学术研究和知识体系构建骨干网络结构。

## 任务目标

为给定的研究主题生成一个结构化的骨干网络，该网络将作为知识图谱的核心框架。

## 骨干网络模块

骨干网络由以下六个核心模块组成：

1. **研究背景 (research_background)**: 研究主题的背景信息、发展历程和现状
2. **文献综述 (literature_review)**: 相关文献的综述和分析
3. **研究方法 (research_methods)**: 研究采用的方法论和技术手段
4. **核心概念 (core_concepts)**: 研究的核心概念、定义和理论框架
5. **应用领域 (application_domains)**: 研究成果的应用领域和实际场景
6. **未来方向 (future_directions)**: 未来研究方向和发展趋势

## 节点粒度要求

**重要**: 只生成 root（根节点）和 core（核心节点）两个级别的节点：
- **root**: 主题根节点，每个模块的根节点
- **core**: 模块内的核心概念节点

不要生成 sub、normal 或 leaf 级别的节点。

## 本次生成的模块

{{modules}}

## 节点数量限制

- 每个模块最多生成 {{maxNodesPerModule}} 个核心节点
- 每个模块必须有 1 个 root 节点作为模块入口

## 重要提示

1. 每个节点的描述必须针对具体研究主题，不能使用通用描述
2. 描述要具体、专业、有学术价值
3. 请以有效的 json 格式返回结果`,
};

// Fixed output schemas (Hidden from user editing)
const OUTPUT_SCHEMAS: Record<string, string> = {
  learning_material: `
You must respond with a JSON object containing:
1. 'content': The learning material in Markdown format (as a string)
2. 'keywords': An array of 5-15 keywords extracted from the content

Each keyword object must have:
- 'term': The keyword text (string)
- 'importance': Importance level 1-5 (number, where 5 is most important)
- 'category': Category type - one of: {{categoryOptions}} (string)
- 'explanation': Brief explanation of the keyword (string, max 50 chars)

IMPORTANT: All keyword fields (term, category, explanation) must be in {{outputLanguage}}.`,

  expand_knowledge: `
Return a JSON object with a 'suggestions' array. Each object in the array must have 'title' and 'content' fields.
Example format: { "suggestions": [{ "title": "Example Title", "content": "Example content" }] }`,

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
- Each node must have title and content`,

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
- Each node must have title and content`,

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
- Provide 2-4 helpful suggestions`,

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
- generate 3-5 prerequisite questions relevant to the topic
- goals should be specific and motivating
- questions should identify knowledge that helps learn this topic
- always use the exact 4 options: 不了解, 了解一点, 比较熟悉, 非常熟悉`,

  generate_cards: GENERATE_CARDS_SCHEMA,
  generate_cards_qa: GENERATE_CARDS_SCHEMA,
  generate_cards_choice: GENERATE_CARDS_SCHEMA,
  generate_cards_true_false: GENERATE_CARDS_SCHEMA,
  generate_cards_multi_choice: GENERATE_CARDS_SCHEMA,
  generate_cards_fill_blank: GENERATE_CARDS_SCHEMA,
  generate_cards_essay: GENERATE_CARDS_SCHEMA,

  branch_suggestions: `
return a json object with a 'suggestions' array. Each object must have:
- 'id': Unique identifier for the branch
- 'title': Branch title
- 'content': Brief description of the branch direction
- 'existingNodes': Array of existing node titles to link to (if any)
- 'linkingStrategy': 'hierarchical' or 'network'
- 'priority': 1-5 (1 is highest)
- 'reason': Why this branch is interesting

Important:
- Generate 3-5 branches
- Each branch should be distinct and represent different perspectives
- Consider linking to existing nodes if relevant`,

  template_generation: `
return a JSON object with the following structure:
{
  "templates": [
    {
      "id": "template-1",
      "name": "Template Name",
      "description": "Brief description of this template approach",
      "nodes": [
        {
          "id": "node-1",
          "title": "Node Title",
          "description": "What this node represents",
          "level": "root|core|sub|normal|leaf",
          "parentId": null or "parent-node-id",
          "suggestedContent": "Brief suggestion for content",
          "color": "#hexcolor"
        }
      ],
      "edges": [
        {
          "source": "node-id",
          "target": "node-id",
          "relationship_type": "contains|related|prerequisite",
          "description": "Why this connection exists"
        }
      ],
      "layoutSuggestion": "radial|tree|network|hierarchical",
      "estimatedNodes": 10,
      "difficulty": "easy|medium|hard",
      "tags": ["tag1", "tag2"],
      "reasoning": "Why this structure works for the topic"
    }
  ]
}

Important:
- Generate exactly 3 different template schemes
- Each template should have 5-15 nodes as examples
- Use meaningful node titles (not generic like "Node 1")
- Ensure all edge references point to valid node IDs
- Consider the topic's nature when choosing structures
- provide clear reasoning for each template choice`,

  template_application: `
Return a JSON object with the following structure:
{
  "nodes": [
    {
      "id": "node-1",
      "title": "Node Title",
      "content": "Detailed content for this node (100-200 words)"
    }
  ]
}

Important:
- Generate content for each node in the template
- Maintain the template structure
- Follow the selected style (academic, practical, beginner, custom)`,

  text_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship_type": "relationship_type_name" }

Relationship Types (choose the most appropriate one based on the semantic relationship between nodes):

**Hierarchical (层级关系)**:
- contains: A 包含 B（如：章节包含知识点）
- has_subcategory: A 有子类别 B（如：编程语言有子类别 Python）
- part_of: A 是 B 的一部分（如：车轮是汽车的一部分）
- instance_of: A 是 B 的实例（如：Python 是编程语言的实例）

**Dependency (依赖关系)**:
- depends_on: A 依赖于 B（如：高级功能依赖于基础功能）
- prerequisite: B 是 A 的前置知识（如：学习微积分前需要先学代数）
- requires: A 需要 B（如：运行程序需要安装依赖）
- blocks: A 阻碍 B（如：缺少基础知识阻碍学习高级内容）

**Semantic (语义关系)**:
- related_to: A 与 B 相关（一般性关联）
- similar_to: A 与 B 相似（如：Java 与 C# 语法相似）
- contrasts_with: A 与 B 对比（如：面向对象与面向过程对比）
- synonym_of: A 是 B 的同义词（如：函数与方法）
- antonym_of: A 是 B 的反义词（如：优点与缺点）

**Temporal (时序关系)**:
- precedes: A 在 B 之前（如：设计先于开发）
- follows: A 跟随 B（如：测试跟随开发）
- concurrent_with: A 与 B 并发/同时进行

**Interaction (交互关系)**:
- interacts_with: A 与 B 交互（如：前端与后端交互）
- communicates_with: A 与 B 通信（如：客户端与服务器通信）
- collaborates_with: A 与 B 协作（如：多个模块协作完成任务）

**Causal (因果关系)**:
- causes: A 导致 B（如：错误配置导致系统崩溃）
- caused_by: A 由 B 导致（如：系统崩溃由错误配置导致）
- enables: A 使能 B（如：基础设施使能应用开发）
- prevents: A 阻止 B（如：防火墙阻止未授权访问）

Important:
- For parent-child hierarchical relationships, use "contains" or "has_subcategory"
- For knowledge prerequisites, use "prerequisite" or "depends_on"
- For similar concepts, use "similar_to"
- For cause-effect relationships, use "causes" or "caused_by"
- Choose the most specific relationship type that accurately describes the connection`,

  document_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship_type": "relationship_type_name" }

Relationship Types (choose the most appropriate one based on the semantic relationship between nodes):

**Hierarchical (层级关系)**:
- contains: A 包含 B（如：章节包含知识点）
- has_subcategory: A 有子类别 B（如：编程语言有子类别 Python）
- part_of: A 是 B 的一部分（如：车轮是汽车的一部分）
- instance_of: A 是 B 的实例（如：Python 是编程语言的实例）

**Dependency (依赖关系)**:
- depends_on: A 依赖于 B（如：高级功能依赖于基础功能）
- prerequisite: B 是 A 的前置知识（如：学习微积分前需要先学代数）
- requires: A 需要 B（如：运行程序需要安装依赖）
- blocks: A 阻碍 B（如：缺少基础知识阻碍学习高级内容）

**Semantic (语义关系)**:
- related_to: A 与 B 相关（一般性关联）
- similar_to: A 与 B 相似（如：Java 与 C# 语法相似）
- contrasts_with: A 与 B 对比（如：面向对象与面向过程对比）
- synonym_of: A 是 B 的同义词（如：函数与方法）
- antonym_of: A 是 B 的反义词（如：优点与缺点）

**Temporal (时序关系)**:
- precedes: A 在 B 之前（如：设计先于开发）
- follows: A 跟随 B（如：测试跟随开发）
- concurrent_with: A 与 B 并发/同时进行

**Interaction (交互关系)**:
- interacts_with: A 与 B 交互（如：前端与后端交互）
- communicates_with: A 与 B 通信（如：客户端与服务器通信）
- collaborates_with: A 与 B 协作（如：多个模块协作完成任务）

**Causal (因果关系)**:
- causes: A 导致 B（如：错误配置导致系统崩溃）
- caused_by: A 由 B 导致（如：系统崩溃由错误配置导致）
- enables: A 使能 B（如：基础设施使能应用开发）
- prevents: A 阻止 B（如：防火墙阻止未授权访问）

Important:
- For parent-child hierarchical relationships, use "contains" or "has_subcategory"
- For knowledge prerequisites, use "prerequisite" or "depends_on"
- For similar concepts, use "similar_to"
- For cause-effect relationships, use "causes" or "caused_by"
- Choose the most specific relationship type that accurately describes the connection`,

  recommend_connections: `
Return a JSON object with a 'recommendations' array. Each item should have 'node_title' and 'reason'.`,

  term_annotation: `
Return a JSON array where each object has "term" (the exact text found in the source) and "explanation" (a concise definition under 20 words).
Example format: [{"term": "RAG", "explanation": "检索增强生成，一种结合检索系统和生成模型的技术。"}]`,

  infinite_graph_expansion: `
Return a JSON object with the following structure:
{
  "prerequisite": [
    { 
      "title": "领域名称", 
      "description": "该领域的简要描述（说明包含什么内容）", 
      "reason": "为什么是前置知识",
      "suggested_domain": "建议归属的父领域名称（可选，基于领域层级关系）"
    }
  ],
  "extension": [
    { 
      "title": "领域名称", 
      "description": "该领域的简要描述（说明包含什么内容）", 
      "reason": "为什么是扩展知识",
      "suggested_domain": "建议归属的父领域名称（可选，基于领域层级关系）"
    }
  ],
  "related": [
    { 
      "title": "领域名称", 
      "description": "该领域的简要描述（说明包含什么内容）", 
      "reason": "为什么是相关知识",
      "suggested_domain": "建议归属的父领域名称（可选，基于领域层级关系）"
    }
  ]
}

Important:
- Each array can be empty if no suitable domains exist
- title should be a concise domain name (2-10 characters preferred)
- description should explain what the domain contains, NOT its relationship to the current domain
- reason should explain why this domain has this relationship type
- suggested_domain should be based on domain hierarchy (e.g., if current domain is "机器学习", a new domain "深度学习" could suggest "机器学习" as parent)
- If the new domain is a sub-domain of current domain, set suggested_domain to current domain name`,

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
- Use exact node titles from the input for matching`,

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
- Use exact graph titles from the input for matching`,

  backbone_generation: `
Return a JSON object with the following structure:
{
  "backbone": {
    "id": "unique-id",
    "topic": "研究主题",
    "description": "整体描述",
    "nodes": [
      {
        "id": "node-id",
        "title": "节点标题",
        "description": "节点描述（针对主题的具体内容，50-100字）",
        "level": "root 或 core",
        "module": "所属模块标识（research_background, literature_review, research_methods, core_concepts, application_domains, future_directions）",
        "parentId": "父节点ID（可选）",
        "suggestedContent": "建议内容"
      }
    ],
    "edges": [
      {
        "source": "源节点ID",
        "target": "目标节点ID",
        "relationship_type": "关系类型",
        "description": "关系描述"
      }
    ],
    "layoutSuggestion": "radial",
    "estimatedNodes": 7,
    "reasoning": "为什么这个结构适合该主题"
  }
}

Important:
- Generate exactly 1 root node (the main topic) and 6 core nodes (one for each module)
- Each node description must be specific to the research topic, not generic
- Node level must be either "root" or "core" only
- The root node should have no parentId
- Each core node should have parentId pointing to the root node id
- Each core node must have a valid module identifier`,

  literature_concept_extraction: `
Return a JSON object with the following structure:
{
  "concepts": [
    {
      "name": "概念名称",
      "type": "concept|term|theory|method|finding",
      "description": "概念的简要描述（50-100字）",
      "importance": "high|medium|low",
      "context": "在文献中的上下文或出处"
    }
  ],
  "metadata": {
    "totalConcepts": 数字,
    "mainTopics": ["主要主题1", "主要主题2"],
    "keywords": ["关键词1", "关键词2", "关键词3"]
  }
}

Important:
- Extract 5-15 concepts from the literature
- Each concept must have a unique name
- type should be one of: concept, term, theory, method, finding
- importance should reflect the concept's significance in the literature`,

  literature_relation_inference: `
Return a JSON object with the following structure:
{
  "relations": [
    {
      "source": "源概念名称",
      "target": "目标概念名称",
      "type": "hierarchical|associative|causal|contrastive",
      "subtype": "parent_of|child_of|related_to|depends_on|causes|contrasts_with",
      "description": "关系描述（20-50字）",
      "confidence": 0.0-1.0,
      "evidence": "文献中支持此关系的证据"
    }
  ],
  "suggestedConnections": [
    {
      "concept": "概念名称",
      "existingNode": "已存在节点名称",
      "relationType": "关系类型",
      "reason": "连接理由"
    }
  ],
  "metadata": {
    "totalRelations": 数字,
    "relationTypeDistribution": {
      "hierarchical": 数字,
      "associative": 数字,
      "causal": 数字,
      "contrastive": 数字
    }
  }
}

Important:
- Only return relations with confidence >= 0.5
- type should be one of: hierarchical, associative, causal, contrastive
- subtype should match the type appropriately
- confidence should be between 0 and 1`,
};

export interface PromptListOptions {
  scope?: PromptScope;
  userId?: string;
  graphId?: string;
}

export interface PromptCreateData {
  code: string;
  scope: PromptScope;
  template_content: string;
  user_id?: string;
  graph_id?: string;
}

export interface PromptUpdateData {
  template_content?: string;
  code?: string;
}

export class PromptService {
  async list(
    supabase: SupabaseClient,
    options: PromptListOptions = {},
  ): Promise<{
    system: PromptTemplate[];
    user: PromptTemplate[];
    graph: PromptTemplate[];
  }> {
    const { userId, graphId } = options;

    const { data: systemTemplates, error: sysError } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("scope", "system");

    if (sysError) throw sysError;

    let userQuery = supabase
      .from("prompt_templates")
      .select("*")
      .eq("scope", "user");

    if (userId) {
      userQuery = userQuery.eq("user_id", userId);
    }

    const { data: userTemplates, error: userError } = await userQuery;

    if (userError) throw userError;

    let graphTemplates: PromptTemplate[] = [];
    if (graphId) {
      const { data: gTemplates, error: gError } = await supabase
        .from("prompt_templates")
        .select("*")
        .eq("scope", "graph")
        .eq("graph_id", graphId);

      if (gError) throw gError;
      graphTemplates = gTemplates || [];
    }

    return {
      system: systemTemplates || [],
      user: userTemplates || [],
      graph: graphTemplates,
    };
  }

  async get(
    supabase: SupabaseClient,
    id: string,
  ): Promise<PromptTemplate | null> {
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data;
  }

  async create(
    supabase: SupabaseClient,
    data: PromptCreateData,
  ): Promise<PromptTemplate> {
    const { code, scope, template_content, user_id, graph_id } = data;

    const insertData: Record<string, any> = {
      code,
      scope,
      template_content,
      user_id: scope === "system" ? null : user_id,
      graph_id: scope === "graph" ? graph_id : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from("prompt_templates")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return result;
  }

  async update(
    supabase: SupabaseClient,
    id: string,
    data: PromptUpdateData,
  ): Promise<PromptTemplate> {
    const updateData: Record<string, any> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from("prompt_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (result) {
      const cacheUserId = result.user_id || "system";
      const cacheGraphId = result.graph_id || "none";
      await cacheService.del(
        CacheKeys.PROMPT_TEMPLATE(result.code, cacheUserId, cacheGraphId),
      );
    }

    return result;
  }

  async delete(supabase: SupabaseClient, id: string): Promise<void> {
    const { data: temp } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    if (temp) {
      const cacheUserId = temp.user_id || "system";
      const cacheGraphId = temp.graph_id || "none";
      await cacheService.del(
        CacheKeys.PROMPT_TEMPLATE(temp.code, cacheUserId, cacheGraphId),
      );
    }
  }

  /**
   * Get the final rendered prompt string
   * Includes priority logic (Graph > User > System) and Schema appending
   */
  async getRenderedPrompt(
    supabase: SupabaseClient,
    code: string,
    context: Record<string, any>,
    userId?: string,
    graphId?: string,
    language?: string,
  ): Promise<string> {
    const template = await this.getTemplate(supabase, code, userId, graphId);

    let content = "";

    if (!template) {
      const defaultPrompt = DEFAULT_PROMPTS[code];
      if (defaultPrompt) {
        logger.info(`Using default prompt for code: ${code}`);
        try {
          content = TemplateEngine.render(defaultPrompt, context);
        } catch (e) {
          logger.error(`Failed to render default prompt ${code}`, e);
          content = defaultPrompt;
        }
      } else {
        logger.warn(
          `No template found for code: ${code}. Using empty fallback.`,
        );
        content = "";
      }
    } else {
      try {
        content = TemplateEngine.render(template.template_content, context);
      } catch (e) {
        logger.error(`Failed to render prompt ${code}`, e);
        content = template.template_content;
      }
    }

    // Append fixed schema if exists
    if (OUTPUT_SCHEMAS[code]) {
      content += `\n\n${OUTPUT_SCHEMAS[code]}`;
    }

    // Replace output language placeholder in schemas
    const outputLanguage = isEnglishLanguage(language) ? "English" : "Chinese";
    content = content.replace(/\{\{outputLanguage\}\}/g, outputLanguage);

    // Replace category options based on language
    const categoryOptions = isEnglishLanguage(language)
      ? "'Definition', 'Concept', 'Method', 'Conclusion', 'Principle', 'Application', 'Terminology'"
      : "'定义', '概念', '方法', '结论', '原理', '应用', '术语'";
    content = content.replace(/\{\{categoryOptions\}\}/g, categoryOptions);

    // Append language instruction based on the language parameter
    const languageInstruction = getLanguageInstruction(language);
    content += `\n\n${languageInstruction}`;

    return content;
  }

  /**
   * Get the raw template object based on priority
   */
  async getTemplate(
    supabase: SupabaseClient,
    code: string,
    userId?: string,
    graphId?: string,
  ): Promise<PromptTemplate | null> {
    const cacheKey = CacheKeys.PROMPT_TEMPLATE(
      code,
      userId || "system",
      graphId || "none",
    );

    // Try cache first
    const cached = await cacheService.get<PromptTemplate>(cacheKey);
    if (cached) return cached;

    // Fetch all relevant templates for this code
    // We fetch system templates, user templates (if userId), and graph templates (if graphId)
    const query = supabase
      .from("prompt_templates")
      .select("*")
      .eq("code", code);

    // Construct OR filter manually or just fetch more and filter in memory (usually few templates per code)
    // Supabase OR with complex conditions can be tricky.
    // Let's use a simple approach: fetch all with this code.
    // CAUTION: This might return other users' templates if RLS is bypassed or not working.
    // But since we pass `supabase` client which (usually) has user context, RLS should apply.
    // If RLS applies, we only see: System + My User + My Graph.
    // If we use service role (admin), we see ALL.
    // So we MUST filter in memory to be safe if client is admin.

    const { data: templates, error } = await query;
    if (error) throw error;

    if (!templates || templates.length === 0) return null;

    // Filter relevant templates
    const relevant = templates.filter((t) => {
      if (t.scope === "system") return true;
      if (t.scope === "user" && t.user_id === userId) return true;
      if (t.scope === "graph" && t.graph_id === graphId) return true;
      return false;
    });

    // Sort by priority: Graph > User > System
    const getWeight = (t: PromptTemplate) => {
      if (t.scope === "graph" && t.graph_id === graphId) return 3;
      if (t.scope === "user" && t.user_id === userId) return 2;
      if (t.scope === "system") return 1;
      return 0;
    };

    const sorted = relevant.sort((a, b) => getWeight(b) - getWeight(a));
    const bestMatch = sorted[0];

    // Cache the result (short TTL to allow quick updates, e.g. 60s)
    if (bestMatch) {
      await cacheService.set(cacheKey, bestMatch, 60);
    }

    return bestMatch || null;
  }

  // Management Methods

  async saveTemplate(
    supabase: SupabaseClient,
    template: Partial<PromptTemplate>,
  ) {
    const { data, error } = await supabase
      .from("prompt_templates")
      .upsert(
        {
          ...template,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "code,scope,user_id,graph_id" },
      )
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    const userId = template.user_id || "system";
    const graphId = template.graph_id || "none";
    await cacheService.del(
      CacheKeys.PROMPT_TEMPLATE(template.code!, userId, graphId),
    );

    return data;
  }

  async deleteTemplate(supabase: SupabaseClient, id: string) {
    // Get template first to know keys for cache invalidation
    const { data: temp } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", id);
    if (error) throw error;

    if (temp) {
      const userId = temp.user_id || "system";
      const graphId = temp.graph_id || "none";
      await cacheService.del(
        CacheKeys.PROMPT_TEMPLATE(temp.code, userId, graphId),
      );
    }
  }

  async resetToDefault(
    supabase: SupabaseClient,
    code: string,
    scope: PromptScope,
    userId?: string,
    graphId?: string,
  ) {
    // Delete the specific override
    let query = supabase
      .from("prompt_templates")
      .delete()
      .eq("code", code)
      .eq("scope", scope);

    if (scope === "user" && userId) query = query.eq("user_id", userId);
    if (scope === "graph" && graphId) query = query.eq("graph_id", graphId);

    const { error } = await query;
    if (error) throw error;

    // Invalidate cache
    await cacheService.del(
      CacheKeys.PROMPT_TEMPLATE(code, userId || "system", graphId || "none"),
    );
  }
}

export const promptService = new PromptService();
