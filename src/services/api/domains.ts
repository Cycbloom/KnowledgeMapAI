import { request } from './client';
import type {
  Domain,
  DomainTreeNode,
} from '@shared/types/graph';

// 自动分类领域：候选领域（一个图谱可同时出现在多个领域，多对多）
export interface AutoClassifiedDomain {
  suggestion_id: string;
  name: string;
  description: string;
  graph_ids: string[];
  graph_titles: string[];
}

export interface AutoClassifyGraphInfo {
  id: string;
  title: string;
  description: string;
  existing_domains: string[];
}

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

  // 根据已有图谱自动聚类合成领域（候选确认后再创建）
  autoClassify: (data?: { graph_ids?: string[]; max_domains?: number }) =>
    request<{ domains: AutoClassifiedDomain[]; graphs: AutoClassifyGraphInfo[] }>('/domains/auto-classify', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  // 批量创建领域并建立图谱-领域多对多关联
  applyClassify: (data: {
    domains: Array<{ name: string; description?: string; color?: string; graph_ids: string[] }>;
  }) =>
    request<{ created: Array<{ id: string; name: string; graphCount: number }> }>('/domains/apply-classify', {
      method: 'POST',
      body: JSON.stringify(data),
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
