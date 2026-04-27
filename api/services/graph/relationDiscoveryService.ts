import { SupabaseClient } from "@supabase/supabase-js";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { logger } from "../../utils/logger";
import { performanceMonitor, enrichMetadata } from "../ai/performanceMonitor";
import { pricingService } from "../ai/pricingService";

export interface DiscoveredRelation {
  source_graph_id: string;
  source_graph_title: string;
  target_graph_id: string;
  target_graph_title: string;
  relation_type: "prerequisite" | "extension" | "related" | "cross_domain";
  confidence: number;
  reason: string;
  shared_concepts: string[];
  suggested_learning_order?: "source_first" | "target_first" | "parallel";
}

export interface CrossDomainInsight {
  domains: string[];
  intersection_topics: string[];
  description: string;
  related_graph_ids: string[];
}

export interface DiscoveryResult {
  discovered_relations: DiscoveredRelation[];
  cross_domain_insights: CrossDomainInsight[];
  analysis_summary: {
    total_graphs_analyzed: number;
    relations_discovered: number;
    cross_domain_clusters: number;
    isolated_graphs: string[];
  };
}

export interface GraphInfo {
  id: string;
  title: string;
  description: string | null;
  domain: string | null;
  node_count: number;
  core_concepts: string[];
}

export interface IntelligentSuggestion {
  learning_path_suggestions: Array<{
    path: string[];
    description: string;
    estimated_time: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }>;
  knowledge_gaps: Array<{
    missing_topic: string;
    related_graphs: string[];
    importance: "high" | "medium" | "low";
    suggested_action: "create" | "merge" | "expand";
  }>;
  cross_domain_opportunities: Array<{
    domains: string[];
    intersection_graphs: string[];
    potential_benefits: string;
    recommended_order: string[];
  }>;
}

export interface CreateRelationFromDiscoveryData {
  source_graph_id: string;
  target_graph_id: string;
  relation_type: "prerequisite" | "extension" | "related" | "cross_domain";
  context?: string;
  metadata?: Record<string, any>;
  confidence?: number;
  shared_concepts?: string[];
}

