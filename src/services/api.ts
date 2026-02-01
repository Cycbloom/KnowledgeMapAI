import { useStore } from '../store/useStore';

const API_URL = '/api';

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
      // Clear token and user on 401 Unauthorized
      useStore.getState().setUser(null, null);
    }
    const error = (data && data.message) || (data && data.error) || res.statusText;
    throw new Error(error);
  }
  
  return data;
};

const request = (url: string, options: RequestInit = {}) => {
  return fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  }).then(handleResponse);
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
    update: (id: string, data: any) => request(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/nodes/${id}`, { method: 'DELETE' }),
  },
  edges: {
    create: (data: any) => request('/edges', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/edges/${id}`, { method: 'DELETE' }),
  },
  ai: {
    status: () => request('/ai/status'),
    generate: (data: any) => request('/ai/generate-content', { method: 'POST', body: JSON.stringify(data) }),
    generateContentStream: async (data: any, onChunk: (content: string) => void) => {
      const token = useStore.getState().token;
      const response = await fetch(`${API_URL}/ai/generate-content-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data)
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
    expand: (data: any) => request('/ai/expand-knowledge', { method: 'POST', body: JSON.stringify(data) }),
    generateCards: (data: any) => request('/ai/generate-cards', { method: 'POST', body: JSON.stringify(data) }),
    textToGraph: (data: { text?: string; graph_id: string; action?: 'analyze' | 'save'; nodes?: any[]; edges?: any[] }) => request('/ai/text-to-graph', { method: 'POST', body: JSON.stringify(data) }),
    documentToGraph: (data: { graph_id: string; file: File }) => {
      const token = useStore.getState().token;
      const formData = new FormData();
      formData.append('graph_id', data.graph_id);
      formData.append('file', data.file);
      
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
    chatStream: async (data: { message: string; graph_id: string; history?: any[]; context_node_ids?: string[] }, onChunk: (content: string) => void) => {
      const token = useStore.getState().token;
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data)
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
  tasks: {
    create: (data: { type: string; payload: any }) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    list: () => request('/tasks'),
  },
  data: {
    export: (graphId: string, format: 'json' | 'pdf') => {
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
