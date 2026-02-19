import { request } from './client';

export const graphsApi = {
  list: () => request('/graphs'),
  
  listTrash: () => request('/graphs/trash'),
  
  getTags: () => request('/graphs/tags'),
  
  create: (data: { title: string; description?: string }) => 
    request('/graphs', { method: 'POST', body: JSON.stringify(data) }),
  
  createFromTemplate: (data: { template_id: string; title?: string }) => 
    request('/graphs/from-template', { method: 'POST', body: JSON.stringify(data) }),
  
  get: (id: string) => request(`/graphs/${id}`),
  
  getNodes: (id: string) => request(`/graphs/${id}/nodes`),
  
  getNodeStatus: (id: string) => request(`/graphs/${id}/node-status`),
  
  update: (id: string, data: { title?: string; description?: string; settings?: Record<string, unknown> }) => 
    request(`/graphs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  togglePublic: (id: string, is_public: boolean) => 
    request(`/graphs/${id}/share`, { method: 'PUT', body: JSON.stringify({ is_public }) }),
  
  toggleFavorite: (id: string, is_favorite: boolean) => 
    request(`/graphs/${id}/favorite`, { method: 'PUT', body: JSON.stringify({ is_favorite }) }),
  
  delete: (id: string) => request(`/graphs/${id}`, { method: 'DELETE' }),
  
  restore: (id: string) => request(`/graphs/${id}/restore`, { method: 'POST' }),
  
  permanentDelete: (id: string) => request(`/graphs/${id}/permanent`, { method: 'DELETE' }),
  
  getLearningPath: (id: string) => request(`/graphs/${id}/learning-path`),
  
  analyze: (id: string) => request(`/graphs/${id}/analyze`),
  
  getMissingConnections: (id: string, max?: number) => {
    const url = max ? `/graphs/${id}/missing-connections?max=${max}` : `/graphs/${id}/missing-connections`;
    return request(url);
  },
  
  getRelations: (id: string) => request(`/graphs/${id}/relations`),
  
  createPrerequisiteGraph: (id: string, data: { topic: string; description?: string; auto_generate?: boolean }) => 
    request(`/graphs/${id}/prerequisite-graph`, { method: 'POST', body: JSON.stringify(data) }),
  
  createPrerequisiteGraphs: (id: string, data: { 
    topics: Array<{ topic: string; description?: string; mastery_level: string }>;
    depth?: number;
    style?: 'academic' | 'practical' | 'beginner';
  }) => 
    request(`/graphs/${id}/prerequisite-graphs/batch`, { method: 'POST', body: JSON.stringify(data) }),
  
  deleteRelation: (graphId: string, relationId: string) => 
    request(`/graphs/${graphId}/relations/${relationId}`, { method: 'DELETE' }),
  
  getMap: () => request('/graphs/map'),
  
  createRelation: (data: { 
    source_graph_id: string; 
    target_graph_id: string; 
    relation_type: 'prerequisite' | 'extension' | 'related'; 
    context?: string;
  }) => request('/graph-relations/relations', { method: 'POST', body: JSON.stringify(data) }),
  
  deleteRelationById: (relationId: string) => 
    request(`/graph-relations/relations/${relationId}`, { method: 'DELETE' }),
  
  analyzeMap: () => request('/graphs/map/analyze'),
  
  infiniteExpand: (graphId: string, data: {
    max_depth?: number;
    max_graphs_per_level?: number;
    relation_types?: string[];
    auto_generate_nodes?: boolean;
    node_depth?: number;
  }) => request(`/graphs/${graphId}/infinite-expand`, { method: 'POST', body: JSON.stringify(data) }),
};
