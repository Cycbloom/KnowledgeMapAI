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
    request<{ id: string; name: string }>('/api/domains/ensure-uncategorized', { method: 'GET' }),
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
