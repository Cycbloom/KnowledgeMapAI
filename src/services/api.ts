import { useStore } from '../store/useStore';

const API_URL = '/api';

// Queue for pending requests during refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const getHeaders = () => {
  const token = useStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = {};
  }
  
  if (!res.ok) {
    if (res.status === 401) {
      // Throw 401 to be caught by request interceptor
      throw new Error('Unauthorized');
    }
    const error = (data && data.message) || (data && data.error) || res.statusText;
    throw new Error(error);
  }
  
  return data;
};

const request = async (url: string, options: RequestInit = {}) => {
  const doRequest = async (tokenOverride?: string) => {
    const headers: any = {
      ...getHeaders(),
      ...options.headers,
    };
    
    if (tokenOverride) {
      headers['Authorization'] = `Bearer ${tokenOverride}`;
    }

    return fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    }).then(handleResponse);
  };

  try {
    return await doRequest();
  } catch (error: any) {
    // Intercept 401 Unauthorized
    if (error.message === 'Unauthorized' && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
      const { refreshToken } = useStore.getState();

      if (!refreshToken) {
        useStore.getState().setUser(null, null);
        throw error;
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          return doRequest(token as string);
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) {
           throw new Error('Refresh failed');
        }

        const data = await refreshRes.json();
        const { session, user } = data;
        
        // Update store with new tokens
        useStore.getState().setUser(user, session.access_token, session.refresh_token);
        
        // Retry queued requests
        processQueue(null, session.access_token);
        
        // Retry current request
        return await doRequest(session.access_token);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useStore.getState().setUser(null, null); // Logout on refresh failure
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
    
    throw error;
  }
};

const getAIConfig = (taskType: 'text' | 'embedding' | 'reasoning' = 'text') => {
  const { user } = useStore.getState();
  const config = user?.profile?.settings?.ai_config?.[taskType];
  return {
    provider: config?.provider,
    model: config?.model
  };
};

