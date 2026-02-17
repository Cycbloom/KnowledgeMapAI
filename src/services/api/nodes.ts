import { request } from './client';

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
  }) => request('/nodes', { method: 'POST', body: JSON.stringify(data) }),
  
  get: (id: string) => request(`/nodes/${id}`),
  
  update: (id: string, data: { 
    title?: string; 
    content?: string; 
    level?: string;
    x_position?: number;
    y_position?: number;
    learning_material?: string;
    properties?: Record<string, unknown>;
  }) => request(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/nodes/${id}`, { method: 'DELETE' }),
  
  batchDelete: (node_ids: string[]) => 
    request('/nodes/batch-delete', { method: 'POST', body: JSON.stringify({ node_ids }) }),
  
  batchUpdatePositions: (positions: Array<{ id: string; x_position: number; y_position: number }>) => 
    request('/nodes/batch-update-positions', { method: 'POST', body: JSON.stringify({ positions }) }),
  
  getRelated: (id: string) => request(`/nodes/${id}/related`),
};

export const edgesApi = {
  create: (data: { source_node_id: string; target_node_id: string; graph_id: string; relationship_type?: string }) => 
    request('/edges', { method: 'POST', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/edges/${id}`, { method: 'DELETE' }),
};
