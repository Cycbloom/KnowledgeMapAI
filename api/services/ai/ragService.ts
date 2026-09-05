import { getSupabaseAdmin } from "../../supabase";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";
import { buildNodeContext, NodeData } from "./utils";
import { contextWindowManager } from "./contextWindowManager";
import { notDeleted } from '../common/softDeleteHelper';
import { ragSearchService } from "./ragSearchService";
import { ragChatService } from "./ragChatService";
import { queryRewriteService } from "./queryRewriteService";

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
  /**
   * 数据源类型（P1 Task 5）：
   * - 'document'：图谱知识点（knowledge_points / document_chunks），默认值
   * - 'note'：笔记（note_embeddings 命中或 note_node_links 挂载）
   * 可选字段，向后兼容（未设置时视为 'document'）。
   */
  type?: "document" | "note";
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

  /**
   * 笔记内容语义检索（P1 Task 5.1 / 5.2）
   * 委托给 ragSearchService.noteSemanticSearch，查询 note_embeddings 表。
   * 返回结果 type='note'，与图谱检索结果合并后参与 RAG 上下文构建。
   */
  async noteSemanticSearch(
    query: string,
    userId: string,
    options: {
      matchThreshold?: number;
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    return ragSearchService.noteSemanticSearch(query, userId, options);
  }

  /**
   * 笔记稀疏检索：委托给 ragSearchService.noteSparseSearch，
   * 与 noteSemanticSearch 互补（精确术语命中），结果同样 type='note'。
   */
  async noteSparseSearch(
    query: string,
    userId: string,
    options: {
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    return ragSearchService.noteSparseSearch(query, userId, options);
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
      originalQuery?: string;
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

    // Query Rewrite：把口语化问题改写为检索友好表达，提升语义/稀疏召回命中率。
    // - 仅 hybrid/semantic 模式启用（keyword 模式依赖原文词面匹配，改写反而引入噪声）
    // - 改写失败回退原文，不阻塞检索
    // - 改写只影响检索，最终 chat 仍用用户原文
    const searchQuery =
      effectiveSearchMode === "keyword"
        ? query
        : await queryRewriteService.rewrite(query, userId);

    // P1 Task 5.2: 并行查 notes embedding（与图谱搜索并行，避免阻塞）
    // noteSemanticSearch 内部已做容错（失败返回 []），这里直接 await 即可。
    // 提前启动 promise，与下方图谱检索并行执行，降低整体延迟。
    // 笔记稀疏检索（精确术语命中）与语义检索并行，结果合并去重后互补。
    const noteResultsPromise = this.noteSemanticSearch(searchQuery, userId, {
      matchThreshold: 0.3,
      matchCount: 5,
    }).catch((err) => {
      logger.warn("RAG buildContext: noteSemanticSearch failed", { err });
      return [] as RAGSearchResult[];
    });
    const noteSparsePromise = this.noteSparseSearch(searchQuery, userId, {
      matchCount: 3,
    }).catch((err) => {
      logger.warn("RAG buildContext: noteSparseSearch failed", { err });
      return [] as RAGSearchResult[];
    });

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
        const graphResults = await this.graphAugmentedSearch(searchQuery, userId, {
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

        // 单趟遍历切分 seed/expanded，替代两次 filter（O(2n) → O(n)）
        const seedResults: GraphRAGSearchResult[] = [];
        const expandedResults: GraphRAGSearchResult[] = [];
        for (const r of graphResults) {
          if (r.hopDistance === 0) {
            seedResults.push(r);
          } else if (r.hopDistance > 0) {
            expandedResults.push(r);
          }
        }

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
        searchResults = await this.semanticSearch(searchQuery, userId, {
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
        // 语义/稀疏通道用改写后的 searchQuery；originalQuery 供 keyword 通道
        // 保留原文词面匹配（LIKE 不吃改写）
        const hybridResults = await this.hybridSearch(searchQuery, userId, {
          graphId,
          matchThreshold: 0.3,
          matchCount: 10,
          graphHops,
          originalQuery: query,
        });

        for (const r of hybridResults) {
          originalGraphMetadata.set(r.id, {
            hopDistance: r.hopDistance,
            relationshipPath: r.relationshipPath,
            relationshipType: r.relationshipType,
          });
        }

        // 单趟遍历切分 seed/expanded，替代两次 filter（O(2n) → O(n)）
        const seedResults: GraphRAGSearchResult[] = [];
        const expandedResults: GraphRAGSearchResult[] = [];
        for (const r of hybridResults) {
          if (r.hopDistance === 0) {
            seedResults.push(r);
          } else if (r.hopDistance > 0) {
            expandedResults.push(r);
          }
        }

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
        const hybridResults = await this.hybridSearch(searchQuery, userId, {
          graphId,
          matchThreshold: 0.3,
          matchCount: 10,
          originalQuery: query,
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

    // P1 Task 5.2: 等待笔记检索结果，合并到 searchResults
    // 语义命中在前，稀疏命中补充精确术语命中；同一笔记（id 重复）保留语义结果
    const [noteResults, noteSparseResults] = await Promise.all([
      noteResultsPromise,
      noteSparsePromise,
    ]);
    const seenNoteIds = new Set(noteResults.map((r) => r.id));
    const mergedNoteResults = [
      ...noteResults,
      ...noteSparseResults.filter((r) => !seenNoteIds.has(r.id)),
    ].slice(0, 5);
    if (mergedNoteResults.length > 0) {
      searchResults = [...searchResults, ...mergedNoteResults];
    }

    let currentNodeContext: string | undefined;
    // P1 Task 5.4: 当前节点挂载的笔记（note_node_links），作为确定性上下文注入
    let mountedNoteSources: { id: string; title: string; content: string }[] = [];
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

      // 查询挂载到当前节点（及相关 graph_node）的笔记
      mountedNoteSources = await this.fetchMountedNotes(
        getSupabaseAdmin(),
        userId,
        currentNodeId,
      );
    }

    const maxTokens = Math.floor(maxContextLength / 2);

    const { context, usedSources } = contextWindowManager.buildContext(
      searchResults,
      {
        maxTokens,
        currentNodeContext,
        graphSources,
        noteSources: mountedNoteSources,
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
          type: s.type,
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
        type: "document" as const,
      })),
      // P1 Task 5: 笔记数据源（语义检索命中的笔记 + 挂载笔记）
      ...noteResults.map((nr) => ({
        id: nr.id,
        title: nr.title,
        content: nr.content,
        similarity: nr.similarity,
        graphId: "",
        hopDistance: 0,
        relationshipPath: "",
        relationshipType: "",
        type: "note" as const,
      })),
      ...mountedNoteSources.map((mn) => ({
        id: mn.id,
        title: mn.title,
        content: mn.content,
        similarity: 1,
        graphId: graphId || "",
        hopDistance: 0,
        relationshipPath: "",
        relationshipType: "",
        type: "note" as const,
      })),
    ];

    return { context, sources: allSources };
  }

  /**
   * 查询挂载到当前知识点的笔记（P1 Task 5.4）。
   *
   * 流程：
   * 1. 查 graph_nodes（knowledge_point_id = currentNodeId，未软删除）→ graph_node ids
   * 2. 查 note_node_links（node_id IN graph_node ids）→ note_ids
   * 3. 查 notes（id IN note_ids，user_id = userId，未软删除）→ 笔记内容
   *
   * 使用 getSupabaseAdmin（service role，绕过 RLS），因此必须显式过滤 user_id，
   * 避免跨用户泄露笔记内容。失败时返回空数组（不阻塞主流程）。
   */
  private async fetchMountedNotes(
    supabase: import("@supabase/supabase-js").SupabaseClient,
    userId: string,
    currentNodeId: string,
  ): Promise<{ id: string; title: string; content: string }[]> {
    try {
      // 1. 查 graph_node ids（currentNodeId 是 knowledge_point_id）
      const { data: graphNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select("id")
        .eq("knowledge_point_id", currentNodeId)
      );

      if (!graphNodes || graphNodes.length === 0) {
        return [];
      }

      const nodeIds = (graphNodes as unknown as { id: string }[]).map((gn) => gn.id);

      // 2. 查 note_node_links → note_ids
      const { data: links } = await supabase
        .from("note_node_links")
        .select("note_id")
        .in("node_id", nodeIds);

      if (!links || links.length === 0) {
        return [];
      }

      const noteIds = [
        ...new Set(
          (links as unknown as { note_id: string }[]).map((l) => l.note_id),
        ),
      ];

      // 3. 查 notes（显式过滤 user_id，因为使用 admin client 绕过 RLS）
      const { data: notes } = await notDeleted(supabase
        .from("notes")
        .select("id, title, content")
        .in("id", noteIds)
        .eq("user_id", userId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(5)
      );

      if (!notes) {
        return [];
      }

      return (notes as unknown as { id: string; title: string; content: string }[]).map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
      }));
    } catch (err) {
      logger.warn("fetchMountedNotes: query failed", { userId, currentNodeId, err });
      return [];
    }
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
