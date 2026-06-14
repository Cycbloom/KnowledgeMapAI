import { request } from './client';
import type { Node, Edge, Keyword } from '@/types';
import type {
  CreateNodeData,
  UpdateNodeData,
  CreateEdgeData,
  NodePositionUpdate,
  DeleteNodeResult,
} from '@shared/types/api';
import type { INodesApi, IEdgesApi } from './contracts';

export const nodesApi: INodesApi = {
  create: (data: CreateNodeData) => request<Node>('/nodes', { method: 'POST', body: JSON.stringify(data) }),
  
  get: (id: string) => request<Node>(`/nodes/${id}`),
  
  update: (id: string, data: UpdateNodeData & { keywords?: Keyword[] }) => request<Node>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string, hardDelete?: boolean) => {
    const url = hardDelete ? `/nodes/${id}?hard_delete=true` : `/nodes/${id}`;
    return request<DeleteNodeResult>(url, { method: 'DELETE' });
  },
  
  batchDelete: (node_ids: string[], options?: { hard_delete?: boolean }) => 
    request('/nodes/batch-delete', { 
      method: 'POST', 
      body: JSON.stringify({ node_ids, ...options }) 
    }),
  
  batchUpdatePositions: (positions: NodePositionUpdate[]) => 
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

export const edgesApi: IEdgesApi = {
  create: (data: CreateEdgeData) => request<Edge>('/edges', { method: 'POST', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/edges/${id}`, { method: 'DELETE' }),
};
