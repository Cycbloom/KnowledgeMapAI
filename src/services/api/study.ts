import { request } from './client';

export const studyApi = {
  getCards: (params?: { graph_id?: string; node_id?: string; node_ids?: string; due?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.graph_id) search.set('graph_id', params.graph_id);
    else if (params?.node_id) search.set('node_id', params.node_id);
    else if (params?.node_ids) search.set('node_ids', params.node_ids);
    if (params?.due) search.set('due', 'true');
    const query = search.toString();
    return request(`/study/cards${query ? `?${query}` : ''}`);
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
};

export const dashboardApi = {
  getStats: () => request('/dashboard/stats'),
};

export const statisticsApi = {
  getStats: () => request('/statistics'),
};
