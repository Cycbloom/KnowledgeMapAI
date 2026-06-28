import { getSupabaseAdmin } from "../../supabase";
import { AIService } from "./aiService";
import { getAIProviderForTask } from "./factory";
import type { AIProvider } from "@shared/types";
import { logger } from "../../utils/logger";
import { buildNodeContext, NodeData } from "./utils";
import { rerankingService } from "./rerankingService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { withAIMonitoring } from "./aiMonitor";
import { withTimeoutAndRetry, LONG_TIMEOUT } from "../../utils/retry";
import { contextWindowManager } from "./contextWindowManager";
import { promptService } from "./promptService";
import { reciprocalRankFusion, type RankedItem } from "../../utils/rrf";

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
  private aiService: AIService;
  private graphTraversal: TraversalFunction | null = null;

  setGraphTraversal(fn: TraversalFunction): void {
    this.graphTraversal = fn;
  }

  constructor() {
    this.aiService = new AIService();
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
    const { graphId, matchThreshold = 0.5, matchCount = 5 } = options;
    const candidateCount = Math.max(matchCount * 4, 20);

    const queryEmbedding = await this.aiService.generateEmbedding(query);
    if (!queryEmbedding) {
      logger.warn("Failed to generate query embedding for RAG search");
      return [];
    }

    try {
      const supabase = getSupabaseAdmin();

      let data:
        | {
            id: string;
            title: string;
            content: string | null;
            similarity: number;
          }[]
        | null = null;
      let rpcError: unknown = null;

      if (graphId) {
        const result = await supabase.rpc("match_knowledge_points_by_graph", {
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: candidateCount,
          p_user_id: userId,
          p_graph_id: graphId,
        });
        data = result.data;
        rpcError = result.error;
      } else {
        const result = await supabase.rpc("match_knowledge_points", {
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: candidateCount,
          p_user_id: userId,
        });
        data = result.data;
        rpcError = result.error;
      }

      if (rpcError || !data) {
        logger.error("Failed to perform vector search for RAG", {
          error: rpcError,
        });
        return [];
      }

      let results: RAGSearchResult[];

      if (graphId) {
        results = data.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content || "",
          similarity: row.similarity,
          graphId,
        }));
      } else {
        if (data.length === 0) {
          return [];
        }

        const kpIds = data.map((row) => row.id);
        const { data: graphNodes } = await supabase
          .from("graph_nodes")
          .select("knowledge_point_id, graph_id")
          .in("knowledge_point_id", kpIds)
          .is("deleted_at", null);

        const kpToGraphId = new Map<string, string>();
        if (graphNodes) {
          for (const gn of graphNodes as {
            knowledge_point_id: string;
            graph_id: string;
          }[]) {
            if (!kpToGraphId.has(gn.knowledge_point_id)) {
              kpToGraphId.set(gn.knowledge_point_id, gn.graph_id);
            }
          }
        }

        results = data.map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content || "",
          similarity: row.similarity,
          graphId: kpToGraphId.get(row.id) || "",
        }));
      }

      if (results.length > 1) {
        try {
          const rerankResults = await rerankingService.rerank(
            query,
            results.map((r) => ({
              id: r.id,
              content: `${r.title}: ${r.content}`,
            })),
            { topN: matchCount },
          );
          if (rerankResults.length > 0) {
            const resultMap = new Map(results.map((r) => [r.id, r]));
            results = rerankResults
              .map((rr) => {
                const original = resultMap.get(rr.id);
                if (!original) return null;
                return { ...original, similarity: rr.relevanceScore };
              })
              .filter((r): r is RAGSearchResult => r !== null);
          }
        } catch {
          // fall back to original pgvector ordering
        }
      }

      return results.slice(0, matchCount);
    } catch (err) {
      logger.error("RAG semantic search error", { err });
      return [];
    }
  }

  /**
   * 转义 like 模式中的特殊字符（%_\）
   */
  private escapePattern(pattern: string): string {
    return pattern.replace(/[%_\\]/g, "\\$&");
  }

  /**
   * 转义 PostgREST 过滤器值中的特殊字符（" 和 \）
   * PostgREST 使用双引号包裹值来避免语法歧义，需转义值内的双引号和反斜杠
   */
  private escapePostgrestValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /**
   * 关键词检索：基于 like 模糊匹配在 knowledge_points 表中搜索
   */
  async keywordSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    const { graphId, matchCount = 10 } = options;

    try {
      const supabase = getSupabaseAdmin();
      const escapedQuery = this.escapePattern(query);
      const pattern = `%${escapedQuery}%`;
      const safePattern = this.escapePostgrestValue(pattern);

      // 在 knowledge_points 表中搜索，条件为 title 或 content 模糊匹配
      // 使用 like（而非 ilike）以利用 12_indexes.sql 中的 pg_trgm GIN 索引
      // （idx_knowledge_points_title_trgm / idx_knowledge_points_content_trgm 仅在 LIKE/~ 操作符下生效）
      // 使用双引号包裹值避免 PostgREST 过滤器语法注入
      const { data: knowledgePoints, error: kpError } = await supabase
        .from("knowledge_points")
        .select("id, title, content")
        .eq("owner_id", userId)
        .or(`title.like."${safePattern}",content.like."${safePattern}"`);

      if (kpError) {
        logger.error("关键词检索 knowledge_points 失败", { error: kpError });
        return [];
      }

      if (!knowledgePoints || knowledgePoints.length === 0) {
        return [];
      }

      // 计算匹配评分：title 匹配权重 0.9，content 匹配权重 0.6，两者都匹配取最大值
      const scoredResults = knowledgePoints.map((kp) => {
        const titleMatch = kp.title
          .toLowerCase()
          .includes(query.toLowerCase());
        const contentMatch = kp.content
          ? kp.content.toLowerCase().includes(query.toLowerCase())
          : false;

        let similarity = 0;
        if (titleMatch && contentMatch) {
          similarity = Math.max(0.9, 0.6);
        } else if (titleMatch) {
          similarity = 0.9;
        } else if (contentMatch) {
          similarity = 0.6;
        }

        return {
          id: kp.id,
          title: kp.title,
          content: kp.content || "",
          similarity,
        };
      });

      // 如果指定了 graphId，通过 graph_nodes 表关联过滤
      if (graphId) {
        const kpIds = scoredResults.map((r) => r.id);
        const { data: graphNodes, error: gnError } = await supabase
          .from("graph_nodes")
          .select("knowledge_point_id")
          .eq("graph_id", graphId)
          .in("knowledge_point_id", kpIds)
          .is("deleted_at", null);

        if (gnError) {
          logger.error("关键词检索 graph_nodes 过滤失败", { error: gnError });
          return [];
        }

        const validKpIds = new Set(
          (graphNodes || []).map(
            (gn: { knowledge_point_id: string }) => gn.knowledge_point_id,
          ),
        );

        return scoredResults
          .filter((r) => validKpIds.has(r.id))
          .map((r) => ({ ...r, graphId }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, matchCount);
      }

      // 未指定 graphId 时，查询每个知识点所属的图谱
      const kpIds = scoredResults.map((r) => r.id);
      const { data: graphNodes } = await supabase
        .from("graph_nodes")
        .select("knowledge_point_id, graph_id")
        .in("knowledge_point_id", kpIds)
        .is("deleted_at", null);

      const kpToGraphId = new Map<string, string>();
      if (graphNodes) {
        for (const gn of graphNodes as {
          knowledge_point_id: string;
          graph_id: string;
        }[]) {
          if (!kpToGraphId.has(gn.knowledge_point_id)) {
            kpToGraphId.set(gn.knowledge_point_id, gn.graph_id);
          }
        }
      }

      return scoredResults
        .map((r) => ({
          ...r,
          graphId: kpToGraphId.get(r.id) || "",
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, matchCount);
    } catch (err) {
      logger.error("关键词检索错误", { err });
      return [];
    }
  }

  /**
   * 混合检索：并行执行向量检索 + 关键词检索 + 图遍历，使用 RRF 融合排序
   */
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
    const {
      graphId,
      matchThreshold = 0.5,
      matchCount = 10,
      graphHops,
      relationshipTypes,
    } = options;

    // 并行执行向量检索和关键词检索
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, userId, {
        graphId,
        matchThreshold,
        matchCount,
      }),
      this.keywordSearch(query, userId, {
        graphId,
        matchCount,
      }),
    ]);

    // 构建原始数据映射，用于后续还原 hopDistance、relationshipPath、relationshipType
    const originalDataMap = new Map<
      string,
      {
        hopDistance: number;
        relationshipPath: string;
        relationshipType: string;
        graphId: string;
        title: string;
        content: string;
        similarity: number;
      }
    >();

    // 向量检索路：按 similarity 降序排列，score = similarity
    const semanticRanked: RankedItem<{
      hopDistance: number;
      relationshipPath: string;
      relationshipType: string;
      graphId: string;
      title: string;
      content: string;
      similarity: number;
    }>[] = semanticResults
      .sort((a, b) => b.similarity - a.similarity)
      .map((r) => {
        const data = {
          hopDistance: 0,
          relationshipPath: "",
          relationshipType: "",
          graphId: r.graphId,
          title: r.title,
          content: r.content,
          similarity: r.similarity,
        };
        originalDataMap.set(r.id, data);
        return { id: r.id, score: r.similarity, data };
      });

    // 关键词检索路：按 similarity 降序排列，score = similarity
    const keywordRanked: RankedItem<{
      hopDistance: number;
      relationshipPath: string;
      relationshipType: string;
      graphId: string;
      title: string;
      content: string;
      similarity: number;
    }>[] = keywordResults
      .sort((a, b) => b.similarity - a.similarity)
      .map((r) => {
        const existing = originalDataMap.get(r.id);
        const data = {
          hopDistance: existing?.hopDistance ?? 0,
          relationshipPath: existing?.relationshipPath ?? "",
          relationshipType: existing?.relationshipType ?? "",
          graphId: r.graphId,
          title: r.title,
          content: r.content,
          similarity: r.similarity,
        };
        // 关键词检索的结果可能没有图谱关联信息，不覆盖已有的
        if (!originalDataMap.has(r.id)) {
          originalDataMap.set(r.id, data);
        }
        return { id: r.id, score: r.similarity, data };
      });

    const rankedLists: RankedItem<{
      hopDistance: number;
      relationshipPath: string;
      relationshipType: string;
      graphId: string;
      title: string;
      content: string;
      similarity: number;
    }>[][] = [semanticRanked, keywordRanked];

    // 当 graphId 指定且 graphTraversal 已配置时，额外并行执行图遍历
    if (graphId && this.graphTraversal) {
      try {
        const supabase = getSupabaseAdmin();
        // 合并向量检索和关键词检索的 ID 作为图遍历的种子节点
        const seedIds = [
          ...new Set([
            ...semanticResults.map((r) => r.id),
            ...keywordResults.map((r) => r.id),
          ]),
        ];

        if (seedIds.length > 0) {
          const traversalResults = await this.graphTraversal(
            supabase,
            graphId,
            seedIds,
            graphHops ?? 1,
            relationshipTypes,
          );

          // 图遍历路：按 hopDistance 升序排列，score = 1 / (1 + hopDistance)
          const traversalRanked: RankedItem<{
            hopDistance: number;
            relationshipPath: string;
            relationshipType: string;
            graphId: string;
            title: string;
            content: string;
            similarity: number;
          }>[] = traversalResults
            .sort((a, b) => a.hopDistance - b.hopDistance)
            .map((node) => {
              const data = {
                hopDistance: node.hopDistance,
                relationshipPath: node.relationshipPath,
                relationshipType: node.relationshipType,
                graphId,
                title: node.title,
                content: node.content,
                similarity: 0,
              };
              if (!originalDataMap.has(node.knowledgePointId)) {
                originalDataMap.set(node.knowledgePointId, data);
              }
              return {
                id: node.knowledgePointId,
                score: 1 / (1 + node.hopDistance),
                data,
              };
            });

          rankedLists.push(traversalRanked);
        }
      } catch (err) {
        logger.error("混合检索图遍历失败", { err });
      }
    }

    // 使用 RRF 融合排序
    const fusedResults = reciprocalRankFusion(rankedLists);

    // 将融合结果转换回 GraphRAGSearchResult 格式
    return fusedResults.slice(0, matchCount).map((item) => {
      const original = originalDataMap.get(item.id);
      return {
        id: item.id,
        title: item.data.title,
        content: item.data.content,
        similarity: item.data.similarity,
        graphId: item.data.graphId,
        hopDistance: original?.hopDistance ?? item.data.hopDistance,
        relationshipPath:
          original?.relationshipPath ?? item.data.relationshipPath,
        relationshipType:
          original?.relationshipType ?? item.data.relationshipType,
      };
    });
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
    const {
      graphId,
      matchThreshold,
      matchCount,
      graphHops,
      relationshipTypes,
      useRrf = true,
    } = options;

    const searchResults = await this.semanticSearch(query, userId, {
      graphId,
      matchThreshold,
      matchCount,
    });

    if (searchResults.length === 0 || !graphId) {
      return searchResults.map((r) => ({
        ...r,
        hopDistance: 0,
        relationshipPath: "",
        relationshipType: "",
      }));
    }

    const seedIds = searchResults.map((r) => r.id);

    try {
      const supabase = getSupabaseAdmin();
      if (!this.graphTraversal) {
        logger.warn("Graph traversal not configured, skipping graph-augmented search");
        return searchResults.map((r) => ({
          ...r,
          hopDistance: 0,
          relationshipPath: "",
          relationshipType: "",
        }));
      }
      const expandedNodes = await this.graphTraversal(
        supabase,
        graphId,
        seedIds,
        graphHops ?? 1,
        relationshipTypes,
      );

      const seedIdSet = new Set(seedIds);
      const filteredExpanded = expandedNodes.filter(
        (node) => !seedIdSet.has(node.knowledgePointId),
      );

      // 种子节点作为向量检索路参与 RRF（按 similarity 降序）
      const seedRanked: RankedItem<GraphRAGSearchResult>[] = searchResults
        .sort((a, b) => b.similarity - a.similarity)
        .map((r) => ({
          id: r.id,
          score: r.similarity,
          data: {
            ...r,
            hopDistance: 0,
            relationshipPath: "",
            relationshipType: "",
          },
        }));

      // 扩展节点作为图遍历路参与 RRF（按 hopDistance 升序，score = 1 / (1 + hopDistance)）
      const expandedRanked: RankedItem<GraphRAGSearchResult>[] = filteredExpanded
        .sort((a, b) => a.hopDistance - b.hopDistance)
        .map((node) => ({
          id: node.knowledgePointId,
          score: 1 / (1 + node.hopDistance),
          data: {
            id: node.knowledgePointId,
            title: node.title,
            content: node.content,
            similarity: 0,
            graphId,
            hopDistance: node.hopDistance,
            relationshipPath: node.relationshipPath,
            relationshipType: node.relationshipType,
          },
        }));

      // 使用 RRF 融合排序或原始拼接
      if (useRrf) {
        const fusedResults = reciprocalRankFusion([seedRanked, expandedRanked]);
        return fusedResults.map((item) => item.data);
      }

      // 向后兼容：原始拼接逻辑（种子节点在前，扩展节点在后）
      const seedResults: GraphRAGSearchResult[] = searchResults
        .sort((a, b) => b.similarity - a.similarity)
        .map((r) => ({
          ...r,
          hopDistance: 0,
          relationshipPath: "",
          relationshipType: "",
        }));
      const expandedResults: GraphRAGSearchResult[] = filteredExpanded
        .sort((a, b) => {
          if (a.hopDistance !== b.hopDistance) {
            return a.hopDistance - b.hopDistance;
          }
          return a.relationshipPath.localeCompare(b.relationshipPath);
        })
        .map((node) => ({
          id: node.knowledgePointId,
          title: node.title,
          content: node.content,
          similarity: 0,
          graphId,
          hopDistance: node.hopDistance,
          relationshipPath: node.relationshipPath,
          relationshipType: node.relationshipType,
        }));

      return [...seedResults, ...expandedResults];
    } catch (err) {
      logger.error("Graph augmented search error", { err });
      return searchResults.map((r) => ({
        ...r,
        hopDistance: 0,
        relationshipPath: "",
        relationshipType: "",
      }));
    }
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
        searchResults = hybridResults;
      }
    }

    let currentNodeContext: string | undefined;
    if (currentNodeId) {
      const { data: currentGraphNode } = await getSupabaseAdmin()
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
        .is("deleted_at", null)
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
      ...usedSources.map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        similarity: s.similarity,
        graphId: s.graphId,
        hopDistance: 0,
        relationshipPath: "",
        relationshipType: "",
      })),
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
    const {
      graphId,
      currentNodeId,
      history = [],
      model,
      language,
      useGraphContext,
      graphHops,
      searchMode,
    } = options;

    const { context, sources } = await this.buildContext(message, userId, {
      graphId,
      currentNodeId,
      useGraphContext,
      graphHops,
      searchMode,
    });

    const aiProvider = await getAIProviderForTask("text");

    if (!aiProvider.hasKey) {
      return {
        answer: `[模拟回复] 我收到了你的问题: "${message}"。这是一个模拟回复，因为后端没有配置 API Key。`,
        sources: sources.slice(0, 3),
        suggestedQuestions: [
          "这个知识点的核心概念是什么？",
          "有哪些相关的知识点？",
          "如何应用这个知识？",
        ],
      };
    }

    const isEnglish =
      language === "en-US" ||
      language === "en" ||
      (language && language.startsWith("en"));
    const languageInstruction = isEnglish
      ? "Please respond in English."
      : "请用中文回答";

    const graphContextHint =
      useGraphContext && graphId && context.includes("[图谱关联节点]")
        ? `\n\n重要提示：以下知识上下文中包含通过图谱关系发现的关联节点（标记为"图谱关联"）。这些节点之间存在图谱关系路径，请利用这些关系进行推理和解释，帮助用户理解知识之间的深层联系。\n`
        : "";

    const supabase = getSupabaseAdmin();
    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "rag_chat",
      {
        context: context || "(暂无相关上下文)",
        languageInstruction,
        graphContextHint,
      },
      undefined,
      graphId,
      language,
    );

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    try {
      const completion = await withAIMonitoring(
        {
          operation: "rag_chat",
          provider: aiProvider.providerType,
          model: model || aiProvider.model,
          sessionId: options.sessionId,
          metadata: {
            graphId,
            userId,
            currentNodeId,
            searchMode,
          },
        },
        async () => {
          const result = await withTimeoutAndRetry(
            () =>
              aiProvider.client.chat.completions.create({
                messages,
                model: model || aiProvider.model,
                temperature: 0.7,
                max_tokens: 2000,
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 3,
              initialDelay: 1000,
              maxDelay: 10000,
            },
          );

          return {
            result,
            usage: result.usage ?? undefined,
          };
        },
      );

      const answer = completion.choices[0].message.content || "";

      const suggestedQuestions = await this.generateSuggestedQuestions(
        message,
        answer,
        sources,
        aiProvider,
        model,
      );

      return {
        answer,
        sources: sources.slice(0, 5),
        suggestedQuestions,
      };
    } catch (error: unknown) {
      logger.error("RAG Chat Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: error instanceof Error ? error.message : "RAG chat failed",
      });
    }
  }

  private async generateSuggestedQuestions(
    originalQuestion: string,
    answer: string,
    sources: RAGSearchResult[],
    provider: AIProvider,
    model?: string,
  ): Promise<string[]> {
    if (sources.length === 0) {
      return [
        "这个知识点的核心概念是什么？",
        "有哪些相关的知识点？",
        "如何应用这个知识？",
      ];
    }

    try {
      const sourceTitles = sources
        .slice(0, 3)
        .map((s) => s.title)
        .join(", ");

      const completion = await withAIMonitoring(
        {
          operation: "rag_suggest_questions",
          provider: provider.providerType,
          model: model || provider.model,
        },
        async () => {
          const result = await provider.client.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `基于用户的原始问题和回答，生成 2-3 个相关的后续问题。
这些问题应该：
1. 帮助用户深入理解当前话题
2. 探索相关的知识节点
3. 具有启发性和探索性

返回 JSON 格式: { "questions": ["问题1", "问题2", "问题3"] }`,
              },
              {
                role: "user",
                content: `原始问题: ${originalQuestion}\n\n回答摘要: ${answer.substring(0, 500)}\n\n相关节点: ${sourceTitles}`,
              },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 200,
          });

          return {
            result,
            usage: result.usage ?? undefined,
          };
        },
      );

      const content =
        completion.choices[0].message.content || '{"questions": []}';
      const parsed = JSON.parse(content);
      return parsed.questions || [];
    } catch {
      return ["这个知识点的核心概念是什么？", "有哪些相关的知识点？"];
    }
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
    const {
      graphId,
      currentNodeId,
      history = [],
      model,
      language,
      useGraphContext,
      graphHops,
      searchMode,
    } = options;

    const { context, sources } = await this.buildContext(message, userId, {
      graphId,
      currentNodeId,
      useGraphContext,
      graphHops,
      searchMode,
    });

    const aiProvider = await getAIProviderForTask("text");

    if (!aiProvider.hasKey) {
      const mockResponse = `[模拟回复] 我收到了你的问题: "${message}"。这是一个模拟回复，因为后端没有配置 API Key。`;
      for (const char of mockResponse) {
        onChunk(char);
        await new Promise((r) => setTimeout(r, 20));
      }
      return sources.slice(0, 3);
    }

    const isEnglish =
      language === "en-US" ||
      language === "en" ||
      (language && language.startsWith("en"));
    const languageInstruction = isEnglish
      ? "Please respond in English."
      : "请用中文回答";

    const graphContextHint =
      useGraphContext && graphId && context.includes("[图谱关联节点]")
        ? `\n\n重要提示：以下知识上下文中包含通过图谱关系发现的关联节点（标记为"图谱关联"）。这些节点之间存在图谱关系路径，请利用这些关系进行推理和解释，帮助用户理解知识之间的深层联系。\n`
        : "";

    const supabase = getSupabaseAdmin();
    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "rag_chat",
      {
        context: context || "(暂无相关上下文)",
        languageInstruction,
        graphContextHint,
      },
      undefined,
      graphId,
      language,
    );

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    try {
      await withAIMonitoring(
        {
          operation: "rag_stream_chat",
          provider: aiProvider.providerType,
          model: model || aiProvider.model,
          sessionId: options.sessionId,
          metadata: {
            graphId,
            userId,
            currentNodeId,
            searchMode,
          },
        },
        async () => {
          const stream = await aiProvider.client.chat.completions.create({
            messages,
            model: model || aiProvider.model,
            temperature: 0.7,
            max_tokens: 2000,
            stream: true,
            stream_options: { include_usage: true },
          });

          let promptTokens = 0;
          let completionTokens = 0;
          let cachedTokens = 0;

          try {
            // 最后一个 chunk 携带 usage；持续覆盖以保留最终值
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                onChunk(content);
              }
              if (chunk.usage) {
                promptTokens = chunk.usage.prompt_tokens || 0;
                completionTokens = chunk.usage.completion_tokens || 0;
                cachedTokens =
                  chunk.usage.prompt_tokens_details?.cached_tokens || 0;
              }
            }
          } catch (error: unknown) {
            // 已发送的 chunks 无法撤回：停止发送，向上抛错以触发 success: false 上报
            const err = error as Error;
            logger.error(
              `RAG stream chat chunk iteration failed: ${err.message}`,
            );
            throw error;
          }

          return {
            result: undefined,
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              prompt_tokens_details: { cached_tokens: cachedTokens },
            },
          };
        },
      );

      return sources.slice(0, 5);
    } catch (error: unknown) {
      logger.error("RAG Stream Chat Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message:
          error instanceof Error ? error.message : "RAG stream chat failed",
      });
    }
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
    const { data: graphNodes } = await getSupabaseAdmin()
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
      .is("deleted_at", null);

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

    const { data: edges } = await getSupabaseAdmin()
      .from("edges")
      .select("source_knowledge_point_id, target_knowledge_point_id")
      .eq("graph_id", graphId)
      .is("deleted_at", null);

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
