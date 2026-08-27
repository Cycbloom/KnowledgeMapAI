import { withClient, withClientOptionalUser } from "./utils/clientHelper";
import type {
  Graph,
  KnowledgeGraphRow,
  GraphNodeRow,
  StudyCardRow,
  CreateGraphFromTemplateData,
  GraphRelationType,
} from "@shared/types";
import { toGraph } from "@shared/types/database";
import type { NodeStatus } from "@shared/types/graph";
import type {
  CreateGraphData,
  UpdateGraphData,
} from "@shared/types/api";
import type { IGraphsApi } from "../api/contracts/IGraphsApi";
import { NotSupportedError } from "../api/contracts/types";
import { mobileNodesApi } from "./nodes";
import { mobileEdgesApi } from "./edges";
import { logger } from "@/utils/logger";
import { AppError, SharedErrorCodes } from "@/utils/errors";
import {
  computeCardDisplayMastery,
  aggregateDisplayMastery,
  type CardWithDisplayMastery,
} from "@shared/utils/fsrs/masteryContract";

interface GraphSettings {
  viewMode?: string;
  gamification_enabled?: boolean;
  learning_direction?: "top_down" | "bottom_up";
  text_display_level?: "all" | "important" | "root_only";
  [key: string]: unknown;
}

interface GraphWithSettings extends Omit<KnowledgeGraphRow, 'settings'> {
  settings?: GraphSettings | null;
}

