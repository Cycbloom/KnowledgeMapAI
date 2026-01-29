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
  const data = text ? JSON.parse(text) : {};
  
  if (!res.ok) {
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
  },
  graphs: {
    list: () => request('/graphs'),
    create: (data: any) => request('/graphs', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/graphs/${id}`),
    getNodes: (id: string) => request(`/graphs/${id}/nodes`),
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
    generate: (data: any) => request('/ai/generate-content', { method: 'POST', body: JSON.stringify(data) }),
    expand: (data: any) => request('/ai/expand-knowledge', { method: 'POST', body: JSON.stringify(data) }),
  },
  study: {
    getCards: (graphId?: string) => request(`/study/cards${graphId ? `?graph_id=${graphId}` : ''}`),
    updateProgress: (id: string, quality: number) => request(`/study/cards/${id}/progress`, { method: 'PUT', body: JSON.stringify({ quality }) }),
  }
};
