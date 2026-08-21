/** @mastery display */
import { SupabaseClient } from "@supabase/supabase-js";
import { cacheService, CacheKeys, CacheTTL } from "../common/cacheService";
import {
  buildNodeFromGraphNode,
  GRAPH_NODES_SELECT,
  GRAPH_NODES_SELECT_WITH_EMBEDDING,
} from "../../utils/nodeHelpers";
import type { GraphNodeRaw } from "../../../shared/utils/nodeHelpers";
import { logger } from "../../utils/logger";
import { getLevelIndex } from "../../utils/levelUtils";
import { withRpcFallback } from "../../utils/rpcFallback";
import {
  checkDuplicateGraphTopic,
  GraphTopicCheckResult,
} from "../../utils/similaritySearch";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { Node, Edge } from "@shared/types";
import type { NodeStatus } from "@shared/types/graph";
import type { StudyCardRow } from "@shared/types/database";
import { notDeleted } from '../common/softDeleteHelper';
import {
  computeCardDisplayMastery,
  aggregateDisplayMastery,
  type CardWithDisplayMastery,
} from "../../../shared/utils/fsrs/masteryContract";

interface KnowledgePointWithProperties {
  properties?: {
    tags?: string[];
  };
}

interface GraphNodeWithKnowledgePointData {
  graph_id: string;
  knowledge_points: KnowledgePointWithProperties | KnowledgePointWithProperties[] | null;
}

export interface GraphWithCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  nodes_count: number;
  template_type?: string;
  tags?: string[];
}

interface GraphNodeForCombined {
  graph_id: string;
  knowledge_point_id: string;
  knowledge_points: KnowledgePointWithProperties | KnowledgePointWithProperties[] | null;
}

interface EdgeForCombined {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type: string;
  weight: number;
}

export interface SharedKnowledgePoint {
  knowledge_point_id: string;
  knowledge_point: KnowledgePointWithProperties | KnowledgePointWithProperties[] | null;
  graph_nodes: GraphNodeForCombined[];
}

export interface GraphNodesResult {
  nodes: (Node | null)[];
  edges: Edge[];
  nodeStatus?: Record<string, NodeStatus>;
}