export const api = {
  auth: {
    register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getUser: () => request('/auth/user'),
    updateProfile: (data: any) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  graphs: {
    list: () => request('/graphs'),
    create: (data: any) => request('/graphs', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/graphs/${id}`),
    getNodes: (id: string) => request(`/graphs/${id}/nodes`),
    getNodeStatus: (id: string) => request(`/graphs/${id}/node-status`),
    update: (id: string, data: any) => request(`/graphs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/graphs/${id}`, { method: 'DELETE' }),
  },
  nodes: {
    create: (data: any) => request('/nodes', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/nodes/${id}`),
    update: (id: string, data: any) => request(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/nodes/${id}`, { method: 'DELETE' }),
    batchDelete: (node_ids: string[]) => request('/nodes/batch-delete', { method: 'POST', body: JSON.stringify({ node_ids }) }),
    getRelated: (id: string) => request(`/nodes/${id}/related`),
  },
  edges: {
    create: (data: any) => request('/edges', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/edges/${id}`, { method: 'DELETE' }),
  },
  ai: {
    status: () => request('/ai/status'),
    generateContent: (data: { topic: string; context?: string; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/generate-content', { method: 'POST', body: JSON.stringify(payload) });
    },
    generateLearningMaterial: (data: { topic: string; context?: string; level?: string; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/learning-material', { method: 'POST', body: JSON.stringify(payload) });
    },
    generateContentStream: async (data: { topic: string; context?: string; level?: string; provider?: string; model?: string }, onChunk: (content: string) => void) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;

      const token = useStore.getState().token;
      const response = await fetch(`${API_URL}/ai/generate-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
         if (response.status === 401) {
            useStore.getState().setUser(null, null);
         }
         const errorText = await response.text();
         throw new Error(errorText || 'AI Stream failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') return;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) onChunk(parsed.content);
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
               console.error('Stream parse error:', e);
            }
          }
        }
      }
    },
    expand: (data: { node_title: string; node_content?: string; existing_nodes?: any[]; child_nodes?: any[]; context_level?: string; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/expand-knowledge', { method: 'POST', body: JSON.stringify(payload) });
    },
    generateCards: (data: { node_title: string; node_content: string; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/generate-cards', { method: 'POST', body: JSON.stringify(payload) });
    },
    batchGenerateCards: (node_ids: string[], config: { types?: string[]; count?: number; pack_template?: string; provider?: string; model?: string }) => {
      const aiConfig = getAIConfig('text');
      const payloadConfig = { ...config };
      if (!payloadConfig.provider && aiConfig.provider) payloadConfig.provider = aiConfig.provider;
      if (!payloadConfig.model && aiConfig.model) payloadConfig.model = aiConfig.model;
      return request('/ai/batch-generate-cards', { method: 'POST', body: JSON.stringify({ node_ids, config: payloadConfig }) });
    },
    getTaskStatus: (id: string) => request(`/ai/tasks/${id}`),
    textToGraph: (data: { text?: string; graph_id: string; action?: 'analyze' | 'save'; nodes?: any[]; edges?: any[]; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/text-to-graph', { method: 'POST', body: JSON.stringify(payload) });
    },
    documentToGraph: (data: { graph_id: string; file: File }) => {
      const token = useStore.getState().token;
      const config = getAIConfig('text');
      const formData = new FormData();
      formData.append('graph_id', data.graph_id);
      formData.append('file', data.file);
      if (config.provider) formData.append('provider', config.provider);
      if (config.model) formData.append('model', config.model);
      
      return fetch(`${API_URL}/ai/document-to-graph`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData
      }).then(handleResponse);
    },
    recommendConnections: (data: { graph_id: string; node_title: string; node_content?: string }) => 
      request('/ai/recommend-connections', { method: 'POST', body: JSON.stringify(data) }),
    chatStream: async (data: { message: string; graph_id: string; history?: any[]; context_node_ids?: string[]; provider?: string; model?: string }, onChunk: (content: string) => void) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;

      const token = useStore.getState().token;
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
         if (response.status === 401) {
            useStore.getState().setUser(null, null);
         }
         const errorText = await response.text();
         throw new Error(errorText || 'Chat Stream failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') return;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) onChunk(parsed.content);
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
               console.error('Stream parse error:', e);
            }
          }
        }
      }
    },
  },
  study: {
    getCards: (params?: { graph_id?: string; node_id?: string; node_ids?: string; due?: boolean }) => {
      const search = new URLSearchParams();
      if (params?.graph_id) search.set('graph_id', params.graph_id);
      else if (params?.node_id) search.set('node_id', params.node_id);
      else if (params?.node_ids) search.set('node_ids', params.node_ids);
      if (params?.due) search.set('due', 'true');
      const query = search.toString();
      return request(`/study/cards${query ? `?${query}` : ''}`);
    },
    createCardsBatch: (cards: any[]) => request('/study/cards/batch', { method: 'POST', body: JSON.stringify({ cards }) }),
    updateProgress: (id: string, quality: number) => request(`/study/cards/${id}/progress`, { method: 'PUT', body: JSON.stringify({ quality }) }),
  },
  dashboard: {
    getStats: () => request('/dashboard/stats'),
  },
  statistics: {
    getStats: () => request('/statistics'),
  },
  search: {
    query: (q: string, type: 'keyword' | 'semantic' | 'hybrid' = 'keyword') => request(`/search?q=${encodeURIComponent(q)}&type=${type}`),
  },
  tasks: {
    create: (data: { type: string; payload: any }) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    list: (status?: string) => request(`/tasks${status ? `?status=${status}` : ''}`),
    retry: (id: string) => request(`/tasks/${id}/retry`, { method: 'POST' }),
    delete: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  },
  data: {
    export: (graphId: string, format: 'json' | 'pdf' | 'markdown') => {
      const token = useStore.getState().token;
      return fetch(`${API_URL}/data/export/${format}?graph_id=${graphId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      }).then(async res => {
        if (!res.ok) {
           if (res.status === 401) {
              useStore.getState().setUser(null, null);
           }
           const text = await res.text();
           throw new Error(text || 'Export failed');
        }
        return res.blob();
      });
    },
    import: (data: any) => request('/data/import', { method: 'POST', body: JSON.stringify(data) }),
  }
};
