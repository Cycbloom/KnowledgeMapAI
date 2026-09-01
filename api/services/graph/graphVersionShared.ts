import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type {
  SnapshotData,
  SnapshotNodeData,
  SnapshotEdgeData,
  DiffResult,
  NodeDiff,
  EdgeDiff,
} from '../../../shared/types/graphVersion';
import { notDeleted } from '../common/softDeleteHelper';

/** graph_nodes JOIN knowledge_points 查询行（快照/合并共用的快照数据来源） */
export interface GraphNodeSnapshotRow {
  id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  knowledge_points:
    | { title: string; content: string; summary: string | null }
    | { title: string; content: string; summary: string | null }[]
    | null;
}

/** edges 表查询行（快照/合并共用的快照数据来源） */
export interface EdgeSnapshotRow {
  id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type: string;
  weight: number;
  custom_label: string | null;
  custom_color: string | null;
  custom_line_style: string | null;
  show_arrow: boolean | null;
}

/**
 * 构建当前图谱的快照数据（节点 + 边）。
 * 供快照创建、diffWithCurrent 与分支合并共用。
 */
export async function buildCurrentSnapshotData(
  supabase: SupabaseClient,
  graphId: string,
): Promise<SnapshotData> {
  const { data: nodes, error: nodesError } = await notDeleted(supabase
    .from('graph_nodes')
    .select('id, knowledge_point_id, x_position, y_position, level, is_accepted, knowledge_points(title, content, summary)')
    .eq('graph_id', graphId)
    );

  if (nodesError) {
    logger.error('Query current nodes error:', nodesError);
    throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
  }

  const { data: edges, error: edgesError } = await notDeleted(supabase
    .from('edges')
    .select('id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
    .eq('graph_id', graphId)
    );

  if (edgesError) {
    logger.error('Query current edges error:', edgesError);
    throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
  }

  const snapshotNodes: SnapshotNodeData[] = ((nodes ?? []) as unknown as GraphNodeSnapshotRow[]).map((node) => ({
    id: node.id,
    knowledgePointId: node.knowledge_point_id,
    title: Array.isArray(node.knowledge_points)
      ? (node.knowledge_points[0]?.title ?? '')
      : (node.knowledge_points?.title ?? ''),
    content: Array.isArray(node.knowledge_points)
      ? (node.knowledge_points[0]?.content ?? '')
      : (node.knowledge_points?.content ?? ''),
    summary: Array.isArray(node.knowledge_points)
      ? (node.knowledge_points[0]?.summary ?? null)
      : (node.knowledge_points?.summary ?? null),
    xPosition: node.x_position,
    yPosition: node.y_position,
    level: node.level,
    isAccepted: node.is_accepted,
  }));

  const snapshotEdges: SnapshotEdgeData[] = ((edges ?? []) as unknown as EdgeSnapshotRow[]).map((edge) => ({
    id: edge.id,
    sourceKnowledgePointId: edge.source_knowledge_point_id,
    targetKnowledgePointId: edge.target_knowledge_point_id,
    relationshipType: edge.relationship_type,
    weight: edge.weight,
    customLabel: edge.custom_label,
    customColor: edge.custom_color,
    customLineStyle: edge.custom_line_style,
    showArrow: edge.show_arrow,
  }));

  return { nodes: snapshotNodes, edges: snapshotEdges };
}

/** 边唯一键：source:target:relationshipType */
export function getEdgeKey(edge: SnapshotEdgeData): string {
  return `${edge.sourceKnowledgePointId}:${edge.targetKnowledgePointId}:${edge.relationshipType}`;
}

/** 计算两份快照数据之间的差异（新增/删除/修改），供 diff 与分支合并共用 */
export function computeDiff(source: SnapshotData, target: SnapshotData): DiffResult {
  const sourceNodeMap = new Map(source.nodes.map(n => [n.knowledgePointId, n]));
  const targetNodeMap = new Map(target.nodes.map(n => [n.knowledgePointId, n]));

  const addedNodes: SnapshotNodeData[] = [];
  const removedNodes: SnapshotNodeData[] = [];
  const modifiedNodes: NodeDiff[] = [];

  for (const [kpId, targetNode] of targetNodeMap) {
    if (!sourceNodeMap.has(kpId)) {
      addedNodes.push(targetNode);
    }
  }

  for (const [kpId, sourceNode] of sourceNodeMap) {
    if (!targetNodeMap.has(kpId)) {
      removedNodes.push(sourceNode);
    }
  }

  for (const [kpId, sourceNode] of sourceNodeMap) {
    const targetNode = targetNodeMap.get(kpId);
    if (!targetNode) continue;

    const changedFields: string[] = [];
    if (sourceNode.xPosition !== targetNode.xPosition) changedFields.push('xPosition');
    if (sourceNode.yPosition !== targetNode.yPosition) changedFields.push('yPosition');
    if (sourceNode.level !== targetNode.level) changedFields.push('level');
    if (sourceNode.title !== targetNode.title) changedFields.push('title');
    if (sourceNode.content !== targetNode.content) changedFields.push('content');
    if (sourceNode.summary !== targetNode.summary) changedFields.push('summary');

    if (changedFields.length > 0) {
      modifiedNodes.push({
        id: kpId,
        knowledgePointId: kpId,
        changeType: 'modified',
        before: sourceNode,
        after: targetNode,
        changedFields,
      });
    }
  }

  const sourceEdgeMap = new Map(source.edges.map(e => [getEdgeKey(e), e]));
  const targetEdgeMap = new Map(target.edges.map(e => [getEdgeKey(e), e]));

  const addedEdges: SnapshotEdgeData[] = [];
  const removedEdges: SnapshotEdgeData[] = [];
  const modifiedEdges: EdgeDiff[] = [];

  for (const [key, targetEdge] of targetEdgeMap) {
    if (!sourceEdgeMap.has(key)) {
      addedEdges.push(targetEdge);
    }
  }

  for (const [key, sourceEdge] of sourceEdgeMap) {
    if (!targetEdgeMap.has(key)) {
      removedEdges.push(sourceEdge);
    }
  }

  for (const [key, sourceEdge] of sourceEdgeMap) {
    const targetEdge = targetEdgeMap.get(key);
    if (!targetEdge) continue;

    const changedFields: string[] = [];
    if (sourceEdge.weight !== targetEdge.weight) changedFields.push('weight');
    if (sourceEdge.customLabel !== targetEdge.customLabel) changedFields.push('customLabel');
    if (sourceEdge.customColor !== targetEdge.customColor) changedFields.push('customColor');
    if (sourceEdge.customLineStyle !== targetEdge.customLineStyle) changedFields.push('customLineStyle');
    if (sourceEdge.showArrow !== targetEdge.showArrow) changedFields.push('showArrow');

    if (changedFields.length > 0) {
      modifiedEdges.push({
        id: key,
        changeType: 'modified',
        before: sourceEdge,
        after: targetEdge,
        changedFields,
      });
    }
  }

  const totalChanges =
    addedNodes.length +
    removedNodes.length +
    modifiedNodes.length +
    addedEdges.length +
    removedEdges.length +
    modifiedEdges.length;

  return {
    nodes: {
      added: addedNodes,
      removed: removedNodes,
      modified: modifiedNodes,
    },
    edges: {
      added: addedEdges,
      removed: removedEdges,
      modified: modifiedEdges,
    },
    summary: {
      totalChanges,
      nodesAdded: addedNodes.length,
      nodesRemoved: removedNodes.length,
      nodesModified: modifiedNodes.length,
      edgesAdded: addedEdges.length,
      edgesRemoved: removedEdges.length,
      edgesModified: modifiedEdges.length,
    },
  };
}
