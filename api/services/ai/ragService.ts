import { getSupabaseAdmin } from "../../supabase";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";
import { buildNodeContext, NodeData } from "./utils";
import { contextWindowManager } from "./contextWindowManager";
import { notDeleted } from '../common/softDeleteHelper';
import { ragSearchService } from "./ragSearchService";
import { ragChatService } from "./ragChatService";

interface GraphNodeWithKnowledge {
  knowledge_point_id: string;
  level: string;
  knowledge_points:
    | {
        id: string;
        title: string;
        content: string | null;
      }
    | {
        id: string;
        title: string;
        content: string | null;
      }[];
}

interface EdgeRow {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
}

interface NodeInfo {
  id: string;
  title: string;
  content: string;
  level: string;
}

export interface RAGContext {
  graphId: string;
  userId: string;
  nodeId?: string;
  nodeTitle?: string;
  nodeContent?: string;
}

export interface RAGSearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  graphId: string;
}

export interface GraphRAGSearchResult extends RAGSearchResult {
  hopDistance: number;
  relationshipPath: string;
  relationshipType: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSearchResult[];
  suggestedQuestions?: string[];
}

export interface TraversalResult {
  knowledgePointId: string;
  title: string;
  content: string;
  hopDistance: number;
  relationshipPath: string;
  relationshipType: string;
}

export type TraversalFunction = (
  supabase: import("@supabase/supabase-js").SupabaseClient,
  graphId: string,
  sourceKpIds: string[],
  maxHops?: number,
  relationshipTypes?: string[],
) => Promise<TraversalResult[]>;

export class RAGService {

  setGraphTraversal(fn: TraversalFunction): void {
    ragSearchService.setGraphTraversal(fn);
  }

