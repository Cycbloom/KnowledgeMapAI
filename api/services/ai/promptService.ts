import { SupabaseClient } from "@supabase/supabase-js";
import { TemplateEngine } from "../../utils/templateEngine.js";
import { cacheService, CacheKeys } from "../common/cacheService.js";
import { logger } from "../../utils/logger.js";

export type PromptScope = "system" | "user" | "graph";

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
- 'options' (Array of 4 strings, ONLY for 'choice' and 'multi_choice' types)

Please respond in Chinese.`;

const DEFAULT_PROMPTS: Record<string, string> = {};

// Fixed output schemas (Hidden from user editing)
const OUTPUT_SCHEMAS: Record<string, string> = {
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
- Choose the most specific relationship type that accurately describes the connection
Please respond in Chinese.`,

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
