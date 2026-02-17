import { Node, Edge, NodeLevel, Graph, GraphRelation, GraphRelationType } from '../types';

export const calculateGraphLevel = (
  graphId: string,
  relations: GraphRelation[]
): NodeLevel => {
  const connections = relations.filter(
    r => r.source_graph_id === graphId || r.target_graph_id === graphId
  ).length;

  if (connections >= 5) return 'root';
  if (connections >= 3) return 'core';
  if (connections >= 2) return 'sub';
  if (connections >= 1) return 'normal';
  return 'leaf';
};

export const convertGraphsToNodes = (
  graphs: Array<Graph & { node_count?: number; x_position?: number; y_position?: number }>,
  relations: GraphRelation[]
): Node[] => {
  return graphs.map(graph => ({
    id: graph.id,
    graph_id: 'graph-map',
    title: graph.title,
    content: graph.description || '',
    x_position: graph.x_position || 0,
    y_position: graph.y_position || 0,
    level: calculateGraphLevel(graph.id, relations),
    properties: {
      nodeCount: graph.node_count || 0,
      createdAt: graph.created_at,
      isGraph: true,
    },
  }));
};

export const convertRelationsToEdges = (relations: GraphRelation[]): Edge[] => {
  return relations.map(relation => ({
    id: relation.id,
    source_node_id: relation.source_graph_id,
    target_node_id: relation.target_graph_id,
    relationship_type: relation.relation_type,
  }));
};

export const getRelationColor = (relationType: GraphRelationType): string => {
  const colors: Record<GraphRelationType, string> = {
    prerequisite: '#3B82F6',
    extension: '#10B981',
    related: '#F59E0B',
  };
  return colors[relationType] || '#6B7280';
};

export const getRelationLabel = (relationType: GraphRelationType): string => {
  const labels: Record<GraphRelationType, string> = {
    prerequisite: '前置知识',
    extension: '扩展知识',
    related: '相关知识',
  };
  return labels[relationType] || '未知关系';
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