  async semanticSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchThreshold?: number;
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    return ragSearchService.semanticSearch(query, userId, options);
  }

  async keywordSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    return ragSearchService.keywordSearch(query, userId, options);
  }

  async hybridSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchThreshold?: number;
      matchCount?: number;
      graphHops?: number;
      relationshipTypes?: string[];
    } = {},
  ): Promise<GraphRAGSearchResult[]> {
    return ragSearchService.hybridSearch(query, userId, options);
  }

  async graphAugmentedSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchThreshold?: number;
      matchCount?: number;
      graphHops?: number;
      relationshipTypes?: string[];
      useRrf?: boolean;
    } = {},
  ): Promise<GraphRAGSearchResult[]> {
    return ragSearchService.graphAugmentedSearch(query, userId, options);
  }

  async buildContext(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      currentNodeId?: string;
      maxContextLength?: number;
      useGraphContext?: boolean;
      graphHops?: number;
      searchMode?: "semantic" | "keyword" | "hybrid";
    } = {},
  ): Promise<{ context: string; sources: RAGSearchResult[] }> {
    const {
      graphId,
      currentNodeId,
      maxContextLength = 8000,
      useGraphContext,
      graphHops,
      searchMode,
    } = options;

    // 默认使用 hybrid 模式
    const effectiveSearchMode = searchMode ?? "hybrid";

    let searchResults: RAGSearchResult[];
    let graphSources:
      | {
          id: string;
          title: string;
          content: string;
          hopDistance: number;
          relationshipPath: string;
          relationshipType: string;
        }[]
      | undefined;

    // 保留所有搜索结果的原始图关联信息，用于在构建 allSources 时还原 hopDistance
    const originalGraphMetadata = new Map<
      string,
      { hopDistance: number; relationshipPath: string; relationshipType: string }
    >();

    if (effectiveSearchMode === "semantic") {
      // 语义检索模式：保持原有逻辑（向后兼容）
      if (useGraphContext && graphId) {
        const graphResults = await this.graphAugmentedSearch(query, userId, {
          graphId,
          matchThreshold: 0.3,
          matchCount: 10,
          graphHops,
          useRrf: false, // semantic 模式保持原始拼接逻辑，确保向后兼容
        });

        for (const r of graphResults) {
          originalGraphMetadata.set(r.id, {
            hopDistance: r.hopDistance,
            relationshipPath: r.relationshipPath,
            relationshipType: r.relationshipType,
          });
        }

        const seedResults = graphResults.filter((r) => r.hopDistance === 0);
        const expandedResults = graphResults.filter((r) => r.hopDistance > 0);

        searchResults = seedResults;
        graphSources = expandedResults.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          hopDistance: r.hopDistance,
          relationshipPath: r.relationshipPath,
          relationshipType: r.relationshipType,
        }));
      } else {
        searchResults = await this.semanticSearch(query, userId, {
          graphId,
          matchThreshold: 0.3,
          matchCount: 10,
        });
      }
    } else if (effectiveSearchMode === "keyword") {
      // 关键词检索模式
      searchResults = await this.keywordSearch(query, userId, {
        graphId,
        matchCount: 10,
      });
    } else {
      // 混合检索模式（hybrid，默认）
      if (useGraphContext && graphId) {
        // 有图谱上下文时，使用 hybridSearch 获取结果，分离种子节点和扩展节点
        const hybridResults = await this.hybridSearch(query, userId, {
          graphId,
          matchThreshold: 0.3,
          matchCount: 10,
          graphHops,
        });

        for (const r of hybridResults) {
          originalGraphMetadata.set(r.id, {
            hopDistance: r.hopDistance,
            relationshipPath: r.relationshipPath,
            relationshipType: r.relationshipType,
          });
        }

        const seedResults = hybridResults.filter((r) => r.hopDistance === 0);
        const expandedResults = hybridResults.filter((r) => r.hopDistance > 0);

        searchResults = seedResults;
        graphSources = expandedResults.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          hopDistance: r.hopDistance,
          relationshipPath: r.relationshipPath,
          relationshipType: r.relationshipType,
        }));
      } else {
        // 无图谱上下文时，使用 hybridSearch，graphSources 为 undefined
        const hybridResults = await this.hybridSearch(query, userId, {
          graphId,
          matchThreshold: 0.3,
          matchCount: 10,
        });

        // hybridSearch 可能返回含图关联信息的结果，保留原始数据
        for (const r of hybridResults) {
          originalGraphMetadata.set(r.id, {
            hopDistance: r.hopDistance,
            relationshipPath: r.relationshipPath,
            relationshipType: r.relationshipType,
          });
        }

        searchResults = hybridResults;
      }
    }

    let currentNodeContext: string | undefined;
    if (currentNodeId) {
      const { data: currentGraphNode } = await notDeleted(getSupabaseAdmin()
        .from("graph_nodes")
        .select(
          `
          knowledge_point_id,
          knowledge_points (
            id,
            title,
            content
          )
        `,
        )
        .eq("knowledge_point_id", currentNodeId)
        )
        .single();

      if (currentGraphNode) {
        const kp = Array.isArray(currentGraphNode.knowledge_points)
          ? currentGraphNode.knowledge_points[0]
          : currentGraphNode.knowledge_points;
        const nodeData: NodeData = {
          title: kp?.title || "",
          content: kp?.content || "",
        };
        currentNodeContext = buildNodeContext(nodeData, {
          maxContentLength: 1000,
        });
      }
    }

    const maxTokens = Math.floor(maxContextLength / 2);

    const { context, usedSources } = contextWindowManager.buildContext(
      searchResults,
      {
        maxTokens,
        currentNodeContext,
        graphSources,
      },
    );

    const allSources: GraphRAGSearchResult[] = [
      ...usedSources.map((s) => {
        const original = originalGraphMetadata.get(s.id);
        return {
          id: s.id,
          title: s.title,
          content: s.content,
          similarity: s.similarity,
          graphId: s.graphId,
          hopDistance: original?.hopDistance ?? 0,
          relationshipPath: original?.relationshipPath ?? "",
          relationshipType: original?.relationshipType ?? "",
        };
      }),
      ...(graphSources || []).map((gs) => ({
        id: gs.id,
        title: gs.title,
        content: gs.content,
        similarity: 0,
        graphId: graphId || "",
        hopDistance: gs.hopDistance,
        relationshipPath: gs.relationshipPath,
        relationshipType: gs.relationshipType,
      })),
    ];

    return { context, sources: allSources };
  }

  async chat(
    message: string,
    userId: string,
    options: {
      graphId?: string;
      currentNodeId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      sessionId?: string;
      useGraphContext?: boolean;
      graphHops?: number;
      searchMode?: "semantic" | "keyword" | "hybrid";
    } = {},
  ): Promise<RAGResponse> {
    return ragChatService.chat(
      message,
      userId,
      () => this.buildContext(message, userId, {
        graphId: options.graphId,
        currentNodeId: options.currentNodeId,
        useGraphContext: options.useGraphContext,
        graphHops: options.graphHops,
        searchMode: options.searchMode,
      }),
      options,
    );
  }

  async streamChat(
    message: string,
    userId: string,
    onChunk: (content: string) => void,
    options: {
      graphId?: string;
      currentNodeId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      sessionId?: string;
      useGraphContext?: boolean;
      graphHops?: number;
      searchMode?: "semantic" | "keyword" | "hybrid";
    } = {},
  ): Promise<RAGSearchResult[]> {
    return ragChatService.streamChat(
      message,
      userId,
      onChunk,
      () => this.buildContext(message, userId, {
        graphId: options.graphId,
        currentNodeId: options.currentNodeId,
        useGraphContext: options.useGraphContext,
        graphHops: options.graphHops,
        searchMode: options.searchMode,
      }),
      options,
    );
  }

  async analyzeKnowledgeGaps(
    graphId: string,
    _userId: string,
  ): Promise<{
    gaps: Array<{
      topic: string;
      reason: string;
      priority: "high" | "medium" | "low";
    }>;
    suggestions: string[];
  }> {
    const { data: graphNodes } = await notDeleted(getSupabaseAdmin()
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `,
      )
      .eq("graph_id", graphId)
      );

    if (!graphNodes || graphNodes.length === 0) {
      return { gaps: [], suggestions: [] };
    }

    const nodes = (graphNodes as GraphNodeWithKnowledge[]).map((gn) => {
      const kp = Array.isArray(gn.knowledge_points)
        ? gn.knowledge_points[0]
        : gn.knowledge_points;
      return {
        id: kp?.id || gn.knowledge_point_id,
        title: kp?.title || "",
        content: kp?.content || "",
        level: gn.level,
      } as NodeInfo;
    });

    const { data: edges } = await notDeleted(getSupabaseAdmin()
      .from("edges")
      .select("source_knowledge_point_id, target_knowledge_point_id")
      .eq("graph_id", graphId)
      );

    const connectedNodes = new Set<string>();

    if (edges) {
      (edges as EdgeRow[]).forEach((e) => {
        connectedNodes.add(e.source_knowledge_point_id);
        connectedNodes.add(e.target_knowledge_point_id);
      });
    }

    const isolatedNodes = nodes.filter((n) => !connectedNodes.has(n.id));
    const nodesWithoutContent = nodes.filter(
      (n) => !n.content || n.content.length < 50,
    );

    const gaps: Array<{
      topic: string;
      reason: string;
      priority: "high" | "medium" | "low";
    }> = [];

    isolatedNodes.forEach((n) => {
      gaps.push({
        topic: n.title,
        reason: "该节点没有与其他节点建立连接",
        priority: "medium",
      });
    });

    nodesWithoutContent.forEach((n) => {
      gaps.push({
        topic: n.title,
        reason: "该节点缺少详细内容描述",
        priority: "high",
      });
    });

    const aiProvider = await getAIProviderForTask("text");
    let suggestions: string[] = [];

    if (aiProvider.hasKey && nodes.length > 3) {
      try {
        const nodeTitles = nodes.map((n) => n.title).join(", ");

        const completion = await aiProvider.client.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `你是一个知识图谱分析专家。分析给定的知识节点列表，找出可能缺失的知识领域或概念。

返回 JSON 格式: { "suggestions": ["建议1", "建议2", "建议3"] }

每个建议应该是一个简短的知识领域或概念名称。`,
            },
            {
              role: "user",
              content: `当前知识图谱包含以下节点：\n${nodeTitles}\n\n请分析可能缺失的知识领域。`,
            },
          ],
          model: aiProvider.model,
          response_format: { type: "json_object" },
          max_tokens: 300,
        });

        const content =
          completion.choices[0].message.content || '{"suggestions": []}';
        const parsed = JSON.parse(content);
        suggestions = parsed.suggestions || [];
      } catch (err) {
        logger.error("Failed to generate knowledge gap suggestions", { err });
      }
    }

    return { gaps, suggestions };
  }

  async search(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchThreshold?: number;
      matchCount?: number;
      useGraphContext?: boolean;
      graphHops?: number;
      searchMode?: "semantic" | "keyword" | "hybrid";
    } = {},
  ): Promise<RAGSearchResult[]> {
    const {
      graphId,
      matchThreshold,
      matchCount,
      useGraphContext,
      graphHops,
      searchMode,
    } = options;

    // 默认使用 hybrid 模式
    const effectiveSearchMode = searchMode ?? "hybrid";

    if (effectiveSearchMode === "semantic") {
      if (useGraphContext && graphId) {
        return this.graphAugmentedSearch(query, userId, {
          graphId,
          matchThreshold,
          matchCount,
          graphHops,
          useRrf: false, // semantic 模式保持原始拼接逻辑，确保向后兼容
        });
      }
      return this.semanticSearch(query, userId, {
        graphId,
        matchThreshold,
        matchCount,
      });
    }

    if (effectiveSearchMode === "keyword") {
      return this.keywordSearch(query, userId, {
        graphId,
        matchCount,
      });
    }

    // hybrid 模式
    return this.hybridSearch(query, userId, {
      graphId,
      matchThreshold,
      matchCount,
      graphHops,
    });
  }
}

export const ragService = new RAGService();
