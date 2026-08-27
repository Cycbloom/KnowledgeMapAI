import type { Node, KnowledgePoint, GraphNode } from "@shared/types/graph";
import {
  resolveLocalizedText,
  getNodeDisplayLanguage,
} from "./localization";

export type GraphNodeRaw = Omit<GraphNode, "knowledge_point_id"> & {
  knowledge_point_id: string;
  knowledge_points?: KnowledgePoint | KnowledgePoint[] | null;
  knowledge_point?: KnowledgePoint | null;
};

export const GRAPH_NODES_SELECT = `
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
    summary,
    learning_material,
    properties,
    visibility,
    owner_id,
    created_at,
    updated_at,
    keywords
  )
`;

export const GRAPH_NODES_SELECT_WITH_EMBEDDING = `
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
    summary,
    learning_material,
    properties,
    visibility,
    owner_id,
    created_at,
    updated_at,
    keywords,
    embedding
  )
`;

export function getKnowledgePoint<T extends { id: string }>(
  kp: T | T[] | null,
): T | null {
  if (!kp) return null;
  if (Array.isArray(kp)) {
    return kp[0] || null;
  }
  return kp;
}

export function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) return null;

  const kp =
    gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);

  if (!kp) return null;

  const displayLang = getNodeDisplayLanguage();

  return {
    id: gn.knowledge_point_id,
    graph_id: gn.graph_id,
    knowledge_point_id: gn.knowledge_point_id,
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    is_accepted: gn.is_accepted,
    deleted_at: gn.deleted_at,
    created_at: gn.created_at,
    updated_at: gn.updated_at,
    // title/content/summary 在 DB 中为语言 keyed JSONB，这里按显示语言解析为字符串；
    // 同时保留原始语言映射，供翻译工具与语言切换使用。
    title: resolveLocalizedText(kp.title, displayLang),
    content: resolveLocalizedText(kp.content, displayLang),
    summary: resolveLocalizedText(kp.summary, displayLang),
    titleTranslations: kp.title as string | Record<string, string> | undefined,
    contentTranslations:
      kp.content as string | Record<string, string> | undefined,
    summaryTranslations:
      kp.summary as string | Record<string, string> | undefined,
    learning_material: kp.learning_material || {},
    keywords: kp.keywords || {},
    properties: kp.properties || {},
    visibility: kp.visibility || "private",
    owner_id: kp.owner_id || "",
    embedding: typeof kp.embedding === 'string' ? JSON.parse(kp.embedding) : kp.embedding,
  } as Node;
}

export function buildNodesFromGraphNodes(graphNodes: GraphNodeRaw[]): Node[] {
  if (!graphNodes || graphNodes.length === 0) return [];
  // 合并 map+filter 双趟扫描为单趟遍历，O(2×n) → O(n)
  const result: Node[] = [];
  for (const gn of graphNodes) {
    const node = buildNodeFromGraphNode(gn);
    if (node) result.push(node);
  }
  return result;
}