export const mobileGraphsApi: IGraphsApi = {
  list: async (): Promise<Graph[]> => {
    return withClient(async (client) => {
      const { data: graphs, error } = await client
        .from("knowledge_graphs")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      const graphRows = (graphs || []) as KnowledgeGraphRow[];
      const graphIds = graphRows.map((g) => g.id);

      if (graphIds.length > 0) {
        const { data: nodeCounts } = await client
          .from("graph_nodes")
          .select("graph_id")
          .in("graph_id", graphIds)
          .is("deleted_at", null);

        const countMap = new Map<string, number>();
        ((nodeCounts || []) as Array<{ graph_id: string }>).forEach((n) => {
          countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
        });

        return graphRows.map((g) => ({
          ...toGraph(g),
          nodes_count: countMap.get(g.id) || 0,
        }));
      }

      return graphRows.map(toGraph);
    });
  },

  listTrash: async (): Promise<Graph[]> => {
    return withClient(async (client) => {
      const { data, error } = await client
        .from("knowledge_graphs")
        .select("*")
        .not("deleted_at", "is", null)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return ((data || []) as KnowledgeGraphRow[]).map(toGraph);
    });
  },

  get: async (id: string): Promise<Graph> => {
    return withClient(async (client) => {
      const { data, error } = await client
        .from("knowledge_graphs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(data as KnowledgeGraphRow);
    });
  },

  getNodes: async (id: string, _includeEmbedding?: boolean, includeStatus?: boolean) => {
    const [nodes, edges] = await Promise.all([
      mobileNodesApi.getByGraphId(id),
      mobileEdgesApi.getByGraphId(id),
    ]);
    const result: { nodes: typeof nodes; edges: typeof edges; nodeStatus?: Record<string, NodeStatus> } = { nodes, edges };
    if (includeStatus) {
      const statusMap = await mobileGraphsApi.getNodeStatus(id);
      result.nodeStatus = statusMap;
    }
    return result;
  },

  getNodeStatus: async (
    graphId: string,
  ): Promise<Record<string, NodeStatus>> => {
    return withClientOptionalUser(async (client, userId) => {
      if (!userId) {
        return {};
      }

      const { data: cards, error } = await client
        .from("study_cards")
        .select(
          "knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, fsrs_retrievability, review_count, fsrs_last_review, last_reviewed",
        )
        .eq("user_id", userId)
        .eq("graph_id", graphId);

      if (error) {
        logger.error("getNodeStatus error:", error);
        return {};
      }

      const now = new Date();
      const nowMs = now.getTime();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const statusMap: Record<string, NodeStatus> = {};

      type CardPick = Pick<StudyCardRow, 'knowledge_point_id' | 'next_review' | 'fsrs_stability' | 'fsrs_retrievability' | 'review_count' | 'fsrs_last_review' | 'last_reviewed'>;
      const cardGroups = new Map<string, { cards: CardPick[]; reviewCountSum: number }>();

      ((cards || []) as StudyCardRow[]).forEach((card) => {
        const kpId = card.knowledge_point_id ?? '';
        if (!kpId) return;
        if (!cardGroups.has(kpId)) {
          cardGroups.set(kpId, { cards: [], reviewCountSum: 0 });
        }
        const group = cardGroups.get(kpId);
        if (!group) return;
        group.cards.push(card);
        group.reviewCountSum += card.review_count ?? 0;
      });

      cardGroups.forEach((group, kpId) => {
        const card = group.cards[0];
        const nextReview = card.next_review ? new Date(card.next_review) : null;
        const isDue = nextReview ? nextReview <= now : false;
        const isDueToday = nextReview
          ? nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000)
          : false;

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
          due: isDue,
          due_today: isDueToday ? true : undefined,
          fsrs_stability: avgStability,
          fsrs_retrievability: displayMastery,
          display_mastery: displayMastery,
        };
      });

      return statusMap;
    });
  },

  batchGetNodeStatus: async (
    graphIds: string[],
  ): Promise<Record<string, Record<string, NodeStatus>>> => {
    const entries = await Promise.all(
      graphIds.map(async (graphId) => {
        const status = await mobileGraphsApi.getNodeStatus(graphId);
        return [graphId, status] as const;
      }),
    );
    return Object.fromEntries(entries);
  },

  create: async (data: CreateGraphData): Promise<Graph> => {
    return withClient(async (client) => {
      const { data: result, error } = await client
        .from("knowledge_graphs")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(result as KnowledgeGraphRow);
    });
  },

  createFromTemplate: async (data: CreateGraphFromTemplateData) => {
    return withClient(async (client) => {
      const { data: result, error } = await client
        .from("knowledge_graphs")
        .insert({
          title: data.title || "From Template",
          description: data.description,
        })
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(result as KnowledgeGraphRow);
    });
  },

  update: async (
    id: string,
    data: UpdateGraphData,
  ): Promise<Graph> => {
    return withClient(async (client) => {
      const { data: result, error } = await client
        .from("knowledge_graphs")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(result as KnowledgeGraphRow);
    });
  },

  delete: async (id: string): Promise<void> => {
    return withClient(async (client) => {
      const { error } = await client
        .from("knowledge_graphs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }
    });
  },

  restore: async (id: string): Promise<Graph> => {
    return withClient(async (client) => {
      const { data, error } = await client
        .from("knowledge_graphs")
        .update({ deleted_at: null })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(data as KnowledgeGraphRow);
    });
  },

  permanentDelete: async (id: string): Promise<void> => {
    return withClient(async (client) => {
      const { error } = await client
        .from("knowledge_graphs")
        .delete()
        .eq("id", id);

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }
    });
  },

  batchRestore: async (ids: string[]) => {
    return withClient(async (client) => {
      const { error } = await client
        .from("knowledge_graphs")
        .update({ deleted_at: null })
        .in("id", ids);

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return { count: ids.length };
    });
  },

  batchDelete: async (ids: string[]) => {
    return withClient(async (client) => {
      const { error } = await client
        .from("knowledge_graphs")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return { count: ids.length };
    });
  },

  batchPermanentDelete: async (ids: string[]) => {
    return withClient(async (client) => {
      const { error } = await client
        .from("knowledge_graphs")
        .delete()
        .in("id", ids);

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return { count: ids.length };
    });
  },

  getLearningPath: async (graphId: string) => {
    return withClient(async (client) => {
      const { data, error } = await client
        .from("learning_paths")
        .select("*")
        .eq("graph_id", graphId)
        .order("order_index", { ascending: true });

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return data || [];
    });
  },

  toggleFavorite: async (id: string, is_favorite: boolean): Promise<Graph> => {
    return withClient(async (client) => {
      const { data, error } = await client
        .from("knowledge_graphs")
        .update({ is_favorite })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(data as KnowledgeGraphRow);
    });
  },

  getTags: async (): Promise<{ tags: Array<{ name: string; count: number }> }> => {
    return withClientOptionalUser(async (client, userId) => {
      if (!userId) {
        return { tags: [] };
      }

      try {
        const { data, error } = await client.rpc("get_user_graph_tags", {
          p_user_id: userId,
        });

        if (!error && data) {
          return { tags: data as Array<{ name: string; count: number }> };
        }

        logger.warn("get_user_graph_tags RPC failed, falling back:", error?.message);
      } catch (err) {
        logger.warn("get_user_graph_tags RPC error, falling back:", err);
      }

      const { data: graphs } = await client
        .from("knowledge_graphs")
        .select("id")
        .eq("user_id", userId)
        .is("deleted_at", null);

      const graphIds = ((graphs || []) as Array<{ id: string }>).map((g) => g.id);

      if (graphIds.length === 0) {
        return { tags: [] };
      }

      const { data: graphNodes } = await client
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
        .is("deleted_at", null);

      const tagMap = new Map<string, number>();

      ((graphNodes || []) as Array<{
        knowledge_points:
          | { properties?: { tags?: string[] } }
          | Array<{ properties?: { tags?: string[] } }>
          | null;
      }>).forEach((gn) => {
        const kp = gn.knowledge_points;
        const props = Array.isArray(kp) ? kp[0]?.properties : kp?.properties;
        const tags = props?.tags || [];
        tags.forEach((tag: string) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      });

      const tags = Array.from(tagMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return { tags };
    });
  },

  getDomains: async () => {
    return withClientOptionalUser(async (client, userId) => {
      if (!userId) {
        return { domains: [] };
      }

      const { data, error } = await client
        .from("knowledge_graphs")
        .select("domain")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .not("domain", "is", null);

      if (error) {
        logger.error("getDomains error:", error);
        return { domains: [] };
      }

      const domainMap = new Map<string, number>();
      ((data || []) as Pick<KnowledgeGraphRow, "domain">[]).forEach((g) => {
        if (g.domain) {
          domainMap.set(g.domain, (domainMap.get(g.domain) || 0) + 1);
        }
      });

      return {
        domains: Array.from(domainMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      };
    });
  },

  togglePublic: async (id: string, is_public: boolean): Promise<Graph> => {
    return withClient(async (client) => {
      const { data, error } = await client
        .from("knowledge_graphs")
        .update({ is_public })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(data as KnowledgeGraphRow);
    });
  },

  getMap: async () => {
    return withClientOptionalUser(async (client, userId) => {
      if (!userId) {
        return { graphs: [], relations: [] };
      }

      const { data: graphs, error: graphError } = await client
        .from("knowledge_graphs")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (graphError) {
        logger.error("getMap graphs error:", graphError);
        return { graphs: [], relations: [] };
      }

      const graphRows = (graphs || []) as KnowledgeGraphRow[];
      const graphIds = graphRows.map((g) => g.id);

      if (graphIds.length > 0) {
        const [nodeCountsResult, relationsResult] = await Promise.all([
          client
            .from("graph_nodes")
            .select("graph_id")
            .in("graph_id", graphIds)
            .is("deleted_at", null),
          client
            .from("graph_relations")
            .select(
              "id, source_graph_id, target_graph_id, relation_type, context, metadata, created_at",
            )
            .or(
              `source_graph_id.in.(${graphIds.join(",")}),target_graph_id.in.(${graphIds.join(",")})`,
            ),
        ]);

        const countMap = new Map<string, number>();
        ((nodeCountsResult.data || []) as GraphNodeRow[]).forEach((n) => {
          countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
        });

        return {
          graphs: graphRows.map((g) => ({
            ...toGraph(g),
            nodes_count: countMap.get(g.id) || 0,
            node_count: countMap.get(g.id) || 0,
          })),
          relations: (relationsResult.data || []).map((r) => {
            const row = r as Record<string, unknown>;
            return {
              id: row.id as string,
              source_graph_id: row.source_graph_id as string,
              target_graph_id: row.target_graph_id as string,
              relation_type: row.relation_type as GraphRelationType,
              context: row.context ?? undefined,
              metadata: row.metadata ?? undefined,
              created_at: row.created_at as string,
            };
          }) as Array<{
            id: string;
            source_graph_id: string;
            target_graph_id: string;
            relation_type: GraphRelationType;
            context?: string;
            metadata?: Record<string, unknown>;
            created_at: string;
          }>,
        };
      }

      return {
        graphs: graphRows.map((g) => ({
          ...toGraph(g),
          nodes_count: 0,
          node_count: 0,
        })),
        relations: [],
      };
    });
  },

  updateViewMode: async (id: string, viewMode: string): Promise<Graph> => {
    return withClient(async (client) => {
      const { data: graph, error: graphError } = await client
        .from("knowledge_graphs")
        .select("id, settings")
        .eq("id", id)
        .single();

      if (graphError || !graph) {
        throw new AppError("图谱不存在", SharedErrorCodes.RESOURCE_GRAPH_NOT_FOUND, 404);
      }

      const graphWithSettings = graph as GraphWithSettings;
      const currentSettings = graphWithSettings.settings || {};
      const updatedSettings = {
        ...currentSettings,
        viewMode,
      };

      const { data: result, error: updateError } = await client
        .from("knowledge_graphs")
        .update({ settings: updatedSettings })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(updateError.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
      }

      return toGraph(result as KnowledgeGraphRow);
    });
  },

  checkTopic: async (_topic: string, _excludeGraphId?: string) => {
    throw new NotSupportedError("checkTopic");
  },

  analyze: async (_id: string) => {
    throw new NotSupportedError("analyze");
  },

  getLiterature: async (_id: string, _module?: string) => {
    throw new NotSupportedError("getLiterature");
  },

  getModuleGaps: async (_id: string) => {
    throw new NotSupportedError("getModuleGaps");
  },

  getModuleOverlap: async (_id: string) => {
    throw new NotSupportedError("getModuleOverlap");
  },

  getMissingConnections: async (_id: string, _max?: number) => {
    throw new NotSupportedError("getMissingConnections");
  },

  getRelations: async (_id: string) => {
    throw new NotSupportedError("getRelations");
  },

  createPrerequisiteGraph: async (
    _id: string,
    _data: { topic: string; description?: string; auto_generate?: boolean },
  ) => {
    throw new NotSupportedError("createPrerequisiteGraph");
  },

  createPrerequisiteGraphs: async (
    _id: string,
    _data: {
      topics: Array<{
        topic: string;
        description?: string;
        mastery_level: string;
      }>;
      depth?: number;
      style?: "academic" | "practical" | "beginner";
    },
  ) => {
    throw new NotSupportedError("createPrerequisiteGraphs");
  },

  deleteRelation: async (_graphId: string, _relationId: string) => {
    throw new NotSupportedError("deleteRelation");
  },

  createRelation: async (_data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: "prerequisite" | "extension" | "related" | "cross_domain";
    context?: string;
  }) => {
    throw new NotSupportedError("createRelation");
  },

  deleteRelationById: async (_relationId: string) => {
    throw new NotSupportedError("deleteRelationById");
  },

  infiniteExpand: async (
    _graphId: string,
    _data: {
      max_depth?: number;
      max_graphs_per_level?: number;
      relation_types?: string[];
      auto_generate_nodes?: boolean;
      node_depth?: number;
    },
  ) => {
    throw new NotSupportedError("infiniteExpand");
  },

  analyzeDomain: async (
    _domain: string,
    _count?: number,
    _sessionId?: string,
  ) => {
    throw new NotSupportedError("analyzeDomain");
  },

  expandDomain: async (
    _graphIds: string[],
    _count?: number,
    _domain?: string,
  ) => {
    throw new NotSupportedError("expandDomain");
  },

  batchCreateDomainGraphs: async (_data: {
    graphs: Array<{
      title: string;
      description?: string;
    }>;
    domain?: string;
    relations?: Array<{
      from_title: string;
      to_title: string;
      type: "prerequisite" | "extension" | "related";
      reason?: string;
    }>;
  }) => {
    throw new NotSupportedError("batchCreateDomainGraphs");
  },

  initializeGraph: async (
    _graphId: string,
    _style?: "academic" | "practical" | "beginner",
  ) => {
    throw new NotSupportedError("initializeGraph");
  },

  batchInitializeGraphs: async (_data: {
    graph_ids: string[];
    style?: "academic" | "practical" | "beginner";
    session_id?: string;
  }) => {
    throw new NotSupportedError("batchInitializeGraphs");
  },

  discoverRelations: async (_data?: {
    graph_ids?: string[];
    max_suggestions?: number;
    include_cross_domain?: boolean;
  }) => {
    throw new NotSupportedError("discoverRelations");
  },

  createDiscoveredRelation: async (_data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: unknown;
    context?: string;
    confidence?: number;
    shared_concepts?: string[];
  }) => {
    throw new NotSupportedError("createDiscoveredRelation");
  },

  getIntelligentSuggestions: async (_graphIds?: string[]) => {
    throw new NotSupportedError("getIntelligentSuggestions");
  },

  getCrossDomainInsights: async (_options?: {
    graph_ids?: string[];
    min_intersection?: number;
  }) => {
    throw new NotSupportedError("getCrossDomainInsights");
  },

  getLearningPathSuggestions: async (_options?: {
    graph_ids?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
  }) => {
    throw new NotSupportedError("getLearningPathSuggestions");
  },

  getKnowledgeGaps: async (_options?: {
    graph_ids?: string[];
    min_importance?: "high" | "medium" | "low";
  }) => {
    throw new NotSupportedError("getKnowledgeGaps");
  },
};
