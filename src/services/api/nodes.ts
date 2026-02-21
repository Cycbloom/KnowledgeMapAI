import { request } from './client';
import type { Node, Edge } from '../../types';

export const nodesApi = {
  create: (data: { 
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
  }) => request<Node>('/nodes', { method: 'POST', body: JSON.stringify(data) }),
  
  get: (id: string) => request<Node>(`/nodes/${id}`),
  
  update: (id: string, data: { 
    title?: string; 
    content?: string; 
    level?: string;
    x_position?: number;
    y_position?: number;
    learning_material?: string;
    properties?: Record<string, unknown>;
  }) => request<Node>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string, hardDelete?: boolean) => {
    const url = hardDelete ? `/nodes/${id}?hard_delete=true` : `/nodes/${id}`;
    return request<{ 
      message: string;
      affected_graphs?: string[];
      deleted_graph_nodes?: number;
      deleted_edges?: number;
      deleted_cards?: number;
    }>(url, { method: 'DELETE' });
  },
  
  batchDelete: (node_ids: string[], options?: { hard_delete?: boolean }) => 
    request('/nodes/batch-delete', { 
      method: 'POST', 
      body: JSON.stringify({ node_ids, ...options }) 
    }),
  
  batchUpdatePositions: (positions: Array<{ id: string; x_position: number; y_position: number }>) => 
    request('/nodes/batch-update-positions', { method: 'POST', body: JSON.stringify({ positions }) }),
  
  getRelated: (id: string) => request(`/nodes/${id}/related`),
  
  searchSimilar: (params: {
    title: string;
    content?: string;
    threshold?: number;
    limit?: number;
  }) => request<Array<{
    id: string;
    title: string;
    content?: string;
    similarity: number;
    graphs_count: number;
  }>>('/nodes/search-similar', { 
    method: 'POST', 
    body: JSON.stringify(params) 
  }),
  
  getKnowledgePointGraphs: (nodeId: string) => 
    request<Array<{
      graph_id: string;
      graph_title: string;
      x_position: number;
      y_position: number;
      level: string;
    }>>(`/nodes/${nodeId}/knowledge-point-graphs`, { method: 'GET' }),
};

export const edgesApi = {
  create: (data: { 
    source_node_id: string; 
    target_node_id: string; 
    graph_id: string; 
    relationship_type?: string;
    source_graph_node_id?: string;
    target_graph_node_id?: string;
  }) => request<Edge>('/edges', { method: 'POST', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/edges/${id}`, { method: 'DELETE' }),
};
