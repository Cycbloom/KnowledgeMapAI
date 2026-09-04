import { getSupabaseAdmin } from "../../supabase";
import { AIService } from "./aiService";
import { logger } from "../../utils/logger";
import { rerankingService } from "./rerankingService";
import { reciprocalRankFusion, type RankedItem } from "../../utils/rrf";
import { serializeSparse } from "../../utils/sparse";
import { notDeleted } from '../common/softDeleteHelper';
import type { TraversalFunction, RAGSearchResult, GraphRAGSearchResult } from "./ragService";

export class RAGSearchService {
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
        const { data: graphNodes } = await notDeleted(supabase
          .from("graph_nodes")
          .select("knowledge_point_id, graph_id")
          .in("knowledge_point_id", kpIds)
          );

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
   * 笔记内容语义检索（P1 Task 5.1）
   *
   * 查询 note_embeddings 表做向量检索，返回与查询语义相关的笔记片段。
   * - 数据源类型标记为 type='note'，与 graph knowledge_points (type='document') 区分
   * - 单笔记单 embedding（note_embeddings.note_id UNIQUE），结果 id 即 note_id，
   *   便于前端跳转到 /notes/:noteId
   * - 内部调用 rerankingService 重排序（与 semanticSearch 风格一致），
   *   rerank 失败时回退到 pgvector 原始排序
   * - 不支持 graphId 过滤（笔记不绑定特定图谱）
   */
  async noteSemanticSearch(
    query: string,
    userId: string,
    options: {
      matchThreshold?: number;
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    const { matchThreshold = 0.5, matchCount = 5 } = options;
    const candidateCount = Math.max(matchCount * 4, 20);

    const queryEmbedding = await this.aiService.generateEmbedding(query);
    if (!queryEmbedding) {
      logger.warn("Failed to generate query embedding for note RAG search");
      return [];
    }

    try {
      const supabase = getSupabaseAdmin();

      const result = await supabase.rpc("match_notes", {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: candidateCount,
        p_user_id: userId,
      });

      if (result.error || !result.data) {
        logger.error("Failed to perform vector search for notes RAG", {
          error: result.error,
        });
        return [];
      }

      const data = result.data as {
        id: string;
        note_id: string;
        chunk_text: string | null;
        title: string;
        similarity: number;
      }[];

      let results: RAGSearchResult[] = data.map((row) => ({
        // 用 note_id 作为结果 id，便于前端跳转到 /notes/:noteId
        id: row.note_id,
        title: row.title,
        content: row.chunk_text || "",
        similarity: row.similarity,
        graphId: "",
        type: "note",
      }));

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
      logger.error("Note RAG semantic search error", { err });
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
      // 提前小写化查询串，避免在每个知识点的 map 回调内重复 toLowerCase
      const lowerQuery = query.toLowerCase();
      const scoredResults = knowledgePoints.map((kp) => {
        const titleMatch = kp.title
          .toLowerCase()
          .includes(lowerQuery);
        const contentMatch = kp.content
          ? kp.content.toLowerCase().includes(lowerQuery)
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
        const { data: graphNodes, error: gnError } = await notDeleted(supabase
          .from("graph_nodes")
          .select("knowledge_point_id")
          .eq("graph_id", graphId)
          .in("knowledge_point_id", kpIds)
          );

        if (gnError) {
          logger.error("关键词检索 graph_nodes 过滤失败", { error: gnError });
          return [];
        }

        const validKpIds = new Set(
          (graphNodes || []).map(
            (gn: { knowledge_point_id: string }) => gn.knowledge_point_id,
          ),
        );

        // 合并 filter+map 为单趟 for 过滤并补充 graphId，减少一次数组扫描
        const graphFilteredResults: RAGSearchResult[] = [];
        for (const r of scoredResults) {
          if (validKpIds.has(r.id)) {
            graphFilteredResults.push({ ...r, graphId });
          }
        }

        return graphFilteredResults
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, matchCount);
      }

      // 未指定 graphId 时，查询每个知识点所属的图谱
      const kpIds = scoredResults.map((r) => r.id);
      const { data: graphNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select("knowledge_point_id, graph_id")
        .in("knowledge_point_id", kpIds)
        );

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
   * 稀疏向量检索（SPLADE 风格关键词匹配）。
   *
   * 用查询文本生成 sparse embedding（火山 multimodal 同源返回），对 knowledge_points
   * 的 sparse_embedding 列做内积检索。用于精确术语/编号匹配，作为混合检索的第四条通道
   * （semantic + keyword + graphTraversal + sparse）。provider 不支持或失败时返回 []，不阻塞主链路。
   */
  async sparseSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchThreshold?: number;
      matchCount?: number;
    } = {},
  ): Promise<RAGSearchResult[]> {
    const { graphId, matchThreshold = 0.0, matchCount = 10 } = options;
    const candidateCount = Math.max(matchCount * 3, 20);

    try {
      const sparse = await this.aiService.generateSparseEmbedding(query);
      if (!sparse || sparse.length === 0) {
        return [];
      }
      const querySparseText = serializeSparse(sparse);

      const supabase = getSupabaseAdmin();

      let data:
        | { id: string; title: string; content: string | null; similarity: number }[]
        | null = null;
      let rpcError: unknown = null;

      if (graphId) {
        const result = await supabase.rpc("match_knowledge_points_sparse", {
          query_sparse: querySparseText,
          match_threshold: matchThreshold,
          match_count: candidateCount,
          p_user_id: userId,
          p_graph_id: graphId,
        });
        data = result.data;
        rpcError = result.error;
      } else {
        const result = await supabase.rpc("match_knowledge_points_sparse_global", {
          query_sparse: querySparseText,
          match_threshold: matchThreshold,
          match_count: candidateCount,
          p_user_id: userId,
        });
        data = result.data;
        rpcError = result.error;
      }

      if (rpcError || !data) {
        logger.warn("Sparse RAG search failed or returned no data", {
          error: rpcError,
        });
        return [];
      }

      return data
        .slice(0, matchCount)
        .map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content || "",
          similarity: row.similarity,
          graphId: graphId || "",
        }));
    } catch (err) {
      logger.warn("Sparse RAG search error", { err });
      return [];
    }
  }

  /**
   * 混合检索：并行执行向量检索 + 关键词检索 + 图遍历 + 稀疏向量检索，使用 RRF 融合排序
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

    // 并行执行向量检索 + 关键词检索 + 稀疏向量检索
    const [semanticResults, keywordResults, sparseResults] = await Promise.all([
      this.semanticSearch(query, userId, {
        graphId,
        matchThreshold,
        matchCount,
      }),
      this.keywordSearch(query, userId, {
        graphId,
        matchCount,
      }),
      this.sparseSearch(query, userId, {
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

    // 稀疏向量检索路：按 similarity（内积）降序排列，score = similarity
    const sparseRanked: RankedItem<{
      hopDistance: number;
      relationshipPath: string;
      relationshipType: string;
      graphId: string;
      title: string;
      content: string;
      similarity: number;
    }>[] = sparseResults
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
    }>[][] = [semanticRanked, keywordRanked, sparseRanked];

    // 当 graphId 指定且 graphTraversal 已配置时，额外并行执行图遍历
    if (graphId && this.graphTraversal) {
      try {
        const supabase = getSupabaseAdmin();
        // 合并向量/关键词/稀疏检索的 ID 作为图遍历的种子节点
        const seedIds = [
          ...new Set([
            ...semanticResults.map((r) => r.id),
            ...keywordResults.map((r) => r.id),
            ...sparseResults.map((r) => r.id),
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
}

export const ragSearchService = new RAGSearchService();
