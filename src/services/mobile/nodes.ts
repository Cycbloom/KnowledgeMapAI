import { getMobileSupabaseClient } from "./client";
import type { Node, Keyword } from "@shared/types/graph";

type GraphNodeRaw = {
  knowledge_point_id: string;
  knowledge_points?: any | any[] | null;
  knowledge_point?: any | null;
  id?: string;
  graph_id?: string;
  x_position?: number;
  y_position?: number;
  level?: string;
  is_accepted?: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

function getKnowledgePoint(kp: any | any[] | null): any | null {
  if (!kp) return null;
  if (Array.isArray(kp)) {
    return kp[0] || null;
  }
  return kp;
}

function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  console.log("[buildNodeFromGraphNode] Input:", gn);
  if (!gn) return null;

  const kp =
    gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);

  console.log("[buildNodeFromGraphNode] Extracted kp:", kp);

  if (!kp) return null;

  const node = {
    id: gn.knowledge_point_id,
    graph_id: gn.graph_id || "",
    knowledge_point_id: gn.knowledge_point_id,
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    is_accepted: gn.is_accepted,
    deleted_at: gn.deleted_at,
    created_at: gn.created_at,
    updated_at: gn.updated_at,
    title: kp.title || "",
    content: kp.content || "",
    learning_material: kp.learning_material || "",
    properties: kp.properties || {},
    visibility: kp.visibility || "private",
    owner_id: kp.owner_id || "",
    embedding: kp.embedding,
    keywords: kp.keywords || [],
  } as Node;

  console.log("[buildNodeFromGraphNode] Output node:", {
    id: node.id,
    title: node.title,
    has_learning_material: !!node.learning_material,
    learning_material_length: node.learning_material?.length || 0,
  });

  return node;
}

const GRAPH_NODES_SELECT = `
  id,
  graph_id,
  knowledge_point_id,
  x_position,
  y_position,
  level,
  is_accepted,
  created_at,
  updated_at,
  knowledge_points (
    id,
    title,
    content,
    learning_material,
    properties,
    visibility,
    owner_id,
    created_at,
    updated_at,
    keywords
  )
`;

export const mobileNodesApi = {
  create: async (data: {
    graph_id: string;
    title: string;
    content?: string;
    level?: string;
    x_position?: number;
    y_position?: number;
    parent_node_ids?: string[];
    learning_material?: string;
    properties?: Record<string, unknown>;
    knowledge_point_id?: string;
    reuse_existing?: boolean;
  }): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("graph_nodes") as any)
      .insert(data)
      .select(GRAPH_NODES_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const node = buildNodeFromGraphNode(result);
    if (!node) {
      throw new Error("Failed to build node from graph node");
    }
    return node;
  },

  get: async (id: string): Promise<Node> => {
    console.log("[mobileNodesApi.get] Called with id:", id);
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    console.log(
      "[mobileNodesApi.get] Querying graph_nodes with knowledge_point_id:",
      id,
    );
    const { data, error } = await (client.from("graph_nodes") as any)
      .select(GRAPH_NODES_SELECT)
      .eq("knowledge_point_id", id)
      .is("deleted_at", null)
      .single();

    console.log("[mobileNodesApi.get] Query result:", { data, error });

    if (error) {
      console.error("[mobileNodesApi.get] Error:", error);
      throw new Error(error.message);
    }

    const node = buildNodeFromGraphNode(data);
    console.log("[mobileNodesApi.get] Built node:", node);

    if (!node) {
      throw new Error("Failed to build node from graph node");
    }
    return node;
  },

  update: async (
    id: string,
    data: {
      title?: string;
      content?: string;
      level?: string;
      x_position?: number;
      y_position?: number;
      learning_material?: string;
      properties?: Record<string, unknown>;
      keywords?: Keyword[];
    },
  ): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: graphNode, error: fetchError } = await (
      client.from("graph_nodes") as any
    )
      .select("*, knowledge_points (*)")
      .eq("knowledge_point_id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const kp =
      graphNode.knowledge_point ||
      getKnowledgePoint(graphNode.knowledge_points || null);

    if (kp) {
      const { error: kpError } = await (client.from("knowledge_points") as any)
        .update({
          title: data.title !== undefined ? data.title : kp.title,
          content: data.content !== undefined ? data.content : kp.content,
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

    const { data: result, error: updateError } = await (
      client.from("graph_nodes") as any
    )
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

    const node = buildNodeFromGraphNode(result);
    if (!node) {
      throw new Error("Failed to build node from graph node");
    }
    return node;
  },

  delete: async (
    id: string,
    hardDelete?: boolean,
  ): Promise<{
    message: string;
    affected_graphs?: string[];
    deleted_graph_nodes?: number;
    deleted_edges?: number;
    deleted_cards?: number;
  }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    if (hardDelete) {
      const { error } = await (client.from("graph_nodes") as any)
        .delete()
        .eq("knowledge_point_id", id);

      if (error) {
        throw new Error(error.message);
      }

      return { message: "节点已永久删除" };
    } else {
      const { error } = await (client.from("graph_nodes") as any)
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
      const { error } = await (client.from("graph_nodes") as any)
        .delete()
        .in("knowledge_point_id", nodeIds);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await (client.from("graph_nodes") as any)
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

    const { data, error } = await (client.from("graph_nodes") as any)
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
    positions: Array<{ id: string; x_position: number; y_position: number }>,
  ): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("graph_nodes") as any).upsert(
      positions,
    );

    if (error) {
      throw new Error(error.message);
    }
  },

  getRelated: async (_id: string) => {
    return { related_nodes: [] };
  },

  searchSimilar: async (_params: {
    title: string;
    content?: string;
    threshold?: number;
    limit?: number;
  }) => {
    return [];
  },

  getKnowledgePointGraphs: async (_nodeId: string) => {
    return [];
  },
};
