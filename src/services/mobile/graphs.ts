import { withClient, withClientOptionalUser } from "./utils/clientHelper";
import type {
  Graph,
  KnowledgeGraphRow,
  GraphNodeRow,
  StudyCardRow,
  CreateGraphFromTemplateData,
} from "@shared/types";
import { toGraph } from "@shared/types/database";
import type { NodeStatus } from "@shared/types/graph";
import type {
  CreateGraphData,
  UpdateGraphData,
} from "@shared/types/api";
import { mobileNodesApi } from "./nodes";
import { mobileEdgesApi } from "./edges";

export const mobileGraphsApi = {
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
          "knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, review_count",
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

      ((cards || []) as StudyCardRow[]).forEach((card) => {
        const nextReview = card.next_review ? new Date(card.next_review) : null;
        const isDue = nextReview ? nextReview <= now : false;
        const isDueToday = nextReview
          ? nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000)
          : false;
        const isMastered =
          card.fsrs_stability != null && card.fsrs_stability > 21;

        statusMap[card.knowledge_point_id] = {
          mastered: isMastered,
          locked: false,
          review_count: card.review_count ?? 0,
          next_review: card.next_review ?? undefined,
          due: isDue,
          due_today: isDueToday ? true : undefined,
        };
      });

      return statusMap;
    });
  },

  create: async (data: CreateGraphData): Promise<Graph> => {
    return withClient(async (client) => {
      const { data: result, error } = await (
        client.from("knowledge_graphs") as any
      )
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
      const { data: result, error } = await (
        client.from("knowledge_graphs") as any
      )
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
      const { data: result, error } = await (
        client.from("knowledge_graphs") as any
      )
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
      const { error } = await (client.from("knowledge_graphs") as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }
    });
  },

  restore: async (id: string): Promise<Graph> => {
    return withClient(async (client) => {
      const { data, error } = await (client.from("knowledge_graphs") as any)
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
      const { error } = await (client.from("knowledge_graphs") as any)
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }
    });
  },

  batchRestore: async (ids: string[]) => {
    return withClient(async (client) => {
      const { error } = await (client.from("knowledge_graphs") as any)
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
      const { error } = await (client.from("knowledge_graphs") as any)
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
      const { error } = await (client.from("knowledge_graphs") as any)
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
      const { data, error } = await (client.from("knowledge_graphs") as any)
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
        return [];
      }

      const { data, error } = await client
        .from("knowledge_graphs")
        .select("domain")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .not("domain", "is", null);

      if (error) {
        console.error("getDomains error:", error);
        return [];
      }

      const domainMap = new Map<string, number>();
      ((data || []) as Pick<KnowledgeGraphRow, "domain">[]).forEach((g) => {
        if (g.domain) {
          domainMap.set(g.domain, (domainMap.get(g.domain) || 0) + 1);
        }
      });

      return Array.from(domainMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    });
  },

  togglePublic: async (id: string, is_public: boolean): Promise<Graph> => {
    return withClient(async (client) => {
      const { data, error } = await (client.from("knowledge_graphs") as any)
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
          (client.from("graph_nodes") as any)
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
          relations: (relationsResult.data || []) as Array<{
            id: string;
            source_graph_id: string;
            target_graph_id: string;
            relation_type: string;
            context?: string | null;
            metadata?: Record<string, unknown> | null;
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

      const currentSettings = (graph as any).settings || {};
      const updatedSettings = {
        ...currentSettings,
        viewMode,
      };

      const { data: result, error: updateError } = await (
        client.from("knowledge_graphs") as any
      )
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
};
