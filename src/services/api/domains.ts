import { request } from './client';
import type {
  Domain,
  DomainTreeNode,
} from '@shared/types/graph';

export const domainsApi = {
  getTree: () =>
    request<DomainTreeNode[]>('/domains', { method: 'GET' }),

  getById: (domainId: string) =>
    request<Domain>(`/domains/${domainId}`, { method: 'GET' }),

  create: (data: {
    name: string;
    color: string;
    description?: string;
    parent_id?: string;
    icon?: string;
  }) => request<Domain>('/domains', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (
    domainId: string,
    data: {
      name?: string;
      color?: string;
      description?: string;
      parent_id?: string;
      icon?: string;
      sort_order?: number;
    }
  ) => request<Domain>(`/domains/${domainId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  delete: (domainId: string) =>
    request<void>(`/domains/${domainId}`, { method: 'DELETE' }),

  ensureUncategorized: () =>
    request<{ id: string; name: string }>('/domains/ensure-uncategorized', { method: 'GET' }),

  reorder: (data: {
    reorder_items: Array<{
      id: string;
      parent_id?: string | null;
      sort_order: number;
    }>;
  }) =>
    request<{ success: boolean; updated_count: number }>('/domains/reorder', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  generateColor: (name: string, description?: string) =>
    request<{ color: string; reason: string }>('/domains/generate-color', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  recommendDomains: (title: string, description?: string) =>
    request<{ recommendations: Array<{ id: string; name: string; confidence: number; reason: string }> }>('/domains/recommend', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),
};

export const graphDomainsApi = {
  getByGraphId: (graphId: string) =>
    request<Array<Domain & { is_primary: boolean }>>(
      `/graphs/${graphId}/domains`,
      { method: 'GET' }
    ),

  updateByGraphId: (
    graphId: string,
    domains: Array<{ domain_id: string; is_primary?: boolean }>
  ) =>
    request<void>(`/graphs/${graphId}/domains`, {
      method: 'PUT',
      body: JSON.stringify({ domains })
    }),
};
