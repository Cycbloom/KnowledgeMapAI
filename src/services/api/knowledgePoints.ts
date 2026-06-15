import { request } from './client';
import type { 
  KnowledgePoint, 
  KnowledgePointWithGraphs, 
  SimilarKnowledgePoint,
  DeleteKnowledgePointResult,
  GraphNode,
  GraphNodeWithKnowledgePoint,
  CombinedViewData,
  KnowledgePointVisibility,
  KnowledgePointVersion,
  KnowledgePointVersionWithDiff
} from '@/types';

export const knowledgePointsApi = {
  list: (params?: { visibility?: KnowledgePointVisibility }) => {
    const query = params?.visibility ? `?visibility=${params.visibility}` : '';
    return request<KnowledgePoint[]>(`/knowledge-points${query}`, { 
      method: 'GET'
    });
  },
  
  get: (id: string) => 
    request<KnowledgePoint>(`/knowledge-points/${id}`, { method: 'GET' }),
  
  getWithGraphs: (id: string) => 
    request<KnowledgePointWithGraphs>(`/knowledge-points/${id}/graphs`, { method: 'GET' }),
  
  create: (data: {
    title: string;
    content?: string;
    summary?: string;
    learning_material?: string;
    properties?: Record<string, unknown>;
    visibility?: KnowledgePointVisibility;
  }) => request<KnowledgePoint>('/knowledge-points', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id: string, data: {
    title?: string;
    content?: string;
    summary?: string;
    learning_material?: string;
    properties?: Record<string, unknown>;
    visibility?: KnowledgePointVisibility;
  }) => request<KnowledgePoint>(`/knowledge-points/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  
  searchSimilar: (params: {
    query: string;
    threshold?: number;
    limit?: number;
  }) => request<SimilarKnowledgePoint[]>('/knowledge-points/search-similar', { 
    method: 'POST', 
    body: JSON.stringify(params) 
  }),
  
  searchSimilarByEmbedding: (params: {
    embedding: number[];
    threshold?: number;
    limit?: number;
  }) => request<SimilarKnowledgePoint[]>('/knowledge-points/search-similar-embedding', { 
    method: 'POST', 
    body: JSON.stringify(params) 
  }),
  
  softDeleteFromGraph: (graphNodeId: string) => 
    request<{ success: boolean }>(`/graph-nodes/${graphNodeId}/soft-delete`, { 
      method: 'DELETE' 
    }),
  
  hardDelete: (knowledgePointId: string) => 
    request<DeleteKnowledgePointResult>(`/knowledge-points/${knowledgePointId}/hard-delete`, { 
      method: 'DELETE' 
    }),
  
  getGraphs: (knowledgePointId: string) => 
    request<Array<{
      graph_id: string;
      graph_title: string;
      x_position: number;
      y_position: number;
      level: string;
    }>>(`/knowledge-points/${knowledgePointId}/graphs`, { method: 'GET' }),
  
  getVersions: (knowledgePointId: string, params?: { limit?: number; offset?: number }) => {
    const queryParts: string[] = [];
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.offset) queryParts.push(`offset=${params.offset}`);
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return request<{
      versions: KnowledgePointVersionWithDiff[];
      total: number;
    }>(`/knowledge-points/${knowledgePointId}/versions${query}`, { method: 'GET' });
  },
  
  getVersion: (knowledgePointId: string, versionNumber: number) => 
    request<KnowledgePointVersion>(`/knowledge-points/${knowledgePointId}/versions/${versionNumber}`, { method: 'GET' }),
  
  compareVersions: (knowledgePointId: string, version1: number, version2: number) => 
    request<KnowledgePointVersionWithDiff[]>(`/knowledge-points/${knowledgePointId}/versions/compare?version1=${version1}&version2=${version2}`, { method: 'GET' }),
  
  rollbackVersion: (knowledgePointId: string, versionNumber: number) => 
    request<{ success: boolean; knowledge_point: KnowledgePoint }>(`/knowledge-points/${knowledgePointId}/versions/${versionNumber}/rollback`, { method: 'POST' }),
  
  createVersion: (knowledgePointId: string, changeSummary: string) => 
    request<KnowledgePointVersion>(`/knowledge-points/${knowledgePointId}/versions`, { 
      method: 'POST', 
      body: JSON.stringify({ change_summary: changeSummary }) 
    }),
};

export const graphNodesApi = {
  create: (data: {
    graph_id: string;
    knowledge_point_id: string;
    x_position?: number;
    y_position?: number;
    level?: string;
    is_accepted?: boolean;
  }) => request<GraphNode>('/graph-nodes', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  
  get: (id: string) => 
    request<GraphNodeWithKnowledgePoint>(`/graph-nodes/${id}`, { method: 'GET' }),
  
  update: (id: string, data: {
    x_position?: number;
    y_position?: number;
    level?: string;
    is_accepted?: boolean;
  }) => request<GraphNode>(`/graph-nodes/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  
  delete: (id: string) => 
    request<void>(`/graph-nodes/${id}`, { method: 'DELETE' }),
  
  batchUpdatePositions: (positions: Array<{ 
    id: string; 
    x_position: number; 
    y_position: number 
  }>) => request<void>('/graph-nodes/batch-update-positions', { 
    method: 'POST', 
    body: JSON.stringify({ positions }) 
  }),
  
  listByGraph: (graphId: string) => 
    request<GraphNodeWithKnowledgePoint[]>(`/graphs/${graphId}/nodes`, { method: 'GET' }),
  
  addExistingKnowledgePoint: (data: {
    graph_id: string;
    knowledge_point_id: string;
    x_position?: number;
    y_position?: number;
    level?: string;
  }) => request<GraphNode>('/graph-nodes/add-existing', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
};

export const combinedViewApi = {
  getData: (graphIds: string[]) => 
    request<CombinedViewData>('/combined-view', { 
      method: 'POST', 
      body: JSON.stringify({ graph_ids: graphIds }) 
    }),
};

