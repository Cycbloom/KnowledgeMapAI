import { getMobileSupabaseClient } from "@/lib/supabase";
import type { Node, Keyword } from "@shared/types/graph";
import type {
  CreateNodeData,
  UpdateNodeData,
  NodePositionUpdate,
  DeleteNodeResult,
} from "@shared/types/api";
import type { INodesApi } from "../api/contracts/INodesApi";
import { NotSupportedError } from "../api/contracts/types";
import {
  GRAPH_NODES_SELECT,
  buildNodeFromGraphNode,
  getKnowledgePoint,
  type GraphNodeRaw,
} from "@shared/utils/nodeHelpers";

export const mobileNodesApi: INodesApi & {
  getByGraphId: (graphId: string) => Promise<Node[]>;
} = {
  create: async (data: CreateNodeData): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await client
      .from("graph_nodes")
      .insert(data)
      .select(GRAPH_NODES_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const node = buildNodeFromGraphNode(result as GraphNodeRaw);
    if (!node) {
      throw new Error("Failed to build node from graph node");
    }
    return node;
  },

  get: async (id: string): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await client
      .from("graph_nodes")
      .select(GRAPH_NODES_SELECT)
      .eq("knowledge_point_id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Node not found");
    }

    const node = buildNodeFromGraphNode(data as GraphNodeRaw);

    if (!node) {
      throw new Error("Failed to build node from graph node");
    }
    return node;
  },

  update: async (
    id: string,
    data: UpdateNodeData & { keywords?: Keyword[] },
  ): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: graphNode, error: fetchError } = await client
      .from("graph_nodes")
      .select("*, knowledge_points (*)")
      .eq("knowledge_point_id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const rawNode = graphNode as GraphNodeRaw;
    const kp =
      rawNode.knowledge_point ||
      getKnowledgePoint(rawNode.knowledge_points || null);

    if (kp) {
      const { error: kpError } = await client
        .from("knowledge_points")
        .update({
          title: data.title !== undefined ? data.title : kp.title,
          content: data.content !== undefined ? data.content : kp.content,
          summary: data.summary !== undefined ? data.summary : kp.summary,
          learning_material:
            data.learning_material !== undefined
              ? data.learning_material
              : kp.learning_material,
          properties:
            data.properties !== undefined ? data.properties : kp.properties,
          keywords: data.keywords !== undefined ? data.keywords : kp.keywords,
        })
        .eq("id", kp.id);

      if (kpError) {
        console.error("Failed to update knowledge_point:", kpError);
      }
    }

    const { data: result, error: updateError } = await client
      .from("graph_nodes")
      .update({
        level: data.level,
        x_position: data.x_position,
        y_position: data.y_position,
      })
      .eq("knowledge_point_id", id)
      .select(GRAPH_NODES_SELECT)
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    const node = buildNodeFromGraphNode(result as GraphNodeRaw);
    if (!node) {
      throw new Error("Failed to build node from graph node");
    }
    return node;
  },

  delete: async (
    id: string,
    hardDelete?: boolean,
  ): Promise<DeleteNodeResult> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    if (hardDelete) {
      const { error } = await client
        .from("graph_nodes")
        .delete()
        .eq("knowledge_point_id", id);

      if (error) {
        throw new Error(error.message);
      }

      return { message: "节点已永久删除" };
    } else {
      const { error } = await client
        .from("graph_nodes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("knowledge_point_id", id);

      if (error) {
        throw new Error(error.message);
      }

      return { message: "节点已移至回收站" };
    }
  },

  batchDelete: async (
    nodeIds: string[],
    options?: { hard_delete?: boolean },
  ) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    if (options?.hard_delete) {
      const { error } = await client
        .from("graph_nodes")
        .delete()
        .in("knowledge_point_id", nodeIds);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await client
        .from("graph_nodes")
        .update({ deleted_at: new Date().toISOString() })
        .in("knowledge_point_id", nodeIds);

      if (error) {
        throw new Error(error.message);
      }
    }

    return { count: nodeIds.length };
  },

  getByGraphId: async (graphId: string): Promise<Node[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await client
      .from("graph_nodes")
      .select(GRAPH_NODES_SELECT)
      .eq("graph_id", graphId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    return (data || [])
      .map((gn: GraphNodeRaw) => buildNodeFromGraphNode(gn))
      .filter((n: Node | null): n is Node => n !== null);
  },

  batchUpdatePositions: async (
    positions: NodePositionUpdate[],
  ): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await client.from("graph_nodes").upsert(
      positions,
    );

    if (error) {
      throw new Error(error.message);
    }
  },

  getRelated: async (_id: string) => {
    throw new NotSupportedError("getRelated");
  },

  searchSimilar: async (_params: {
    title: string;
    content?: string;
    threshold?: number;
    limit?: number;
  }) => {
    throw new NotSupportedError("searchSimilar");
  },

  getKnowledgePointGraphs: async (_nodeId: string) => {
    throw new NotSupportedError("getKnowledgePointGraphs");
  },
};
