import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { notDeleted } from '../common/softDeleteHelper';

export interface SiblingNode {
  knowledgePointId: string;
  title: string;
  content: string | null;
}

interface EdgeRow {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
}

interface KnowledgePointRow {
  knowledge_point_id: string;
  knowledge_points?: {
    id: string;
    title: string;
    content: string | null;
  }[] | null;
}

const MAX_SIBLING_CONTENT_LENGTH = 200;

/**
 * 纯函数：把边列表构造成「父(source) → 子(target) kp id 数组」的映射。
 */
export function buildSiblingsByParent(
  edges: Array<{ source_knowledge_point_id: string; target_knowledge_point_id: string }>,
): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    const children = childrenByParent.get(edge.source_knowledge_point_id) ?? [];
    children.push(edge.target_knowledge_point_id);
    childrenByParent.set(edge.source_knowledge_point_id, children);
  }
  return childrenByParent;
}

/**
 * 查询指定知识点的兄弟节点（同父节点的其他子节点）。
 * 用于选择题干扰项生成。失败时返回 []（特性必须非致命）。
 */
export async function getSiblingNodes(
  supabase: SupabaseClient,
  _graphId: string,
  nodeId: string,
  limit?: number,
): Promise<SiblingNode[]> {
  try {
    // 1) 找到 nodeId 的父节点（source）。无父边 → 根节点，无兄弟。
    const { data: parentEdges, error: parentError } = await supabase
      .from('edges')
      .select('source_knowledge_point_id, target_knowledge_point_id')
      .eq('target_knowledge_point_id', nodeId);

    if (parentError) {
      logger.warn(`[SiblingNodes] Failed to fetch parent edge for node ${nodeId}:`, parentError);
      return [];
    }

    const parentId = (parentEdges ?? [])[0]?.source_knowledge_point_id;
    if (!parentId) {
      return [];
    }

    // 2) 查询 parentId 的所有出边，得到兄弟 kp id（排除 nodeId 自身）
    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('source_knowledge_point_id, target_knowledge_point_id')
      .eq('source_knowledge_point_id', parentId);

    if (edgesError) {
      logger.warn(`[SiblingNodes] Failed to fetch sibling edges for parent ${parentId}:`, edgesError);
      return [];
    }

    const siblingIds = (edges ?? [])
      .map((e: EdgeRow) => e.target_knowledge_point_id)
      .filter((id: string) => id !== nodeId);
    if (siblingIds.length === 0) {
      return [];
    }

    // 3) 批量查询兄弟节点的标题与内容
    const { data: rows, error: rowsError } = await notDeleted(supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content
        )
      `)
      .in('knowledge_point_id', siblingIds));

    if (rowsError) {
      logger.warn(`[SiblingNodes] Failed to fetch sibling details for parent ${parentId}:`, rowsError);
      return [];
    }

    const siblings: SiblingNode[] = (rows ?? []).map((row: KnowledgePointRow) => {
      const kp = row.knowledge_points?.[0];
      const content = kp?.content ?? null;
      return {
        knowledgePointId: kp?.id || row.knowledge_point_id,
        title: kp?.title || '',
        content: content ? content.slice(0, MAX_SIBLING_CONTENT_LENGTH) : null,
      };
    });

    return typeof limit === 'number' && limit > 0 ? siblings.slice(0, limit) : siblings;
  } catch (error: unknown) {
    logger.warn(`[SiblingNodes] Unexpected error fetching siblings for node ${nodeId}:`, error);
    return [];
  }
}

function truncateContent(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export async function getDirectChildren(
  supabase: SupabaseClient,
  _graphId: string,
  nodeId: string,
  limit = 8,
): Promise<SiblingNode[]> {
  try {
    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('source_knowledge_point_id, target_knowledge_point_id')
      .eq('source_knowledge_point_id', nodeId);

    if (edgesError) {
      logger.warn(`[DirectChildren] Failed to fetch child edges for node ${nodeId}:`, edgesError);
      return [];
    }

    const childIds = (edges ?? []).map((e: EdgeRow) => e.target_knowledge_point_id);
    if (childIds.length === 0) {
      return [];
    }

    const { data: rows, error: rowsError } = await notDeleted(supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content
        )
      `)
      .in('knowledge_point_id', childIds));

    if (rowsError) {
      logger.warn(`[DirectChildren] Failed to fetch child details for node ${nodeId}:`, rowsError);
      return [];
    }

    const seenIds = new Set<string>();
    const children: SiblingNode[] = [];
    for (const row of rows ?? []) {
      const kp = (row as KnowledgePointRow).knowledge_points?.[0];
      const knowledgePointId = kp?.id ?? (row as KnowledgePointRow).knowledge_point_id;
      if (seenIds.has(knowledgePointId)) continue;
      seenIds.add(knowledgePointId);
      const rawContent = kp?.content ?? null;
      children.push({
        knowledgePointId,
        title: kp?.title ?? '',
        content: rawContent ? truncateContent(rawContent, MAX_SIBLING_CONTENT_LENGTH) : null,
      });
    }

    return typeof limit === 'number' && limit > 0 ? children.slice(0, limit) : children;
  } catch (error: unknown) {
    logger.warn(`[DirectChildren] Unexpected error fetching children for node ${nodeId}:`, error);
    return [];
  }
}