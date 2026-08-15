import i18next from 'i18next';
import { Node, Edge, NodeLevel, Graph, GraphRelation, GraphRelationType } from '../types';

// 根据连接数推导层级，供批量预计算与单点查询复用
export const graphLevelFromConnections = (connections: number): NodeLevel => {
  if (connections >= 5) return 'root';
  if (connections >= 3) return 'core';
  if (connections >= 2) return 'sub';
  if (connections >= 1) return 'normal';
  return 'leaf';
};

export const calculateGraphLevel = (
  graphId: string,
  relations: GraphRelation[]
): NodeLevel => {
  const connections = relations.filter(
    r => r.source_graph_id === graphId || r.target_graph_id === graphId
  ).length;
  return graphLevelFromConnections(connections);
};

export const convertGraphsToNodes = (
  graphs: Array<Graph & { node_count?: number; x_position?: number; y_position?: number; updated_at?: string }>,
  relations: GraphRelation[]
): Node[] => {
  // 预计算每个 graph 的连接数，避免在循环内对 relations 全量 filter（原为 O(n*m)）
  const connectionCounts = new Map<string, number>();
  for (const r of relations) {
    // source 与 target 相同（自环）时原 filter 只计一次，需去重以保持一致
    if (r.source_graph_id === r.target_graph_id) {
      connectionCounts.set(r.source_graph_id, (connectionCounts.get(r.source_graph_id) ?? 0) + 1);
    } else {
      connectionCounts.set(r.source_graph_id, (connectionCounts.get(r.source_graph_id) ?? 0) + 1);
      connectionCounts.set(r.target_graph_id, (connectionCounts.get(r.target_graph_id) ?? 0) + 1);
    }
  }

  return graphs.map(graph => ({
    id: graph.id,
    graph_id: 'graph-map',
    knowledge_point_id: graph.id,
    x_position: graph.x_position || 0,
    y_position: graph.y_position || 0,
    level: graphLevelFromConnections(connectionCounts.get(graph.id) ?? 0),
    is_accepted: true,
    created_at: graph.created_at,
    updated_at: graph.updated_at || graph.created_at,
    title: graph.title,
    content: graph.description || '',
    visibility: 'private' as const,
    owner_id: graph.user_id || '',
    properties: {
      nodeCount: graph.node_count || 0,
      createdAt: graph.created_at,
      isGraph: true,
      domain: graph.domain,
    },
  }));
};

export const getDomainGroups = (
  graphs: Array<{ id: string; domain?: string }>
): Map<string, string[]> => {
  const groups = new Map<string, string[]>();
  
  graphs.forEach(graph => {
    if (!graph.domain) return;

    if (!groups.has(graph.domain)) {
      groups.set(graph.domain, []);
    }
    groups.get(graph.domain)?.push(graph.id);
  });
  
  return groups;
};

export const convertRelationsToEdges = (relations: GraphRelation[]): Edge[] => {
  return relations.map(relation => ({
    id: relation.id,
    graph_id: 'graph-map',
    source_knowledge_point_id: relation.source_graph_id,
    target_knowledge_point_id: relation.target_graph_id,
    relationship_type: relation.relation_type,
  }));
};

export const getRelationColor = (relationType: GraphRelationType): string => {
  const colors: Record<GraphRelationType, string> = {
    prerequisite: '#3B82F6',
    extension: '#10B981',
    related: '#F59E0B',
    cross_domain: '#8B5CF6',
  };
  return colors[relationType] || '#6B7280';
};

export const getRelationLabel = (relationType: GraphRelationType): string => {
  const labels: Record<GraphRelationType, string> = {
    prerequisite: i18next.t('graphMap.relationTypes.prerequisite'),
    extension: i18next.t('graphMap.relationTypes.extension'),
    related: i18next.t('graphMap.relationTypes.related'),
    cross_domain: i18next.t('graphMap.relationTypes.crossDomain'),
  };
  return labels[relationType] || i18next.t('graphMap.relationTypes.unknown');
};

export const filterRelationsByType = (
  relations: GraphRelation[],
  filterMode: 'all' | GraphRelationType
): GraphRelation[] => {
  if (filterMode === 'all') return relations;
  return relations.filter(r => r.relation_type === filterMode);
};

export const getConnectedGraphs = (
  graphId: string,
  relations: GraphRelation[]
): { prerequisites: string[]; extensions: string[]; related: string[] } => {
  const prerequisites: string[] = [];
  const extensions: string[] = [];
  const related: string[] = [];

  relations.forEach(r => {
    if (r.source_graph_id === graphId) {
      if (r.relation_type === 'prerequisite') prerequisites.push(r.target_graph_id);
      else if (r.relation_type === 'extension') extensions.push(r.target_graph_id);
      else if (r.relation_type === 'related') related.push(r.target_graph_id);
    }
    if (r.target_graph_id === graphId) {
      if (r.relation_type === 'extension') prerequisites.push(r.source_graph_id);
      else if (r.relation_type === 'prerequisite') extensions.push(r.source_graph_id);
      else if (r.relation_type === 'related') related.push(r.source_graph_id);
    }
  });

  return { prerequisites, extensions, related };
};
