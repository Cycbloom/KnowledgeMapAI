import { request } from './client';
import type { BacklinkItem, OutlinkItem, KnowledgePointSearchHit, NodeBlockRefBacklink } from '@shared/types';
import type { IBacklinksApi } from './contracts/IBacklinksApi';

export const backlinksApi: IBacklinksApi = {
  list: (knowledgePointId: string) =>
    request<BacklinkItem[]>(`/backlinks/${knowledgePointId}`, { method: 'GET' }),

  getOutlinks: (knowledgePointId: string) =>
    request<OutlinkItem[]>(`/backlinks/${knowledgePointId}/outlinks`, { method: 'GET' }),

  search: (
    query: string,
    options?: { graphId?: string; limit?: number },
  ) => {
    const params = new URLSearchParams({ q: query });
    if (options?.graphId) params.set('graphId', options.graphId);
    if (options?.limit) params.set('limit', String(options.limit));
    return request<KnowledgePointSearchHit[]>(`/backlinks/search?${params.toString()}`, {
      method: 'GET',
    });
  },

  getBlockRefBacklinks: (knowledgePointId: string) =>
    request<NodeBlockRefBacklink[]>(`/backlinks/${knowledgePointId}/block-refs`, { method: 'GET' }),
};