export class RelationDiscoveryService {
  async discoverRelations(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      graph_ids?: string[];
      max_suggestions?: number;
      include_cross_domain?: boolean;
      session_id?: string;
    },
  ): Promise<DiscoveryResult & { session_id?: string }> {
    const maxSuggestions = options?.max_suggestions || 20;
    const includeCrossDomain = options?.include_cross_domain ?? true;
    const sessionId = options?.session_id || crypto.randomUUID();

    const graphIds = options?.graph_ids;
    let graphs: GraphInfo[];

    if (graphIds && graphIds.length > 0) {
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
    } else {
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
    }

    if (graphs.length < 2) {
      return {
        discovered_relations: [],
        cross_domain_insights: [],
        analysis_summary: {
          total_graphs_analyzed: graphs.length,
          relations_discovered: 0,
          cross_domain_clusters: 0,
          isolated_graphs: graphs.map((g) => g.id),
        },
      };
    }

    const existingRelations = await this.getExistingRelations(
      supabase,
      graphs.map((g) => g.id),
    );
    const existingRelationPairs = new Set(
      existingRelations.map(
        (r) => `${r.source_graph_id}-${r.target_graph_id}-${r.relation_type}`,
      ),
    );

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new Error("AI provider not configured");
    }

    const graphSummaries = graphs.map((g) => ({
      title: g.title,
      description: g.description || "",
      domain: g.domain || "未知领域",
      core_concepts: g.core_concepts.slice(0, 10),
      node_count: g.node_count,
    }));

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "discover_graph_relations",
      {
        graphs: graphSummaries,
        existing_relations: existingRelations.map((r) => {
          const sourceGraph = graphs.find((g) => g.id === r.source_graph_id);
          const targetGraph = graphs.find((g) => g.id === r.target_graph_id);
          return {
            from_title: sourceGraph?.title || r.source_graph_id,
            to_title: targetGraph?.title || r.target_graph_id,
            type: r.relation_type,
          };
        }),
        max_suggestions: maxSuggestions,
        include_cross_domain: includeCrossDomain,
      },
      userId,
    );

    const userMessage = `请分析以下${graphs.length}个知识图谱，发现它们之间的潜在关系。

现有关系：${existingRelations.length}个
图谱列表：
${graphs.map((g, i) => `${i + 1}. ${g.title} (${g.domain || "未分类"}, ${g.node_count}个知识点)`).join("\n")}

请发现新的潜在关系，输出JSON格式。`;

    const enrichedMetadata = await enrichMetadata(supabase, {
      userId: userId,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
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
        operation: "discover_relations",
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
    let parsed: Record<string, any> = {};

    try {
      parsed = JSON.parse(content || "{}");
    } catch (e) {
      logger.error("Failed to parse relation discovery response", e);
    }

    const discoveredRelations: DiscoveredRelation[] = [];
    const discoveredPairs = new Set<string>();

    const relations =
      parsed.discovered_relations ||
      parsed.relations ||
      parsed.suggestions ||
      [];
    for (const rel of relations) {
      const sourceGraph = graphs.find(
        (g) =>
          g.title === rel.source_graph_title ||
          g.title.toLowerCase() === rel.source_graph_title?.toLowerCase(),
      );
      const targetGraph = graphs.find(
        (g) =>
          g.title === rel.target_graph_title ||
          g.title.toLowerCase() === rel.target_graph_title?.toLowerCase(),
      );

      if (sourceGraph && targetGraph && sourceGraph.id !== targetGraph.id) {
        const pairKey = `${sourceGraph.id}-${targetGraph.id}-${rel.relation_type}`;
        const existingKey = `${sourceGraph.id}-${targetGraph.id}-${rel.relation_type}`;

        if (
          !existingRelationPairs.has(existingKey) &&
          !discoveredPairs.has(pairKey)
        ) {
          discoveredPairs.add(pairKey);
          discoveredRelations.push({
            source_graph_id: sourceGraph.id,
            source_graph_title: sourceGraph.title,
            target_graph_id: targetGraph.id,
            target_graph_title: targetGraph.title,
            relation_type: rel.relation_type || "related",
            confidence: Math.min(1, Math.max(0, rel.confidence || 0.7)),
            reason: rel.reason || rel.description || "",
            shared_concepts: rel.shared_concepts || rel.common_concepts || [],
            suggested_learning_order:
              rel.suggested_learning_order || rel.learning_order,
          });
        }
      }
    }

    const crossDomainInsights: CrossDomainInsight[] = [];
    if (includeCrossDomain && parsed.cross_domain_insights) {
      for (const insight of parsed.cross_domain_insights) {
        const relatedGraphs = graphs.filter(
          (g) =>
            insight.related_graph_titles?.some(
              (t: string) =>
                t === g.title || t.toLowerCase() === g.title.toLowerCase(),
            ) || insight.domains?.includes(g.domain || ""),
        );
        if (relatedGraphs.length >= 2) {
          crossDomainInsights.push({
            domains: insight.domains || [],
            intersection_topics:
              insight.intersection_topics || insight.shared_topics || [],
            description: insight.description || "",
            related_graph_ids: relatedGraphs.map((g) => g.id),
          });
        }
      }
    }

    const connectedGraphIds = new Set<string>();
    [...existingRelations, ...discoveredRelations].forEach((r) => {
      connectedGraphIds.add(r.source_graph_id);
      connectedGraphIds.add(r.target_graph_id);
    });

    const isolatedGraphs = graphs
      .filter((g) => !connectedGraphIds.has(g.id))
      .map((g) => g.id);

    return {
      discovered_relations: discoveredRelations.slice(0, maxSuggestions),
      cross_domain_insights: crossDomainInsights.slice(0, 10),
      analysis_summary: {
        total_graphs_analyzed: graphs.length,
        relations_discovered: discoveredRelations.length,
        cross_domain_clusters: crossDomainInsights.length,
        isolated_graphs: isolatedGraphs,
      },
      session_id: sessionId,
    };
  }

  async createRelationFromDiscovery(
    supabase: SupabaseClient,
    userId: string,
    data: CreateRelationFromDiscoveryData,
  ): Promise<{ id: string }> {
    const { data: existingGraph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("id", data.source_graph_id)
      .eq("user_id", userId)
      .single();

    if (graphError || !existingGraph) {
      throw new Error("Source graph not found or access denied");
    }

    const { data: targetGraph, error: targetError } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("id", data.target_graph_id)
      .eq("user_id", userId)
      .single();

    if (targetError || !targetGraph) {
      throw new Error("Target graph not found or access denied");
    }

    const { data: relation, error } = await supabase
      .from("graph_relations")
      .insert({
        source_graph_id: data.source_graph_id,
        target_graph_id: data.target_graph_id,
        relation_type:
          data.relation_type === "cross_domain"
            ? "related"
            : data.relation_type,
        context: data.context || null,
        metadata: {
          ...(data.metadata || {}),
          confidence: data.confidence,
          shared_concepts: data.shared_concepts,
          source: "ai_discovered",
        },
      })
      .select("id")
      .single();

    if (error) throw error;
    return { id: relation.id };
  }

  async getIntelligentSuggestions(
    supabase: SupabaseClient,
    userId: string,
    options?: { graph_ids?: string[]; session_id?: string },
  ): Promise<IntelligentSuggestion & { session_id?: string }> {
    const sessionId = options?.session_id || crypto.randomUUID();

    const discoveryResult = await this.discoverRelations(supabase, userId, {
      graph_ids: options?.graph_ids,
      max_suggestions: 30,
      include_cross_domain: true,
      session_id: sessionId,
    });

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new Error("AI provider not configured");
    }

    const systemPrompt = `你是一个学习路径规划专家。根据图谱关系分析结果，为用户推荐学习路径和知识缺口填补建议。

## 输出格式
返回JSON格式：
{
  "learning_path_suggestions": [
    {
      "path": ["图谱ID1", "图谱ID2", ...],
      "description": "学习路径描述",
      "estimated_time": "预计学习时间",
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "knowledge_gaps": [
    {
      "missing_topic": "缺失主题",
      "related_graphs": ["相关图谱ID"],
      "importance": "high|medium|low",
      "suggested_action": "create|merge|expand"
    }
  ],
  "cross_domain_opportunities": [
    {
      "domains": ["领域1", "领域2"],
      "intersection_graphs": ["图谱ID1", "图谱ID2"],
      "potential_benefits": "潜在收益描述",
      "recommended_order": ["推荐顺序的图谱ID"]
    }
  ]
}

请用中文回复。`;

    const analysisData = {
      discovered_relations: discoveryResult.discovered_relations,
      cross_domain_insights: discoveryResult.cross_domain_insights,
      summary: discoveryResult.analysis_summary,
    };

    const enrichedMetadata = await enrichMetadata(supabase, {
      userId: userId,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `基于以下图谱关系分析结果，生成智能建议：\n\n${JSON.stringify(analysisData, null, 2)}`,
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
        operation: "get_intelligent_suggestions",
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
    let parsed: IntelligentSuggestion = {
      learning_path_suggestions: [],
      knowledge_gaps: [],
      cross_domain_opportunities: [],
    };

    try {
      parsed = JSON.parse(content || "{}");
    } catch (e) {
      logger.error("Failed to parse intelligent suggestions", e);
    }

    return {
      ...parsed,
      session_id: sessionId,
    };
  }

  async analyzeCrossDomainInsights(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      graph_ids?: string[];
      min_intersection?: number;
      session_id?: string;
    },
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
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
    } else {
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
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
      throw new Error("AI provider not configured");
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
      userId: userId,
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
    for (const insight of parsed.cross_domain_insights || []) {
      if (
        insight.intersection_topics &&
        insight.intersection_topics.length >= minIntersection
      ) {
        const relatedGraphs = graphs.filter(
          (g) =>
            insight.related_graph_titles?.some(
              (t) => t === g.title || t.toLowerCase() === g.title.toLowerCase(),
            ) || insight.domains?.includes(g.domain || ""),
        );
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
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
    } else {
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
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

    const existingRelations = await this.getExistingRelations(
      supabase,
      graphs.map((g) => g.id),
    );

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      throw new Error("AI provider not configured");
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

    const relationSummaries = existingRelations.map((r) => {
      const sourceGraph = graphs.find((g) => g.id === r.source_graph_id);
      const targetGraph = graphs.find((g) => g.id === r.target_graph_id);
      return {
        from: sourceGraph?.title || r.source_graph_id,
        to: targetGraph?.title || r.target_graph_id,
        type: r.relation_type,
      };
    });

    const enrichedMetadata = await enrichMetadata(supabase, {
      userId: userId,
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

    for (const suggestion of parsed.learning_path_suggestions || []) {
      if (suggestion.path_titles && suggestion.path_titles.length >= 2) {
        if (targetDifficulty && suggestion.difficulty !== targetDifficulty) {
          continue;
        }

        const pathIds: string[] = [];
        const validTitles: string[] = [];

        for (const title of suggestion.path_titles) {
          const graph = graphs.find(
            (g) =>
              g.title === title ||
              g.title.toLowerCase() === title.toLowerCase(),
          );
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
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .in("id", graphIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
    } else {
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) throw error;
      graphs = await this.enrichGraphsWithNodeInfo(supabase, graphData || []);
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
      throw new Error("AI provider not configured");
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
      userId: userId,
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

    for (const gap of parsed.knowledge_gaps || []) {
      if (importanceOrder[gap.importance] < minImportanceLevel) {
        continue;
      }

      const relatedGraphIds: string[] = [];
      const relatedGraphTitles: string[] = [];

      for (const title of gap.related_graph_titles || []) {
        const graph = graphs.find(
          (g) =>
            g.title === title || g.title.toLowerCase() === title.toLowerCase(),
        );
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

  private async enrichGraphsWithNodeInfo(
    supabase: SupabaseClient,
    graphs: Array<{
      id: string;
      title: string;
      description: string | null;
      domain: string | null;
    }>,
  ): Promise<GraphInfo[]> {
    const graphIds = graphs.map((g) => g.id);

    const { data: graphNodes, error } = await supabase
      .from("graph_nodes")
      .select(
        `
        graph_id,
        knowledge_point_id,
        knowledge_points (
          title,
          content
        )
      `,
      )
      .in("graph_id", graphIds)
      .is("deleted_at", null);

    if (error) {
      logger.error("Failed to fetch nodes for graphs", error);
      return graphs.map((g) => ({
        ...g,
        node_count: 0,
        core_concepts: [],
      }));
    }

    const nodeMap = new Map<
      string,
      Array<{ title: string; content: string | null }>
    >();
    for (const gn of graphNodes || []) {
      const graphId = gn.graph_id;
      const kp = gn.knowledge_points as
        | { title: string; content: string | null }
        | { title: string; content: string | null }[]
        | null;
      if (!nodeMap.has(graphId)) {
        nodeMap.set(graphId, []);
      }
      if (kp && !Array.isArray(kp)) {
        nodeMap.get(graphId)!.push({ title: kp.title, content: kp.content });
      }
    }

    return graphs.map((g) => {
      const graphNodesList = nodeMap.get(g.id) || [];

      const concepts = this.extractCoreConcepts(graphNodesList);

      return {
        id: g.id,
        title: g.title,
        description: g.description,
        domain: g.domain,
        node_count: graphNodesList.length,
        core_concepts: concepts,
      };
    });
  }

  private extractCoreConcepts(
    nodes: Array<{ title: string; content: string | null }>,
  ): string[] {
    const conceptSet = new Set<string>();

    const rootAndCore = nodes.filter(
      (n) =>
        n.content?.includes("核心") ||
        n.content?.includes("基础") ||
        n.content?.includes("定义") ||
        n.content?.includes("概念"),
    );

    for (const node of rootAndCore.slice(0, 5)) {
      conceptSet.add(node.title);
    }

    for (const node of nodes.slice(0, 10)) {
      conceptSet.add(node.title);
    }

    return Array.from(conceptSet).slice(0, 10);
  }

  private async getExistingRelations(
    supabase: SupabaseClient,
    graphIds: string[],
  ): Promise<
    Array<{
      source_graph_id: string;
      target_graph_id: string;
      relation_type: string;
    }>
  > {
    if (graphIds.length === 0) return [];

    const { data, error } = await supabase
      .from("graph_relations")
      .select("source_graph_id, target_graph_id, relation_type")
      .or(
        `source_graph_id.in.(${graphIds.join(",")}),target_graph_id.in.(${graphIds.join(",")})`,
      );

    if (error) {
      logger.error("Failed to fetch existing relations", error);
      return [];
    }

    return (data || []).map((r) => ({
      source_graph_id: r.source_graph_id,
      target_graph_id: r.target_graph_id,
      relation_type: r.relation_type,
    }));
  }
}

export const relationDiscoveryService = new RelationDiscoveryService();
