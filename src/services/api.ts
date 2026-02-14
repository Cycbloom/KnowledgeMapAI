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

export interface AIActionVariables {
  includeParent?: boolean;
  includeSiblings?: boolean;
  includeChildren?: boolean;
}

export interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  target_mode: 'show_result' | 'update_node' | 'spawn_children';
  scope: 'system' | 'user' | 'graph';
  user_id?: string;
  graph_id?: string;
  prompt_template: string;
  variables?: AIActionVariables;
}

export const api = {
  aiActions: {
    list: (graphId?: string) => request(`/ai-actions${graphId ? `?graph_id=${graphId}` : ''}`),
    create: (data: Partial<AIAction>) => request('/ai-actions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AIAction>) => request(`/ai-actions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/ai-actions/${id}`, { method: 'DELETE' }),
    execute: (data: { action_id: string; node_id: string; graph_id?: string }) => request('/ai-actions/execute', { method: 'POST', body: JSON.stringify(data) }),
  },
  auth: {
    register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getUser: () => request('/auth/user'),
    updateProfile: (data: any) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  graphs: {
    list: () => request('/graphs'),
    listTrash: () => request('/graphs/trash'),
    create: (data: any) => request('/graphs', { method: 'POST', body: JSON.stringify(data) }),
    createFromTemplate: (data: any) => request('/graphs/from-template', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request(`/graphs/${id}`),
    getNodes: (id: string) => request(`/graphs/${id}/nodes`),
    getNodeStatus: (id: string) => request(`/graphs/${id}/node-status`),
    update: (id: string, data: any) => request(`/graphs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    togglePublic: (id: string, is_public: boolean) => request(`/graphs/${id}/share`, { method: 'PUT', body: JSON.stringify({ is_public }) }),
    delete: (id: string) => request(`/graphs/${id}`, { method: 'DELETE' }),
    restore: (id: string) => request(`/graphs/${id}/restore`, { method: 'POST' }),
    permanentDelete: (id: string) => request(`/graphs/${id}/permanent`, { method: 'DELETE' }),
    getLearningPath: (id: string) => request(`/graphs/${id}/learning-path`),
    analyze: (id: string) => request(`/graphs/${id}/analyze`),
    getMissingConnections: (id: string, max?: number) => {
      const url = max ? `/graphs/${id}/missing-connections?max=${max}` : `/graphs/${id}/missing-connections`;
      return request(url);
    },
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
    annotateTerms: (data: { node_id: string; node_content: string; graph_id: string; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      return request('/ai/annotate-terms', { 
        method: 'POST', 
        body: JSON.stringify({
          ...data,
          provider: data.provider || config.provider,
          model: data.model || config.model
        }) 
      });
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
    getBranchSuggestions: (data: { node_title: string; node_content?: string; existing_nodes?: any[]; child_nodes?: any[]; context_level?: string; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/branch-suggestions', { method: 'POST', body: JSON.stringify(payload) });
    },
    generateCards: (data: { node_title: string; node_content: string; count?: number; types?: string[]; provider?: string; model?: string }) => {
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
    batchExpandGraph: (node_ids: string[]) => {
      return request('/ai/batch-expand-graph', { method: 'POST', body: JSON.stringify({ node_ids }) });
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
    imageToGraph: (formData: FormData) => request('/ai/image-to-graph', { method: 'POST', body: formData }),
    urlToText: (url: string) => request('/ai/url-to-text', { method: 'POST', body: JSON.stringify({ url }) }),
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
    tutorChatStream: async (data: { message: string; graph_id?: string; history?: any[]; context_node_ids?: string[]; mode?: 'free' | 'guided'; provider?: string; model?: string }, onChunk: (content: string) => void) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;

      const token = useStore.getState().token;
      const response = await fetch(`${API_URL}/ai/tutor-chat`, {
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
         throw new Error(errorText || 'Tutor Chat Stream failed');
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
    extractConcepts: (data: { text: string; existing_nodes?: string[]; max_concepts?: number; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/extract-concepts', { method: 'POST', body: JSON.stringify(payload) });
    },
    suggestNextTopic: (data: { node_title: string; node_content?: string; existing_nodes?: string[]; user_progress?: { mastered_count?: number; due_count?: number; current_level?: string }; provider?: string; model?: string }) => {
      const config = getAIConfig('text');
      const payload = { ...data };
      if (!payload.provider && config.provider) payload.provider = config.provider;
      if (!payload.model && config.model) payload.model = config.model;
      return request('/ai/suggest-next-topic', { method: 'POST', body: JSON.stringify(payload) });
    },
    generatePodcastScript: (context: string, language: string = 'zh', graph_id?: string) => {
      const config = getAIConfig('text');
      return request('/ai/podcast/script', { 
        method: 'POST', 
        body: JSON.stringify({ 
          context, 
          language,
          graph_id,
          provider: config.provider,
          model: config.model 
        }) 
      });
    },
  },
  tts: {
    health: () => request('/ai/tts/health'),
    voices: () => request('/ai/tts/voices'),
    synthesize: async (data: { text: string; voice?: string; speed?: number; output_format?: string }) => {
      const token = useStore.getState().token;
      const response = await fetch(`${API_URL}/ai/tts`, {
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
        throw new Error(errorText || 'TTS synthesis failed');
      }

      return response.blob();
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
    update: (id: string, data: any) => request(`/study/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/study/cards/${id}`, { method: 'DELETE' }),
    deleteBatch: (ids: string[]) => request('/study/cards/batch', { method: 'DELETE', body: JSON.stringify({ ids }) }),
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
    list: (status?: string, limit: number = 20, offset: number = 0) => 
      request(`/tasks?${new URLSearchParams({
        ...(status && { status }),
        limit: limit.toString(),
        offset: offset.toString()
      }).toString()}`),
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
  },
  templates: {
    list: (category?: string) => request(`/templates${category ? `?category=${category}` : ''}`),
    get: (id: string) => request(`/templates/${id}`),
    create: (data: any) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/templates/${id}`, { method: 'DELETE' }),
  },
  prompts: {
    list: (graphId?: string) => request(`/prompts${graphId ? `?graph_id=${graphId}` : ''}`),
    save: (data: { code: string; scope: 'user'|'graph'; template_content: string; graph_id?: string }) => 
      request('/prompts', { method: 'POST', body: JSON.stringify(data) }),
    reset: (id: string) => request(`/prompts/${id}`, { method: 'DELETE' }),
    optimize: (data: { template_content: string; instruction?: string }) => 
      request('/prompts/optimize', { method: 'POST', body: JSON.stringify(data) }),
  },
  focus: {
    saveSession: (data: { duration: number; mode: string; start_time: string; end_time: string }) => 
      request('/focus/sessions', { method: 'POST', body: JSON.stringify(data) }),
    getStats: () => request('/focus/stats'),
  },
  achievements: {
    list: () => request('/achievements'),
    check: (type: string, value: number) => request('/achievements/check', { method: 'POST', body: JSON.stringify({ type, value }) }),
    getDailyTasks: () => request('/achievements/daily-tasks'),
    checkIn: () => request('/achievements/daily-tasks/check-in', { method: 'POST' }),
  },
  learningPaths: {
    list: () => request('/learning-paths'),
    get: (id: string) => request(`/learning-paths/${id}`),
    create: (data: {
      title: string;
      description?: string;
      goal_type: 'natural_language' | 'graph_node' | 'template';
      goal_content?: string;
      target_node_id?: string;
      template_id?: string;
      daily_minutes_target?: number;
      target_completion_date?: string;
    }) => request('/learning-paths', { method: 'POST', body: JSON.stringify(data) }),
    generate: (data: {
      goal: string;
      context?: string;
      goal_type?: 'natural_language' | 'graph_node' | 'template';
      target_node_id?: string;
      template_id?: string;
      daily_minutes_target?: number;
      target_completion_date?: string;
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => request('/learning-paths/generate', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{
      title: string;
      description: string;
      status: 'active' | 'completed' | 'paused' | 'archived';
      daily_minutes_target: number;
      target_completion_date: string;
    }>) => request(`/learning-paths/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/learning-paths/${id}`, { method: 'DELETE' }),
    adjust: (id: string, data: {
      reason: string;
      node_ref_id?: string;
      adjustment_type: 'insert' | 'remove' | 'reorder' | 'difficulty';
    }) => request(`/learning-paths/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
    updateNodeStatus: (pathId: string, nodeRefId: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped') => 
      request(`/learning-paths/${pathId}/nodes/${nodeRefId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    reorderNodes: (pathId: string, nodeRefIds: string[]) => 
      request(`/learning-paths/${pathId}/nodes/reorder`, { method: 'PUT', body: JSON.stringify({ node_order: nodeRefIds }) }),
    addNode: (pathId: string, data: { node_id: string; estimated_minutes?: number; difficulty_level?: number }) =>
      request(`/learning-paths/${pathId}/nodes`, { method: 'POST', body: JSON.stringify(data) }),
    removeNode: (pathId: string, nodeRefId: string) =>
      request(`/learning-paths/${pathId}/nodes/${nodeRefId}`, { method: 'DELETE' }),
    getProgress: (id: string) => request(`/learning-paths/${id}/progress`),
    getRecommendations: (graphId: string) => request(`/learning-paths/recommendations?graph_id=${graphId}`),
  },
};
