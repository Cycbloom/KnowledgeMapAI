import { request } from './client';
import { AppError, SharedErrorCodes } from "@/utils/errors";
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
  export: async (graphId: string, format: 'json' | 'pdf' | 'markdown') => {
    const { getApiUrl } = await import('./client');
    const token = (await import('../../store/useStore')).useStore.getState().token;
    return fetch(`${await getApiUrl()}/data/export/${encodeURIComponent(format)}?graph_id=${encodeURIComponent(graphId)}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
    }).then(async res => {
      if (!res.ok) {
        if (res.status === 401) {
          (await import('../../store/useStore')).useStore.getState().setUser(null, null);
        }
        const text = await res.text();
        throw new AppError(text || 'Export failed', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
      }
      return res.blob();
    });
  },
  
  import: (data: unknown) => request<unknown>('/data/import', { method: 'POST', body: JSON.stringify(data) }),
};
