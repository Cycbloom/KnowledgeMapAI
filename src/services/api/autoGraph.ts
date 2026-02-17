import { request, getAIConfig } from './client';

export const autoGraphApi = {
  init: (data: {
    topic: string;
    style?: 'academic' | 'practical' | 'beginner' | 'custom';
    customPrompt?: string;
    sources?: string[];
    graph_id?: string;
    provider?: string;
    model?: string;
  }) => {
    const config = getAIConfig('text');
    const payload = { style: 'academic', ...data };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;
    return request('/auto-graph/init', { method: 'POST', body: JSON.stringify(payload) });
  },
  
  expand: (data: {
    node_id: string;
    node_title: string;
    node_content?: string;
    node_level?: string;
    graph_id: string;
    style?: 'academic' | 'practical' | 'beginner' | 'custom';
    customPrompt?: string;
    existing_children?: Array<{ title: string; content?: string }>;
    provider?: string;
    model?: string;
  }) => {
    const config = getAIConfig('text');
    const payload = { style: 'academic', ...data };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;
    return request('/auto-graph/expand', { method: 'POST', body: JSON.stringify(payload) });
  },
  
  saveNodes: (data: {
    graph_id: string;
    nodes: Array<{ 
      id?: string;
      title: string; 
      content?: string; 
      level?: string;
      parentId?: string;
    }>;
  }) => request('/auto-graph/save-nodes', { method: 'POST', body: JSON.stringify(data) }),
  
  optimizePrompt: (data: {
    topic: string;
    currentPrompt?: string;
  }) => request('/auto-graph/optimize-prompt', { method: 'POST', body: JSON.stringify(data) }),
};
