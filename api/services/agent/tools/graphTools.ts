import type { AgentTool, ToolContext } from "../types";
import { isIndexValue, resolveId } from "../../../../shared/utils/indexMapping";
import { notDeleted } from '../../common/softDeleteHelper';
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)  }...` : text;
};

const extractDomain = (title: string): string => {
  const keywords = title.split(/[\s\-_/]/).filter((k) => k.length > 1);
  return keywords.slice(0, 2).join("/");
};

const resolveGraphId = (
  idOrIdx: string | number,
  context: ToolContext,
): string => {
  if (!context.graphIndexMap) {
    if (typeof idOrIdx === "string" && !isIndexValue(idOrIdx)) {
      return idOrIdx;
    }
    throw new AppError("Graph index map not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
  return resolveId(idOrIdx, context.graphIndexMap);
};

export const getGraphOverviewTool: AgentTool = {
  name: "get_graph_overview",
  description:
    "获取用户知识图谱的整体概览，包括图谱数量、节点总数、关系总数等统计信息",
  category: "read" as const,
  riskLevel: "low" as const,
  parameters: {
    type: "object",
    properties: {
      graphIds: {
        type: "array",
        items: { type: "string" },
        description: "要查询的图谱ID列表，为空则查询所有图谱",
      },
      summarize: {
        type: "boolean",
        description: "是否返回精简版本，默认true",
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId, graphIds: contextGraphIds } = context;
    const paramGraphIds = params.graphIds as string[] | undefined;
    const summarize = params.summarize !== false;

    const graphIds = paramGraphIds && paramGraphIds.length > 0
      ? paramGraphIds
      : contextGraphIds;

    let query = notDeleted(supabase
      .from("knowledge_graphs")
      .select("id, title, description, domain", { count: "exact" })
      .eq("user_id", userId)
      );

    if (graphIds && graphIds.length > 0) {
      query = query.in("id", graphIds);
    }

    const { data: graphs, error, count } = await query;

    if (error) {
      throw new AppError(`Failed to get graph overview: ${error.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const graphIdList = graphs?.map((g) => g.id) || [];

    const { count: nodeCount, error: nodeError } = await supabase
      .from("graph_nodes")
      .select("graph_id", { count: "exact", head: true })
      .in("graph_id", graphIdList);

    if (nodeError) {
      throw new AppError(`Failed to get node count: ${nodeError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { count: edgeCount, error: edgeError } = await supabase
      .from("edges")
      .select("graph_id", { count: "exact", head: true })
      .in("graph_id", graphIdList);

    if (edgeError) {
      throw new AppError(`Failed to get edge count: ${edgeError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const nodeCountByGraph: Record<string, number> = {};
    if (graphIdList.length > 0) {
      const { data: nodeCounts } = await supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIdList);

      nodeCounts?.forEach((n) => {
        nodeCountByGraph[n.graph_id] = (nodeCountByGraph[n.graph_id] || 0) + 1;
      });
    }

    if (summarize) {
      return {
        graphCount: count || 0,
        nodeCount: nodeCount || 0,
        edgeCount: edgeCount || 0,
        graphs: (graphs || []).map((g, idx) => ({
          idx,
          title: g.title,
          domain: g.domain || extractDomain(g.title),
          nodes: nodeCountByGraph[g.id] || 0,
        })),
      };
    }

    return {
      graphCount: count || 0,
      nodeCount: nodeCount || 0,
      edgeCount: edgeCount || 0,
      graphs: graphs || [],
    };
  },
};

export const getGraphRelationsTool: AgentTool = {
  name: "get_graph_relations",
  description: "获取图谱之间的关系信息，包括图谱间的连接和依赖",
  category: "read" as const,
  riskLevel: "low" as const,
  parameters: {
    type: "object",
    properties: {
      graphIds: {
        type: "array",
        items: { type: "string" },
        description: "要查询的图谱ID列表",
      },
      summarize: {
        type: "boolean",
        description: "是否返回精简版本，默认true",
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId, graphIds: contextGraphIds } = context;
    const paramGraphIds = params.graphIds as string[] | undefined;
    const summarize = params.summarize !== false;

    const targetGraphIds = paramGraphIds && paramGraphIds.length > 0
      ? paramGraphIds
      : contextGraphIds;

    let query = notDeleted(supabase
      .from("knowledge_graphs")
      .select("id, title")
      .eq("user_id", userId)
      );

    if (targetGraphIds && targetGraphIds.length > 0) {
      query = query.in("id", targetGraphIds);
    }

    const { data: userGraphs, error: graphsError } = await query;

    if (graphsError) {
      throw new AppError(`Failed to get user graphs: ${graphsError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const userGraphIds = (userGraphs || []).map((g) => g.id);
    const graphIdToIdx: Record<string, number> = {};
    const graphIdxToTitle: Record<string, string> = {};
    (userGraphs || []).forEach((g, idx) => {
      graphIdToIdx[g.id] = idx;
      graphIdxToTitle[idx] = g.title;
    });

    if (userGraphIds.length === 0) {
      return {
        relations: [],
        totalRelations: 0,
      };
    }

    const { data: relations, error } = await supabase
      .from("graph_relations")
      .select(
        `
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context
      `,
      )
      .or(
        `source_graph_id.in.(${userGraphIds.join(",")}),target_graph_id.in.(${userGraphIds.join(",")})`,
      );

    if (error) {
      throw new AppError(`Failed to get graph relations: ${error.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    // 预构建 Set，替代 filter 内 userGraphIds.includes 的 O(relations*userGraphIds) 扫描
    const userGraphIdSet = new Set(userGraphIds);
    const filteredRelations = (relations || []).filter(
      (r) =>
        userGraphIdSet.has(r.source_graph_id) &&
        userGraphIdSet.has(r.target_graph_id),
    );

    if (summarize) {
      return {
        relations: filteredRelations.map((r) => ({
          from: graphIdToIdx[r.source_graph_id],
          to: graphIdToIdx[r.target_graph_id],
          type: r.relation_type,
          context: r.context ? truncateText(r.context, 30) : undefined,
        })),
        graphIndex: graphIdxToTitle,
        totalRelations: filteredRelations.length,
      };
    }

    return {
      relations: filteredRelations,
      totalRelations: filteredRelations.length,
    };
  },
};

export const getIsolatedGraphsTool: AgentTool = {
  name: "get_isolated_graphs",
  description: "获取所有孤立的知识图谱（没有与其他图谱建立关系的图谱）",
  category: "read" as const,
  riskLevel: "low" as const,
  parameters: {
    type: "object",
    properties: {
      summarize: {
        type: "boolean",
        description: "是否返回精简版本，默认true",
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId, graphIds: contextGraphIds } = context;
    const summarize = params.summarize !== false;

    let query = notDeleted(supabase
      .from("knowledge_graphs")
      .select("id, title, description, domain")
      .eq("user_id", userId)
      );

    if (contextGraphIds && contextGraphIds.length > 0) {
      query = query.in("id", contextGraphIds);
    }

    const { data: graphs, error: graphsError } = await query;

    if (graphsError) {
      throw new AppError(`Failed to get graphs: ${graphsError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const graphIds = (graphs || []).map((g) => g.id);

    if (graphIds.length === 0) {
      return {
        isolatedGraphs: [],
        totalIsolated: 0,
        totalConnected: 0,
      };
    }

    const { data: relations, error: relationsError } = await supabase
      .from("graph_relations")
      .select("source_graph_id, target_graph_id")
      .or(
        `source_graph_id.in.(${graphIds.join(",")}),target_graph_id.in.(${graphIds.join(",")})`,
      );

    if (relationsError) {
      throw new AppError(`Failed to get relations: ${relationsError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const connectedGraphIds = new Set<string>();
    (relations || []).forEach((r) => {
      connectedGraphIds.add(r.source_graph_id);
      connectedGraphIds.add(r.target_graph_id);
    });

    const isolatedGraphs = (graphs || []).filter(
      (g) => !connectedGraphIds.has(g.id),
    );

    const nodeCountByGraph: Record<string, number> = {};
    if (graphIds.length > 0) {
      const { data: nodeCounts } = await supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIds);

      nodeCounts?.forEach((n) => {
        nodeCountByGraph[n.graph_id] = (nodeCountByGraph[n.graph_id] || 0) + 1;
      });
    }

    if (summarize) {
      return {
        isolatedGraphs: isolatedGraphs.map((g, idx) => ({
          idx,
          title: g.title,
          domain: g.domain || extractDomain(g.title),
          nodes: nodeCountByGraph[g.id] || 0,
        })),
        totalIsolated: isolatedGraphs.length,
        totalConnected: connectedGraphIds.size,
      };
    }

    return {
      isolatedGraphs,
      totalIsolated: isolatedGraphs.length,
      totalConnected: connectedGraphIds.size,
    };
  },
};

export const getGraphDetailsTool: AgentTool = {
  name: "get_graph_details",
  description: "获取指定图谱的详细信息，包括节点和边",
  parameters: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID",
      },
      summarize: {
        type: "boolean",
        description: "是否返回精简版本，默认true",
      },
    },
    required: ["graphId"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphIdParam = params.graphId as string;
    const summarize = params.summarize !== false;

    const graphId = resolveGraphId(graphIdParam, context);

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, title, description, domain")
      .eq("id", graphId)
      .eq("user_id", userId)
      .single();

    if (graphError) {
      throw new AppError(`Failed to get graph: ${graphError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!graph) {
      throw new AppError("Graph not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("graph_nodes")
      .select(
        `
        id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `,
      )
      .eq("graph_id", graphId);

    if (nodesError) {
      throw new AppError(`Failed to get nodes: ${nodesError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { data: edges, error: edgesError } = await supabase
      .from("edges")
      .select(
        "id, source_knowledge_point_id, target_knowledge_point_id, relationship_type",
      )
      .eq("graph_id", graphId);

    if (edgesError) {
      throw new AppError(`Failed to get edges: ${edgesError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const formattedNodes = (nodes || []).map((n) => {
      const kp = n.knowledge_points as unknown as
        | { id: string; title: string; content: string }
        | { id: string; title: string; content: string }[]
        | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      return {
        id: kpData?.id || n.id,
        title: kpData?.title || "",
        content: kpData?.content || "",
        level: n.level,
      };
    });

    const nodeIdToIdx: Record<string, number> = {};
    formattedNodes.forEach((n, idx) => {
      nodeIdToIdx[n.id] = idx;
    });

    if (summarize) {
      return {
        graph: {
          idx: 0,
          title: graph.title,
          domain: graph.domain || extractDomain(graph.title),
        },
        nodes: formattedNodes.map((n, idx) => ({
          idx,
          title: n.title,
          level: n.level,
          summary: truncateText(n.content, 30),
        })),
        edges: (edges || [])
          .map((e) => ({
            from: nodeIdToIdx[e.source_knowledge_point_id] ?? -1,
            to: nodeIdToIdx[e.target_knowledge_point_id] ?? -1,
            type: e.relationship_type,
          }))
          .filter((e) => e.from >= 0 && e.to >= 0),
        nodeCount: formattedNodes.length,
        edgeCount: edges?.length || 0,
      };
    }

    return {
      graph,
      nodes: formattedNodes,
      edges: (edges || []).map((e) => ({
        id: e.id,
        source_id: e.source_knowledge_point_id,
        target_id: e.target_knowledge_point_id,
        relationship: e.relationship_type,
      })),
      nodeCount: formattedNodes.length,
      edgeCount: edges?.length || 0,
    };
  },
};

export const getGraphNodesTool: AgentTool = {
  name: "get_graph_nodes",
  description: "获取图谱中的节点列表",
  parameters: {
    type: "object",
    properties: {
      graphId: {
        type: "string",
        description: "图谱ID",
      },
      level: {
        type: "string",
        description: "节点级别过滤（root, core, sub, normal, leaf）",
      },
      limit: {
        type: "number",
        description: "返回数量限制",
      },
      summarize: {
        type: "boolean",
        description: "是否返回精简版本，默认true",
      },
    },
    required: ["graphId"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphIdParam = params.graphId as string;
    const level = params.level as string | undefined;
    const limit = params.limit as number | undefined;
    const summarize = params.summarize !== false;

    const graphId = resolveGraphId(graphIdParam, context);

    const { data: graphCheck } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("id", graphId)
      .eq("user_id", userId)
      .single();

    if (!graphCheck) {
      throw new AppError("Graph not found or access denied", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    let query = supabase
      .from("graph_nodes")
      .select(
        `
        id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `,
      )
      .eq("graph_id", graphId);

    if (level) {
      query = query.eq("level", level);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: nodes, error } = await query;

    if (error) {
      throw new AppError(`Failed to get nodes: ${error.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const formattedNodes = (nodes || []).map((n) => {
      const kp = n.knowledge_points as unknown as
        | { id: string; title: string; content: string }
        | { id: string; title: string; content: string }[]
        | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      return {
        id: kpData?.id || n.id,
        title: kpData?.title || "",
        content: kpData?.content || "",
        level: n.level,
      };
    });

    if (summarize) {
      return {
        nodes: formattedNodes.map((n, idx) => ({
          idx,
          title: n.title,
          level: n.level,
          summary: truncateText(n.content, 30),
        })),
        total: formattedNodes.length,
      };
    }

    return {
      nodes: formattedNodes,
      total: formattedNodes.length,
    };
  },
};

export const searchGraphsTool: AgentTool = {
  name: "search_graphs",
  description: "搜索图谱和节点",
  category: "read" as const,
  riskLevel: "low" as const,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词",
      },
      type: {
        type: "string",
        enum: ["graph", "node", "all"],
        description: "搜索类型",
      },
      summarize: {
        type: "boolean",
        description: "是否返回精简版本，默认true",
      },
    },
    required: ["query"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const query = params.query as string;
    const type = (params.type as string) || "all";
    const summarize = params.summarize !== false;

    const results: {
      graphs: Array<{
        idx?: number;
        id?: string;
        title: string;
        domain?: string;
        description?: string;
      }>;
      nodes: Array<{
        idx?: number;
        id?: string;
        title: string;
        graphIdx?: number;
        graph_id?: string;
        graph_title?: string;
      }>;
      graphIndex?: Record<string, string>;
    } = {
      graphs: [],
      nodes: [],
    };

    if (type === "graph" || type === "all") {
      const { data: graphs, error: graphsError } = await notDeleted(supabase
        .from("knowledge_graphs")
        .select("id, title, description, domain")
        .eq("user_id", userId)
        )
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

      if (graphsError) {
        throw new AppError(`Failed to search graphs: ${graphsError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      if (summarize) {
        results.graphs = (graphs || []).map((g, idx) => ({
          idx,
          title: g.title,
          domain: g.domain || extractDomain(g.title),
        }));
        results.graphIndex = {};
        (graphs || []).forEach((g, idx) => {
          (results.graphIndex as Record<string, string>)[idx] = g.title;
        });
      } else {
        results.graphs = graphs || [];
      }
    }

    if (type === "node" || type === "all") {
      const { data: nodes, error: nodesError } = await supabase
        .from("graph_nodes")
        .select(
          `
          id,
          knowledge_points (
            id,
            title
          ),
          graph_id,
          knowledge_graphs!graph_id (
            id,
            title,
            user_id
          )
        `,
        )
        .ilike("knowledge_points.title", `%${query}%`)
        .eq("knowledge_graphs.user_id", userId);

      if (nodesError) {
        throw new AppError(`Failed to search nodes: ${nodesError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      const graphIdToIdx: Record<string, number> = {};
      const graphIdToTitle: Record<string, string> = {};
      let graphKeyCount = 0;
      // 单趟构建 graphId->idx/title 索引，替代原 find 嵌套扫描（O(ids*nodes)）与 Object.keys 重复遍历（O(n²)）
      (nodes || []).forEach((n) => {
        const graphData = n.knowledge_graphs as unknown as {
          id: string;
          title: string;
          user_id: string;
        };
        if (!graphIdToIdx[graphData.id]) {
          // 保持原赋值语义：值为当前已收录 key 数，仅首次收录新 key 时计数 +1
          const isNewKey = !(graphData.id in graphIdToIdx);
          graphIdToIdx[graphData.id] = graphKeyCount;
          if (isNewKey) graphKeyCount++;
        }
        if (graphData?.id && !(graphData.id in graphIdToTitle)) {
          graphIdToTitle[graphData.id] = graphData.title;
        }
      });

      const graphIdxToTitle: Record<string, string> = {};
      Object.entries(graphIdToIdx).forEach(([id, idx]) => {
        if (id in graphIdToTitle) {
          graphIdxToTitle[idx] = graphIdToTitle[id];
        }
      });

      if (summarize) {
        results.nodes = (nodes || []).map((n, idx) => {
          const graphData = n.knowledge_graphs as unknown as {
            id: string;
            title: string;
            user_id: string;
          };
          const kpData = n.knowledge_points as unknown as {
            id: string;
            title: string;
          };
          return {
            idx,
            title: kpData?.title || "",
            graphIdx: graphIdToIdx[graphData?.id],
          };
        });
        results.graphIndex = { ...results.graphIndex, ...graphIdxToTitle };
      } else {
        results.nodes = (nodes || []).map((n) => {
          const graphData = n.knowledge_graphs as unknown as {
            id: string;
            title: string;
            user_id: string;
          };
          const kpData = n.knowledge_points as unknown as {
            id: string;
            title: string;
          };
          return {
            id: kpData?.id || n.id,
            title: kpData?.title || "",
            graph_id: n.graph_id,
            graph_title: graphData?.title,
          };
        });
      }
    }

    return results;
  },
};

export const graphTools: AgentTool[] = [
  getGraphOverviewTool,
  getGraphRelationsTool,
  getIsolatedGraphsTool,
  getGraphDetailsTool,
  getGraphNodesTool,
  searchGraphsTool,
];