export class GraphQueryService {
  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        return withRpcFallback<GraphWithCount[]>(supabase, {
          rpcName: "get_user_graphs_with_counts",
          rpcParams: { p_user_id: userId },
          fallbackFn: () => this.listGraphsFallback(supabase, userId),
        });
      },
      CacheTTL.DYNAMIC,
      [`user:${userId}`],
    );
  }

  private async listGraphsFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("user_id", userId)
      )
      .order("is_favorite", { ascending: false })
      .order("last_used_at", { ascending: false });

    if (error) throw error;

    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const [nodeCountsResult, graphNodesDataResult] = await Promise.all([
      notDeleted(supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIds)
        ),
      notDeleted(supabase
        .from("graph_nodes")
        .select(
          `
          graph_id,
          knowledge_points (
            properties
          )
        `,
        )
        .in("graph_id", graphIds)
        ),
    ]);

    const countMap = new Map<string, number>();
    nodeCountsResult.data?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });

    const tagsMap = new Map<string, Set<string>>();
    graphNodesDataResult.data?.forEach(
      (gn: GraphNodeWithKnowledgePointData) => {
        const kp = Array.isArray(gn.knowledge_points) ? gn.knowledge_points[0] : gn.knowledge_points;
        const tags = kp?.properties?.tags || [];
        if (!tagsMap.has(gn.graph_id)) {
          tagsMap.set(gn.graph_id, new Set());
        }
        tags.forEach((tag: string) => {
          const tagSet = tagsMap.get(gn.graph_id);
          if (tagSet) {
            tagSet.add(tag);
          }
        });
      },
    );

    return (graphs?.map((g: Record<string, unknown>) => ({
      id: g.id as string,
      user_id: g.user_id as string,
      title: g.title as string,
      description: g.description as string | null,
      is_public: g.is_public as boolean,
      is_favorite: g.is_favorite as boolean,
      created_at: g.created_at as string,
      updated_at: g.updated_at as string,
      deleted_at: g.deleted_at as string | null,
      nodes_count: countMap.get(g.id as string) || 0,
      tags: Array.from(tagsMap.get(g.id as string) || []),
      template_type: g.template_type as string | undefined,
    })) || []) as GraphWithCount[];
  }

  async listTrash(supabase: SupabaseClient, userId: string) {
    return withRpcFallback<GraphWithCount[]>(supabase, {
      rpcName: "get_user_trashed_graphs",
      rpcParams: { p_user_id: userId },
      fallbackFn: () => this.listTrashFallback(supabase, userId),
    });
  }

  private async listTrashFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) throw error;

    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const { data: nodeCounts } = await notDeleted(supabase
      .from("graph_nodes")
      .select("graph_id")
      .in("graph_id", graphIds)
      );

    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });

    return (graphs?.map((g: Record<string, unknown>) => ({
      id: g.id as string,
      user_id: g.user_id as string,
      title: g.title as string,
      description: g.description as string | null,
      is_public: g.is_public as boolean,
      is_favorite: g.is_favorite as boolean,
      created_at: g.created_at as string,
      updated_at: g.updated_at as string,
      deleted_at: g.deleted_at as string | null,
      nodes_count: countMap.get(g.id as string) || 0,
    })) || []) as GraphWithCount[];
  }

  async getGraph(
    supabase: SupabaseClient,
    graphId: string,
    _userId: string | null,
  ) {
    const { data, error } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select(
        "*, knowledge_graph_contents(podcast_script, reference_books, external_links, learning_guide)",
      )
      .eq("id", graphId)
      )
      .maybeSingle();

    if (error) {
      logger.error("getGraph error:", error);
      throw error;
    }

    if (!data) return data;

    // 将 knowledge_graph_contents 子表字段平铺到顶层，保持调用方兼容
    const content = data.knowledge_graph_contents;
    const { knowledge_graph_contents: _omitted, ...graphData } = data;
    return {
      ...graphData,
      podcast_script: content?.podcast_script ?? null,
      reference_books: content?.reference_books ?? null,
      external_links: content?.external_links ?? null,
      learning_guide: content?.learning_guide ?? null,
    };
  }

  async updateLastUsedAt(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    await supabase
      .from("knowledge_graphs")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", graphId)
      .eq("user_id", userId);
  }

  async checkTopicDuplicate(
    supabase: SupabaseClient,
    userId: string,
    topic: string,
    excludeGraphId?: string,
  ): Promise<GraphTopicCheckResult> {
    return checkDuplicateGraphTopic(supabase, userId, topic, {
      excludeGraphId,
    });
  }

  async getGraphNodes(
    supabase: SupabaseClient,
    userId: string | null,
    graphId: string,
    options?: { includeEmbedding?: boolean; includeStatus?: boolean },
  ) {
    const { includeEmbedding, includeStatus } = options ?? {};

    if (includeEmbedding) {
      const embCacheKey = userId
        ? `graph_nodes_emb_${userId}_${graphId}`
        : `graph_nodes_emb_${graphId}`;

      const result = await cacheService.getOrSet(
        embCacheKey,
        async () => {
          const { data: graphNodes, error: gnError } = await notDeleted(supabase
            .from("graph_nodes")
            .select(GRAPH_NODES_SELECT_WITH_EMBEDDING)
            .eq("graph_id", graphId)
            );

          if (gnError) {
            logger.error("getGraphNodes error:", gnError);
            throw gnError;
          }

          const nodes = (graphNodes || [])
            .map((gn: GraphNodeRaw) => {
              const node = buildNodeFromGraphNode(gn);
              if (!node) return null;
              return {
                id: node.id,
                graph_id: node.graph_id,
                graph_node_id: gn.id,
                title: node.title,
                content: node.content,
                summary: node.summary,
                x_position: node.x_position,
                y_position: node.y_position,
                level: node.level,
                properties: node.properties,
                learning_material: node.learning_material,
                is_accepted: node.is_accepted,
                knowledge_point_id: node.knowledge_point_id,
                visibility: node.visibility,
                owner_id: node.owner_id,
                created_at: node.created_at,
                updated_at: node.updated_at,
                embedding: node.embedding,
              };
            })
            .filter(Boolean);

          const { data: edges, error: edgesError } = await notDeleted(supabase
            .from("edges")
            .select("*")
            .eq("graph_id", graphId)
            );

          if (edgesError) throw edgesError;

          return { nodes, edges: edges || [] } as GraphNodesResult;
        },
        CacheTTL.SHORT,
        userId ? [`user:${userId}`, `graph:${graphId}`] : [`graph:${graphId}`],
      );

      if (result.nodes.length > 500) {
        logger.warn(`[Graph] Large graph loaded: ${result.nodes.length} nodes, ${result.edges.length} edges for graph ${graphId}`);
      }

      if (includeStatus && userId) {
        result.nodeStatus = await this.getGraphNodeStatus(supabase, userId, graphId);
      }

      return result;
    }

    const cacheKey = userId
      ? CacheKeys.GRAPH_NODES(userId, graphId)
      : `graph_nodes_${graphId}`;

    const cachedData = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const { data: graphNodes, error: gnError } = await notDeleted(supabase
          .from("graph_nodes")
          .select(GRAPH_NODES_SELECT)
          .eq("graph_id", graphId)
          );

        if (gnError) {
          logger.error("getGraphNodes error:", gnError);
          throw gnError;
        }

        const nodes = (graphNodes || [])
          .map((gn: GraphNodeRaw) => {
            const node = buildNodeFromGraphNode(gn);
            if (!node) return null;
            return {
              id: node.id,
              graph_id: node.graph_id,
              graph_node_id: gn.id,
              title: node.title,
              content: node.content,
              summary: node.summary,
              x_position: node.x_position,
              y_position: node.y_position,
              level: node.level,
              properties: node.properties,
              learning_material: node.learning_material,
              is_accepted: node.is_accepted,
              knowledge_point_id: node.knowledge_point_id,
              visibility: node.visibility,
              owner_id: node.owner_id,
              created_at: node.created_at,
              updated_at: node.updated_at,
            };
          })
          .filter(Boolean);

        const { data: edges, error: edgesError } = await notDeleted(supabase
          .from("edges")
          .select("*")
          .eq("graph_id", graphId)
          );

        if (edgesError) throw edgesError;

        return { nodes, edges: edges || [] };
      },
      CacheTTL.GRAPH_NODES,
      userId ? [`user:${userId}`, `graph:${graphId}`] : [`graph:${graphId}`],
    );

    if (cachedData.nodes.length > 500) {
      logger.warn(`[Graph] Large graph loaded: ${cachedData.nodes.length} nodes, ${cachedData.edges.length} edges for graph ${graphId}`);
    }

    if (includeStatus && userId) {
      return {
        ...cachedData,
        nodeStatus: await this.getGraphNodeStatus(supabase, userId, graphId),
      };
    }

    return cachedData;
  }

  async getGraphNodeStatus(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    return cacheService.getOrSet(
      CacheKeys.GRAPH_NODE_STATUS(userId, graphId),
      async () => {
        const { data: cards, error } = await supabase
          .from("study_cards")
          .select(
            "knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, fsrs_retrievability, review_count, fsrs_last_review, last_reviewed",
          )
          .eq("user_id", userId)
          .eq("graph_id", graphId);

        if (error) {
          logger.error("getGraphNodeStatus error:", error);
          return {};
        }

        const now = new Date();
        const nowMs = now.getTime();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const statusMap: Record<string, NodeStatus> = {};

        type CardPick = Pick<StudyCardRow, 'knowledge_point_id' | 'next_review' | 'fsrs_stability' | 'fsrs_retrievability' | 'review_count' | 'fsrs_last_review' | 'last_reviewed'>;
        const cardGroups = new Map<string, { cards: CardPick[]; reviewCountSum: number }>();

        (cards || []).forEach((card: CardPick) => {
          const kpId = card.knowledge_point_id ?? '';
          if (!kpId) return;
          if (!cardGroups.has(kpId)) {
            cardGroups.set(kpId, { cards: [], reviewCountSum: 0 });
          }
          const group = cardGroups.get(kpId);
          if (!group) return;
          group.cards.push(card);
          group.reviewCountSum += card.review_count || 0;
        });

        cardGroups.forEach((group, kpId) => {
          const card = group.cards[0];
          const nextReview = card.next_review ? new Date(card.next_review) : null;
          const isDue = nextReview && nextReview <= now;
          const isDueToday =
            nextReview &&
            nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000);

          const cardsWithMastery: CardWithDisplayMastery[] = group.cards.map((c) => ({
            fsrs_stability: c.fsrs_stability,
            fsrs_last_review: c.fsrs_last_review,
            last_reviewed: c.last_reviewed,
            fsrs_retrievability: c.fsrs_retrievability,
            displayMastery: computeCardDisplayMastery(
              {
                fsrs_stability: c.fsrs_stability,
                fsrs_last_review: c.fsrs_last_review,
                last_reviewed: c.last_reviewed,
                fsrs_retrievability: c.fsrs_retrievability,
              },
              nowMs,
            ),
          }));

          const displayMastery = aggregateDisplayMastery(cardsWithMastery, 'stabilityWeighted');
          const avgStability = group.cards.length > 0
            ? group.cards.reduce((sum, c) => sum + (c.fsrs_stability ?? 0), 0) / group.cards.length
            : 0;
          const isMastered = avgStability > 21;

          statusMap[kpId] = {
            mastered: isMastered,
            locked: false,
            review_count: group.reviewCountSum,
            next_review: card.next_review ?? undefined,
            due: !!isDue,
            due_today: !!isDueToday,
            fsrs_stability: avgStability,
            fsrs_retrievability: displayMastery,
            display_mastery: displayMastery,
          };
        });

        return statusMap;
      },
      CacheTTL.NODE_STATUS,
      [`graph:${graphId}`, 'status'],
    );
  }

  async batchGetGraphNodeStatus(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ): Promise<Record<string, Record<string, NodeStatus>>> {
    const cachedMap: Record<string, Record<string, NodeStatus>> = {};
    const uncachedGraphIds: string[] = [];

    const cacheEntries = await Promise.all(
      graphIds.map(async (graphId) => {
        const cacheKey = CacheKeys.GRAPH_NODE_STATUS(userId, graphId);
        const cached = await cacheService.get<Record<string, NodeStatus>>(cacheKey);
        return { graphId, cached };
      }),
    );

    for (const { graphId, cached } of cacheEntries) {
      if (cached !== undefined) {
        cachedMap[graphId] = cached;
      } else {
        uncachedGraphIds.push(graphId);
      }
    }

    if (uncachedGraphIds.length === 0) {
      return cachedMap;
    }

    const { data: cards, error } = await supabase
      .from("study_cards")
      .select(
        "graph_id, knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, fsrs_retrievability, review_count, fsrs_last_review, last_reviewed",
      )
      .eq("user_id", userId)
      .in("graph_id", uncachedGraphIds);

    if (error) {
      logger.error("batchGetGraphNodeStatus error:", error);
      for (const graphId of uncachedGraphIds) {
        cachedMap[graphId] = {};
      }
      return cachedMap;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    type CardRow = Pick<StudyCardRow, 'graph_id' | 'knowledge_point_id' | 'next_review' | 'fsrs_stability' | 'fsrs_retrievability' | 'review_count' | 'fsrs_last_review' | 'last_reviewed'>;
    type CardGroup = { cards: CardRow[]; reviewCountSum: number };

    const graphGroups = new Map<string, Map<string, CardGroup>>();

    (cards || []).forEach((card: CardRow) => {
      const gId = card.graph_id ?? '';
      const kpId = card.knowledge_point_id ?? '';
      if (!gId || !kpId) return;

      if (!graphGroups.has(gId)) {
        graphGroups.set(gId, new Map());
      }
      const kpMap = graphGroups.get(gId);
      if (!kpMap) return;

      if (!kpMap.has(kpId)) {
        kpMap.set(kpId, { cards: [], reviewCountSum: 0 });
      }
      const group = kpMap.get(kpId);
      if (!group) return;
      group.cards.push(card);
      group.reviewCountSum += card.review_count || 0;
    });

    const freshMap: Record<string, Record<string, NodeStatus>> = {};

    for (const graphId of uncachedGraphIds) {
      const kpMap = graphGroups.get(graphId);
      const statusMap: Record<string, NodeStatus> = {};

      if (kpMap) {
        kpMap.forEach((group, kpId) => {
          const card = group.cards[0];
          const nextReview = card.next_review ? new Date(card.next_review) : null;
          const isDue = nextReview && nextReview <= now;
          const isDueToday =
            nextReview &&
            nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000);

          const cardsWithMastery: CardWithDisplayMastery[] = group.cards.map((c) => ({
            fsrs_stability: c.fsrs_stability,
            fsrs_last_review: c.fsrs_last_review,
            last_reviewed: c.last_reviewed,
            fsrs_retrievability: c.fsrs_retrievability,
            displayMastery: computeCardDisplayMastery(
              {
                fsrs_stability: c.fsrs_stability,
                fsrs_last_review: c.fsrs_last_review,
                last_reviewed: c.last_reviewed,
                fsrs_retrievability: c.fsrs_retrievability,
              },
              nowMs,
            ),
          }));

          const displayMastery = aggregateDisplayMastery(cardsWithMastery, 'stabilityWeighted');
          const avgStability = group.cards.length > 0
            ? group.cards.reduce((sum, c) => sum + (c.fsrs_stability ?? 0), 0) / group.cards.length
            : 0;
          const isMastered = avgStability > 21;

          statusMap[kpId] = {
            mastered: isMastered,
            locked: false,
            review_count: group.reviewCountSum,
            next_review: card.next_review ?? undefined,
            due: !!isDue,
            due_today: !!isDueToday,
            fsrs_stability: avgStability,
            fsrs_retrievability: displayMastery,
            display_mastery: displayMastery,
          };
        });
      }

      freshMap[graphId] = statusMap;

      await cacheService.set(
        CacheKeys.GRAPH_NODE_STATUS(userId, graphId),
        statusMap,
        CacheTTL.NODE_STATUS,
        [`graph:${graphId}`, 'status'],
      );
    }

    return { ...cachedMap, ...freshMap };
  }

  async getLearningPath(
    supabase: SupabaseClient,
    _userId: string | null,
    graphId: string,
  ) {
    const { data, error } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("source_graph_id", graphId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async analyzeGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    const { nodes, edges } = await this.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    const validNodes = nodes.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );
    const nodeCount = validNodes.length;
    const edgeCount = edges.length;
    const avgConnections = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

    const levels = validNodes.reduce((acc: Record<number, number>, node) => {
      const level =
        typeof node.level === "string"
          ? parseInt(node.level, 10) || 0
          : (node.level as number) || 0;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    return {
      nodeCount,
      edgeCount,
      avgConnections: Math.round(avgConnections * 100) / 100,
      levels,
      density:
        nodeCount > 1 ? edgeCount / ((nodeCount * (nodeCount - 1)) / 2) : 0,
    };
  }

  async findMissingConnections(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    maxSuggestions: number,
  ) {
    try {
      const { data, error } = await supabase.rpc('find_missing_connections', {
        p_graph_id: graphId,
        p_max_suggestions: maxSuggestions,
      });

      if (!error && data) {
        return (data as Array<{
          source_id: string;
          target_id: string;
          source_level: string;
          target_level: string;
          score: number;
        }>).map((item) => ({
          source: item.source_id,
          target: item.target_id,
          score: item.score,
        }));
      }

      logger.warn('find_missing_connections RPC failed, falling back:', error?.message);
    } catch (err) {
      logger.warn('find_missing_connections RPC error, falling back:', err);
    }

    const { nodes, edges } = await this.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    const connectedPairs = new Set<string>();
    edges.forEach((edge: Record<string, unknown>) => {
      connectedPairs.add(
        `${edge.source_knowledge_point_id}-${edge.target_knowledge_point_id}`,
      );
      connectedPairs.add(
        `${edge.target_knowledge_point_id}-${edge.source_knowledge_point_id}`,
      );
    });

    const suggestions: Array<{
      source: string;
      target: string;
      score: number;
    }> = [];

    const validNodes = nodes.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );

    const levelIndexByNodeId = new Map<string, number>();
    validNodes.forEach((node) => {
      levelIndexByNodeId.set(
        node.id as string,
        getLevelIndex(node.level as string) || 0,
      );
    });

    for (
      let i = 0;
      i < validNodes.length && suggestions.length < maxSuggestions;
      i++
    ) {
      for (
        let j = i + 1;
        j < validNodes.length && suggestions.length < maxSuggestions;
        j++
      ) {
        const sourceId = validNodes[i].id as string;
        const targetId = validNodes[j].id as string;
        const key = `${sourceId}-${targetId}`;

        if (!connectedPairs.has(key)) {
          const sourceLevel = levelIndexByNodeId.get(sourceId) ?? 0;
          const targetLevel = levelIndexByNodeId.get(targetId) ?? 0;
          const score = Math.abs(sourceLevel - targetLevel);

          suggestions.push({
            source: sourceId,
            target: targetId,
            score,
          });
        }
      }
    }

    return suggestions
      .sort((a, b) => a.score - b.score)
      .slice(0, maxSuggestions);
  }

  async getCombinedView(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ) {
    const { data: graphs, error: graphsError } = await supabase
      .from("knowledge_graphs")
      .select("id, title")
      .in("id", graphIds)
      .eq("user_id", userId);

    if (graphsError) {
      throw graphsError;
    }

    if (!graphs || graphs.length !== graphIds.length) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    const { data: graphNodes, error: nodesError } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        id,
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties,
          visibility,
          owner_id
        )
      `,
      )
      .in("graph_id", graphIds)
      );

    if (nodesError) {
      throw nodesError;
    }

    const { data: edges, error: edgesError } = await notDeleted(supabase
      .from("edges")
      .select(
        "id, graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight",
      )
      .in("graph_id", graphIds)
      );

    if (edgesError) {
      throw edgesError;
    }

    const graphMap = new Map(graphs.map((g) => [g.id, g]));
    const result = {
      graphs: graphIds.map((gid: string) => ({
        graph_id: gid,
        graph_title: graphMap.get(gid)?.title || "",
        color: "",
        nodes: (graphNodes || []).filter((gn: GraphNodeForCombined) => gn.graph_id === gid),
        edges: (edges || []).filter((e: EdgeForCombined) => e.graph_id === gid),
      })),
      shared_knowledge_points: [] as SharedKnowledgePoint[],
    };

    const kpGraphMap = new Map<string, GraphNodeForCombined[]>();
    (graphNodes || []).forEach((gn: GraphNodeForCombined) => {
      const kpId = gn.knowledge_point_id;
      if (!kpGraphMap.has(kpId)) {
        kpGraphMap.set(kpId, []);
      }
      const list = kpGraphMap.get(kpId);
      if (list) {
        list.push(gn);
      }
    });

    kpGraphMap.forEach((nodes, kpId) => {
      if (nodes.length > 1) {
        result.shared_knowledge_points.push({
          knowledge_point_id: kpId,
          knowledge_point: nodes[0].knowledge_points,
          graph_nodes: nodes,
        });
      }
    });

    return result;
  }
}

export const graphQueryService = new GraphQueryService();
