import { SupabaseClient } from "@supabase/supabase-js";
import { getAIProviderForTask } from "../ai/factory";
import { logger } from "../../utils/logger";
import { performanceMonitor, enrichMetadata } from "../ai/performanceMonitor";
import { pricingService } from "../ai/pricingService";
import { notDeleted } from '../common/softDeleteHelper';
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { CrossDomainInsight, GraphInfo } from "./relationDiscoveryService";

export class CrossDomainAnalysisService {
  async analyzeCrossDomainInsights(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      graph_ids?: string[];
      min_intersection?: number;
      session_id?: string;
    },
    enrichGraphsWithNodeInfo?: (
      supabase: SupabaseClient,
      graphs: Array<{
        id: string;
        title: string;
        description: string | null;
        domain: string | null;
      }>,
    ) => Promise<GraphInfo[]>,
  ): Promise<{
    cross_domain_insights: CrossDomainInsight[];
    domain_distribution: Record<string, number>;
    analysis_summary: { total_domains: number; cross_domain_clusters: number };
    session_id?: string;
  }> {
    const minIntersection = options?.min_intersection || 2;
    const sessionId = options?.session_id || crypto.randomUUID();

    const graphIds = options?.graph_ids;
    let graphs: GraphInfo[];

    if (graphIds && graphIds.length > 0) {
      const { data: graphData, error } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        );

      if (error) throw error;
      graphs = enrichGraphsWithNodeInfo
        ? await enrichGraphsWithNodeInfo(supabase, graphData || [])
        : [];
    } else {
      const { data: graphData, error } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        );

      if (error) throw error;
      graphs = enrichGraphsWithNodeInfo
        ? await enrichGraphsWithNodeInfo(supabase, graphData || [])
        : [];
    }

    if (graphs.length < 2) {
      return {
        cross_domain_insights: [],
        domain_distribution: {},
        analysis_summary: {
          total_domains: 0,
          cross_domain_clusters: 0,
        },
      };
    }

    const domainDistribution: Record<string, number> = {};
    for (const graph of graphs) {
      const domain = graph.domain || "未分类";
      domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;
    }

    const uniqueDomains = Object.keys(domainDistribution);
    if (uniqueDomains.length < 2) {
      return {
        cross_domain_insights: [],
        domain_distribution: domainDistribution,
        analysis_summary: {
          total_domains: uniqueDomains.length,
          cross_domain_clusters: 0,
        },
      };
    }

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, { message: "AI provider not configured" });
    }

    const systemPrompt = `你是一个跨学科知识分析专家。分析不同领域的知识图谱，发现跨学科的联系和洞察。

## 输出格式
返回JSON格式：
{
  "cross_domain_insights": [
    {
      "domains": ["领域1", "领域2"],
      "intersection_topics": ["交叉主题1", "交叉主题2"],
      "description": "跨学科洞察描述",
      "related_graph_titles": ["图谱标题1", "图谱标题2"]
    }
  ]
}

## 要求
- 只分析不同领域之间的交叉
- intersection_topics 必须至少包含 ${minIntersection} 个主题
- 用中文回复`;

    const graphSummaries = graphs.map((g) => ({
      title: g.title,
      domain: g.domain || "未分类",
      core_concepts: g.core_concepts.slice(0, 10),
    }));

    const enrichedMetadata = await enrichMetadata(supabase, {
      userId,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `分析以下知识图谱的跨学科联系：\n\n${JSON.stringify(graphSummaries, null, 2)}`,
        },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });
    const duration = Date.now() - startTime;

    const usage = completion.usage;
    if (usage) {
      const cost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        usage.prompt_tokens,
        usage.completion_tokens,
        0,
      );
      await performanceMonitor.recordLog({
        operation: "analyze_cross_domain_insights",
        provider: provider.providerType,
        model: provider.model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.prompt_tokens + usage.completion_tokens,
        cachedInputTokens: 0,
        duration,
        success: true,
        estimatedCost: cost,
        metadata: enrichedMetadata,
        sessionId,
      });
    }

    const content = completion.choices[0].message.content;
    let parsed: {
      cross_domain_insights: Array<{
        domains: string[];
        intersection_topics: string[];
        description: string;
        related_graph_titles?: string[];
      }>;
    } = { cross_domain_insights: [] };

    try {
      parsed = JSON.parse(content || "{}");
    } catch (e) {
      logger.error("Failed to parse cross domain insights", e);
    }

    const crossDomainInsights: CrossDomainInsight[] = [];

    // 复杂度降低：预构建标题/领域索引，避免每个 insight 内层重复 O(n) 的 filter+some/includes
    const titleToGraph = new Map<string, GraphInfo>();
    const domainGraphs = new Map<string, GraphInfo[]>();
    for (const g of graphs) {
      titleToGraph.set(g.title.toLowerCase(), g);
      const domain = g.domain || "";
      const list = domainGraphs.get(domain);
      if (list) list.push(g);
      else domainGraphs.set(domain, [g]);
    }

    for (const insight of parsed.cross_domain_insights || []) {
      if (
        insight.intersection_topics &&
        insight.intersection_topics.length >= minIntersection
      ) {
        const matched = new Set<GraphInfo>();
        for (const t of insight.related_graph_titles || []) {
          const g = titleToGraph.get(t.toLowerCase());
          if (g) matched.add(g);
        }
        for (const d of insight.domains || []) {
          for (const g of domainGraphs.get(d) || []) matched.add(g);
        }
        const relatedGraphs = graphs.filter((g) => matched.has(g));
        crossDomainInsights.push({
          domains: insight.domains || [],
          intersection_topics: insight.intersection_topics,
          description: insight.description || "",
          related_graph_ids: relatedGraphs.map((g) => g.id),
        });
      }
    }

    return {
      cross_domain_insights: crossDomainInsights,
      domain_distribution: domainDistribution,
      analysis_summary: {
        total_domains: uniqueDomains.length,
        cross_domain_clusters: crossDomainInsights.length,
      },
      session_id: sessionId,
    };
  }

  async generateLearningPathSuggestions(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      graph_ids?: string[];
      difficulty?: "beginner" | "intermediate" | "advanced";
      session_id?: string;
    },
    enrichGraphsWithNodeInfo?: (
      supabase: SupabaseClient,
      graphs: Array<{
        id: string;
        title: string;
        description: string | null;
        domain: string | null;
      }>,
    ) => Promise<GraphInfo[]>,
    getExistingRelations?: (
      supabase: SupabaseClient,
      graphIds: string[],
    ) => Promise<
      Array<{
        source_graph_id: string;
        target_graph_id: string;
        relation_type: string;
      }>
    >,
  ): Promise<{
    learning_path_suggestions: Array<{
      path: string[];
      path_titles: string[];
      description: string;
      estimated_time: string;
      difficulty: "beginner" | "intermediate" | "advanced";
    }>;
    analysis_summary: { total_paths: number; avg_path_length: number };
    session_id?: string;
  }> {
    const targetDifficulty = options?.difficulty;
    const sessionId = options?.session_id || crypto.randomUUID();

    const graphIds = options?.graph_ids;
    let graphs: GraphInfo[];

    if (graphIds && graphIds.length > 0) {
      const { data: graphData, error } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        );

      if (error) throw error;
      graphs = enrichGraphsWithNodeInfo
        ? await enrichGraphsWithNodeInfo(supabase, graphData || [])
        : [];
    } else {
      const { data: graphData, error } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        );

      if (error) throw error;
      graphs = enrichGraphsWithNodeInfo
        ? await enrichGraphsWithNodeInfo(supabase, graphData || [])
        : [];
    }

    if (graphs.length < 2) {
      return {
        learning_path_suggestions: [],
        analysis_summary: {
          total_paths: 0,
          avg_path_length: 0,
        },
      };
    }

    let existingRelations: Array<{
      source_graph_id: string;
      target_graph_id: string;
      relation_type: string;
    }> = [];
    if (getExistingRelations) {
      existingRelations = await getExistingRelations(
        supabase,
        graphs.map((g) => g.id),
      );
    }

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, { message: "AI provider not configured" });
    }

    const systemPrompt = `你是一个学习路径规划专家。根据知识图谱之间的关系，为用户推荐最优的学习路径。

## 输出格式
返回JSON格式：
{
  "learning_path_suggestions": [
    {
      "path_titles": ["图谱标题1", "图谱标题2", "图谱标题3"],
      "description": "学习路径描述",
      "estimated_time": "预计学习时间（如：2周、1个月）",
      "difficulty": "beginner|intermediate|advanced"
    }
  ]
}

## 要求
- 每条路径至少包含2个图谱
- 路径中的图谱应该有逻辑上的先后顺序
- ${targetDifficulty ? `优先推荐 ${targetDifficulty} 难度的路径` : "推荐不同难度的路径"}
- 用中文回复`;

    const graphSummaries = graphs.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain || "未分类",
      node_count: g.node_count,
      core_concepts: g.core_concepts.slice(0, 5),
    }));

    // 复杂度降低：预构建 id->graph Map，避免对每条关系重复 O(n) 的 graphs.find()
    const idToGraph = new Map(graphs.map((g) => [g.id, g] as const));

    const relationSummaries = existingRelations.map((r) => {
      const sourceGraph = idToGraph.get(r.source_graph_id);
      const targetGraph = idToGraph.get(r.target_graph_id);
      return {
        from: sourceGraph?.title || r.source_graph_id,
        to: targetGraph?.title || r.target_graph_id,
        type: r.relation_type,
      };
    });

    const enrichedMetadata = await enrichMetadata(supabase, {
      userId,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `基于以下知识图谱和关系，生成学习路径建议：

图谱列表：
${JSON.stringify(graphSummaries, null, 2)}

现有关系：
${JSON.stringify(relationSummaries, null, 2)}`,
        },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });
    const duration = Date.now() - startTime;

    const usage = completion.usage;
    if (usage) {
      const cost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        usage.prompt_tokens,
        usage.completion_tokens,
        0,
      );
      await performanceMonitor.recordLog({
        operation: "generate_learning_path_suggestions",
        provider: provider.providerType,
        model: provider.model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.prompt_tokens + usage.completion_tokens,
        cachedInputTokens: 0,
        duration,
        success: true,
        estimatedCost: cost,
        metadata: enrichedMetadata,
        sessionId,
      });
    }

    const content = completion.choices[0].message.content;
    let parsed: {
      learning_path_suggestions: Array<{
        path_titles: string[];
        description: string;
        estimated_time: string;
        difficulty: "beginner" | "intermediate" | "advanced";
      }>;
    } = { learning_path_suggestions: [] };

    try {
      parsed = JSON.parse(content || "{}");
    } catch (e) {
      logger.error("Failed to parse learning path suggestions", e);
    }

    const learningPathSuggestions: Array<{
      path: string[];
      path_titles: string[];
      description: string;
      estimated_time: string;
      difficulty: "beginner" | "intermediate" | "advanced";
    }> = [];

    // 复杂度降低：预构建标题索引，避免内层对每个标题重复 O(n) 的 graphs.find()
    const titleToGraph = new Map(graphs.map((g) => [g.title.toLowerCase(), g] as const));

    for (const suggestion of parsed.learning_path_suggestions || []) {
      if (suggestion.path_titles && suggestion.path_titles.length >= 2) {
        if (targetDifficulty && suggestion.difficulty !== targetDifficulty) {
          continue;
        }

        const pathIds: string[] = [];
        const validTitles: string[] = [];

        for (const title of suggestion.path_titles) {
          const graph = titleToGraph.get(title.toLowerCase());
          if (graph) {
            pathIds.push(graph.id);
            validTitles.push(graph.title);
          }
        }

        if (pathIds.length >= 2) {
          learningPathSuggestions.push({
            path: pathIds,
            path_titles: validTitles,
            description: suggestion.description || "",
            estimated_time: suggestion.estimated_time || "未知",
            difficulty: suggestion.difficulty || "intermediate",
          });
        }
      }
    }

    const avgPathLength =
      learningPathSuggestions.length > 0
        ? learningPathSuggestions.reduce((sum, p) => sum + p.path.length, 0) /
          learningPathSuggestions.length
        : 0;

    return {
      learning_path_suggestions: learningPathSuggestions,
      analysis_summary: {
        total_paths: learningPathSuggestions.length,
        avg_path_length: Math.round(avgPathLength * 10) / 10,
      },
      session_id: sessionId,
    };
  }

  async analyzeKnowledgeGaps(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      graph_ids?: string[];
      min_importance?: "high" | "medium" | "low";
      session_id?: string;
    },
    enrichGraphsWithNodeInfo?: (
      supabase: SupabaseClient,
      graphs: Array<{
        id: string;
        title: string;
        description: string | null;
        domain: string | null;
      }>,
    ) => Promise<GraphInfo[]>,
  ): Promise<{
    knowledge_gaps: Array<{
      missing_topic: string;
      related_graphs: string[];
      related_graph_titles: string[];
      importance: "high" | "medium" | "low";
      suggested_action: "create" | "merge" | "expand";
      reason: string;
    }>;
    analysis_summary: { total_gaps: number; high_priority_count: number };
    session_id?: string;
  }> {
    const minImportance = options?.min_importance;
    const sessionId = options?.session_id || crypto.randomUUID();

    const graphIds = options?.graph_ids;
    let graphs: GraphInfo[];

    if (graphIds && graphIds.length > 0) {
      const { data: graphData, error } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        );

      if (error) throw error;
      graphs = enrichGraphsWithNodeInfo
        ? await enrichGraphsWithNodeInfo(supabase, graphData || [])
        : [];
    } else {
      const { data: graphData, error } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        );

      if (error) throw error;
      graphs = enrichGraphsWithNodeInfo
        ? await enrichGraphsWithNodeInfo(supabase, graphData || [])
        : [];
    }

    if (graphs.length < 1) {
      return {
        knowledge_gaps: [],
        analysis_summary: {
          total_gaps: 0,
          high_priority_count: 0,
        },
      };
    }

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, { message: "AI provider not configured" });
    }

    const systemPrompt = `你是一个知识管理专家。分析用户的知识图谱，发现可能存在的知识缺口。

## 输出格式
返回JSON格式：
{
  "knowledge_gaps": [
    {
      "missing_topic": "缺失的知识主题",
      "related_graph_titles": ["相关图谱标题1", "相关图谱标题2"],
      "importance": "high|medium|low",
      "suggested_action": "create|merge|expand",
      "reason": "为什么这是一个知识缺口"
    }
  ]
}

## 建议动作说明
- create: 创建新的知识图谱
- merge: 合并现有的图谱
- expand: 扩展现有图谱的内容

## 要求
- 分析图谱之间的关联，找出知识体系中可能缺失的环节
- ${minImportance ? `只返回重要性为 ${minImportance} 及以上的缺口` : "返回所有重要性的缺口"}
- 用中文回复`;

    const graphSummaries = graphs.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain || "未分类",
      node_count: g.node_count,
      core_concepts: g.core_concepts.slice(0, 10),
    }));

    const enrichedMetadata = await enrichMetadata(supabase, {
      userId,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `分析以下知识图谱，找出知识缺口：\n\n${JSON.stringify(graphSummaries, null, 2)}`,
        },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });
    const duration = Date.now() - startTime;

    const usage = completion.usage;
    if (usage) {
      const cost = pricingService.calculateCost(
        provider.providerType,
        provider.model,
        usage.prompt_tokens,
        usage.completion_tokens,
        0,
      );
      await performanceMonitor.recordLog({
        operation: "analyze_knowledge_gaps",
        provider: provider.providerType,
        model: provider.model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.prompt_tokens + usage.completion_tokens,
        cachedInputTokens: 0,
        duration,
        success: true,
        estimatedCost: cost,
        metadata: enrichedMetadata,
        sessionId,
      });
    }

    const content = completion.choices[0].message.content;
    let parsed: {
      knowledge_gaps: Array<{
        missing_topic: string;
        related_graph_titles: string[];
        importance: "high" | "medium" | "low";
        suggested_action: "create" | "merge" | "expand";
        reason: string;
      }>;
    } = { knowledge_gaps: [] };

    try {
      parsed = JSON.parse(content || "{}");
    } catch (e) {
      logger.error("Failed to parse knowledge gaps", e);
    }

    const importanceOrder = { high: 3, medium: 2, low: 1 };
    const minImportanceLevel = minImportance
      ? importanceOrder[minImportance]
      : 0;

    const knowledgeGaps: Array<{
      missing_topic: string;
      related_graphs: string[];
      related_graph_titles: string[];
      importance: "high" | "medium" | "low";
      suggested_action: "create" | "merge" | "expand";
      reason: string;
    }> = [];

    // 复杂度降低：预构建标题索引，避免内层对每个标题重复 O(n) 的 graphs.find()
    const titleToGraph = new Map(graphs.map((g) => [g.title.toLowerCase(), g] as const));

    for (const gap of parsed.knowledge_gaps || []) {
      if (importanceOrder[gap.importance] < minImportanceLevel) {
        continue;
      }

      const relatedGraphIds: string[] = [];
      const relatedGraphTitles: string[] = [];

      for (const title of gap.related_graph_titles || []) {
        const graph = titleToGraph.get(title.toLowerCase());
        if (graph) {
          relatedGraphIds.push(graph.id);
          relatedGraphTitles.push(graph.title);
        }
      }

      knowledgeGaps.push({
        missing_topic: gap.missing_topic || "未知主题",
        related_graphs: relatedGraphIds,
        related_graph_titles: relatedGraphTitles,
        importance: gap.importance || "medium",
        suggested_action: gap.suggested_action || "create",
        reason: gap.reason || "",
      });
    }

    const highPriorityCount = knowledgeGaps.filter(
      (g) => g.importance === "high",
    ).length;

    return {
      knowledge_gaps: knowledgeGaps,
      analysis_summary: {
        total_gaps: knowledgeGaps.length,
        high_priority_count: highPriorityCount,
      },
      session_id: sessionId,
    };
  }
}

export const crossDomainAnalysisService = new CrossDomainAnalysisService();
