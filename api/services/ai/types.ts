import type { SupabaseClient } from "@supabase/supabase-js";
import type { Node, Edge } from "@shared/types";
import type { NodeStatus } from "@shared/types/graph";

/**
 * 图谱查询服务接口，仅包含 chatService 实际需要的方法。
 * 用于解耦 ai 层对 graph 层的直接依赖，消除 ai→graph 循环依赖。
 */
export interface IGraphQueryService {
  getGraphNodes(
    supabase: SupabaseClient,
    userId: string | null,
    graphId: string,
    options?: { includeEmbedding?: boolean; includeStatus?: boolean },
  ): Promise<{
    nodes: (Node | null)[];
    edges: Edge[];
    nodeStatus?: Record<string, NodeStatus>;
  }>;
}
