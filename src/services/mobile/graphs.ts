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

interface GraphSettings {
  viewMode?: string;
  gamification_enabled?: boolean;
  learning_direction?: "top_down" | "bottom_up";
  text_display_level?: "all" | "important" | "root_only";
  [key: string]: unknown;
}

interface GraphWithSettings extends KnowledgeGraphRow {
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
      }

      return toGraph(data as KnowledgeGraphRow);
    });
  },

  getNodes: async (id: string) => {
    const nodes = await mobileNodesApi.getByGraphId(id);
    const edges = await mobileEdgesApi.getByGraphId(id);
    return { nodes, edges };
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
          "knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, fsrs_retrievability, review_count",
        )
        .eq("user_id", userId)
        .eq("graph_id", graphId);

      if (error) {
        console.error("getNodeStatus error:", error);
        return {};
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const statusMap: Record<string, NodeStatus> = {};

      const cardGroups = new Map<string, { stabilitySum: number; retrievabilitySum: number; reviewCountSum: number; count: number; firstCard: StudyCardRow }>();

      ((cards || []) as StudyCardRow[]).forEach((card) => {
        const kpId = card.knowledge_point_id;
        if (!cardGroups.has(kpId)) {
          cardGroups.set(kpId, { stabilitySum: 0, retrievabilitySum: 0, reviewCountSum: 0, count: 0, firstCard: card });
        }
        const group = cardGroups.get(kpId)!;
        group.stabilitySum += card.fsrs_stability ?? 0;
        group.retrievabilitySum += card.fsrs_retrievability ?? 0;
        group.reviewCountSum += card.review_count ?? 0;
        group.count += 1;
      });

      cardGroups.forEach((group, kpId) => {
        const card = group.firstCard;
        const nextReview = card.next_review ? new Date(card.next_review) : null;
        const isDue = nextReview ? nextReview <= now : false;
        const isDueToday = nextReview
          ? nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000)
          : false;
        const avgStability = group.stabilitySum / group.count;
        const isMastered = avgStability > 21;

        statusMap[kpId] = {
          mastered: isMastered,
          locked: false,
          review_count: group.reviewCountSum,
          next_review: card.next_review ?? undefined,
          due: isDue,
          due_today: isDueToday ? true : undefined,
          fsrs_stability: avgStability,
          fsrs_retrievability: group.retrievabilitySum / group.count,
        };
      });

      return statusMap;
    });
  },

  create: async (data: CreateGraphData): Promise<Graph> => {
    return withClient(async (client) => {
      const { data: result, error } = await client
        .from("knowledge_graphs")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
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
        throw new Error(error.message);
      }

      return toGraph(data as KnowledgeGraphRow);
    });
  },

  getTags: async (): Promise<string[]> => {
    return withClientOptionalUser(async (client, userId) => {
      if (!userId) {
        return [];
      }

      const { data, error } = await client
        .from("knowledge_graphs")
        .select("tags")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (error) {
        console.error("getTags error:", error);
        return [];
      }

      const allTags = new Set<string>();
      ((data || []) as Pick<KnowledgeGraphRow, "tags">[]).forEach((g) => {
        (g.tags || []).forEach((tag: string) => allTags.add(tag));
      });

      return Array.from(allTags);
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
        console.error("getDomains error:", error);
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
        throw new Error(error.message);
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
        console.error("getMap graphs error:", graphError);
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
        throw new Error("图谱不存在");
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
        throw new Error(updateError.message);
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

  getResearchProgress: async (_id: string) => {
    throw new NotSupportedError("getResearchProgress");
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
