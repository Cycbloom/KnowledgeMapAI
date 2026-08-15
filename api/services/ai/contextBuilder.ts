// contextBuilder.ts
// 目的：拆分 chatService ↔ aiService 循环依赖。
// 将图谱上下文构建相关的纯函数从 aiService 迁出至此模块，
// 使 chatService 与 aiService 都可单向 import 此模块，避免运行时循环依赖导致 undefined。
import { logger } from "../../utils/logger";

export interface GraphNode {
  id: string;
  title: string;
  content?: string | null;
}

export interface GraphEdge {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship?: string | null;
}

export interface BuildGraphContextOptions {
  contextNodeIds?: string[];
  maxContextLength?: number;
  graphId?: string;
}

export interface TutorContext {
  mode: string;
  graphId?: string;
  existingNodes?: string[];
  currentNodeId?: string;
  currentNodeTitle?: string;
  currentNodeContent?: string;
}

/**
 * 构建图谱上下文文本（供 chat / tutorChat 的 system prompt 使用）。
 * 纯函数：不依赖任何服务实例状态。
 */
export function buildGraphContext(
  nodes: (GraphNode | null)[],
  edges: GraphEdge[],
  options: BuildGraphContextOptions = {},
): string {
  const {
    contextNodeIds,
    maxContextLength = 15000,
    graphId,
  } = options;

  const validNodes = nodes.filter(
    (n): n is NonNullable<typeof n> => n !== null,
  );

  let contextText = "";

  if (contextNodeIds && contextNodeIds.length > 0) {
    // 预构建 Set，替代 selectedNodes/relatedEdges 过滤中 contextNodeIds.includes 的 O(n*m) 扫描
    const contextNodeIdSet = new Set(contextNodeIds);
    const selectedNodes = validNodes.filter((n) =>
      contextNodeIdSet.has(n.id),
    );
    const nodesText = selectedNodes
      .map((n) => `[Node] ${n.title}: ${n.content || "(No content)"}`)
      .join("\n");

    const relatedEdges = edges.filter(
      (e) =>
        contextNodeIdSet.has(e.source_knowledge_point_id) &&
        contextNodeIdSet.has(e.target_knowledge_point_id),
    );

    const nodeTitleMap = new Map(validNodes.map((n) => [n.id, n.title]));

    const edgesText = relatedEdges
      .map((e) => {
        const source =
          nodeTitleMap.get(e.source_knowledge_point_id) || "Unknown";
        const target =
          nodeTitleMap.get(e.target_knowledge_point_id) || "Unknown";
        return `[Edge] ${source} -> ${target} (${e.relationship || "related"})`;
      })
      .join("\n");

    contextText = `Selected Nodes:\n${nodesText}\n\nRelationships:\n${edgesText}`;
  } else {
    const nodeTitleMap = new Map(validNodes.map((n) => [n.id, n.title]));

    if (validNodes.length > 100) {
      const nodesText = validNodes.map((n) => `- ${n.title}`).join("\n");
      contextText = `Graph Overview (Nodes Only):\n${nodesText}`;
    } else {
      const nodesText = validNodes
        .map((n) => `[Node] ${n.title}: ${n.content || "(No content)"}`)
        .join("\n");
      const edgesText = edges
        .map((e) => {
          const source =
            nodeTitleMap.get(e.source_knowledge_point_id) || "Unknown";
          const target =
            nodeTitleMap.get(e.target_knowledge_point_id) || "Unknown";
          return `[Edge] ${source} -> ${target} (${e.relationship || "related"})`;
        })
        .join("\n");

      contextText = `All Nodes:\n${nodesText}\n\nAll Relationships:\n${edgesText}`;
    }
  }

  if (contextText.length > maxContextLength) {
    contextText = `${contextText.substring(0, maxContextLength)}...(truncated)`;
    logger.warn("Graph context truncated due to length", {
      graph_id: graphId,
      length: contextText.length,
    });
  }

  return contextText;
}

/**
 * 构建 tutor 上下文（当前节点信息 + 现有节点列表）。
 * 纯函数：不依赖任何服务实例状态。
 */
export function buildTutorContext(
  nodes: (GraphNode | null)[],
  currentNodeId?: string,
  mode: string = "free",
  graphId?: string,
): TutorContext {
  const validNodes = nodes.filter(
    (n): n is NonNullable<typeof n> => n !== null,
  );

  const context: TutorContext = { mode };

  if (graphId) {
    context.graphId = graphId;
    context.existingNodes = validNodes.map((n) => n.title);

    if (currentNodeId) {
      const currentNode = validNodes.find((n) => n.id === currentNodeId);
      if (currentNode) {
        context.currentNodeId = currentNode.id;
        context.currentNodeTitle = currentNode.title;
        context.currentNodeContent = currentNode.content ?? undefined;
      }
    }
  }

  return context;
}
