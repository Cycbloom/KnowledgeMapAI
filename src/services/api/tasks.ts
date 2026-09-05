import { request, requestBlob } from './client';
import type { Task } from '@shared/types';

export const tasksApi = {
  create: (data: { type: string; payload: unknown }) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  list: (status?: string, limit: number = 20, offset: number = 0) =>
    request<{ tasks: Task[]; total: number }>(`/tasks?${new URLSearchParams({
      ...(status && { status }),
      limit: limit.toString(),
      offset: offset.toString()
    }).toString()}`),

  retry: (id: string) => request<Task>(`/tasks/${id}/retry`, { method: 'POST' }),

  pause: (id: string) => request<{ success: boolean }>(`/tasks/${id}/pause`, { method: 'POST' }),

  resume: (id: string) => request<{ success: boolean }>(`/tasks/${id}/resume`, { method: 'POST' }),

  cancel: (id: string) => request<{ success: boolean }>(`/tasks/${id}/cancel`, { method: 'POST' }),

  delete: (id: string) => request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const searchApi = {
  query: (q: string, type: 'keyword' | 'semantic' | 'hybrid' = 'keyword') =>
    request<unknown>(`/search?q=${encodeURIComponent(q)}&type=${type}`),
};

export const dataApi = {
  export: (graphId: string, format: 'json' | 'pdf' | 'markdown') =>
    requestBlob(`/data/export/${encodeURIComponent(format)}?graph_id=${encodeURIComponent(graphId)}`),

  import: (data: unknown) => request<unknown>('/data/import', { method: 'POST', body: JSON.stringify(data) }),
};
