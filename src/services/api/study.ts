import { request } from './client';

export const studyApi = {
  getCards: (params?: { 
    graph_id?: string; 
    knowledge_point_id?: string;
    knowledge_point_ids?: string[];
    source_graph_id?: string;
    due?: boolean 
  }) => {
    const search = new URLSearchParams();
    if (params?.graph_id) search.set('graph_id', params.graph_id);
    if (params?.knowledge_point_id) search.set('knowledge_point_id', params.knowledge_point_id);
    if (params?.knowledge_point_ids) search.set('knowledge_point_ids', params.knowledge_point_ids.join(','));
    if (params?.source_graph_id) search.set('source_graph_id', params.source_graph_id);
    if (params?.due) search.set('due', 'true');
    const query = search.toString();
    return request(`/study/cards${query ? `?${query}` : ''}`);
  },
  
  getCardsByKnowledgePoint: (knowledgePointId: string, params?: {
    source_graph_id?: string;
    due?: boolean;
  }) => {
    const search = new URLSearchParams();
    search.set('knowledge_point_id', knowledgePointId);
    if (params?.source_graph_id) search.set('source_graph_id', params.source_graph_id);
    if (params?.due) search.set('due', 'true');
    return request(`/study/cards?${search.toString()}`);
  },
  
  createCardsBatch: (cards: unknown[]) => 
    request('/study/cards/batch', { method: 'POST', body: JSON.stringify({ cards }) }),
  
  update: (id: string, data: unknown) => 
    request(`/study/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string) => 
    request(`/study/cards/${id}`, { method: 'DELETE' }),
  
  deleteBatch: (ids: string[]) => 
    request('/study/cards/batch', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  
  updateProgress: (id: string, quality: number) => 
    request(`/study/cards/${id}/progress`, { method: 'PUT', body: JSON.stringify({ quality }) }),
  
  getCardGroups: (knowledgePointId: string) => 
    request<Array<{ source_graph_id: string; graph_title: string; card_count: number }>>(
      `/study/cards/groups/${knowledgePointId}`
    ),
};

export const dashboardApi = {
  getStats: () => request('/dashboard/stats'),
};

export const statisticsApi = {
  getStats: () => request('/statistics'),
};
