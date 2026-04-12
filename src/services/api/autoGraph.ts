import { request, getAIConfig } from './client';
import type { TemplateCategory, LayoutSuggestion, NodeLevel } from '@shared/types/graph';

export interface GenerateTemplatesData {
  topic: string;
  context?: string;
  category?: TemplateCategory;
  provider?: string;
  model?: string;
  graph_id?: string;
  maxNodes?: number;
  preferredLayout?: LayoutSuggestion;
}

export interface TemplateNodeData {
  id: string;
  title: string;
  description?: string;
  level: NodeLevel;
  parentId?: string;
  suggestedContent?: string;
  color?: string;
}

export interface TemplateEdgeData {
  source: string;
  target: string;
  relationship_type?: string;
  description?: string;
}

export interface GeneratedTemplate {
  id: string;
  name: string;
  description?: string;
  nodes: TemplateNodeData[];
  edges: TemplateEdgeData[];
  layoutSuggestion: LayoutSuggestion;
  estimatedNodes?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  reasoning?: string;
}

export interface GenerateTemplatesResult {
  templates: GeneratedTemplate[];
  metadata: {
    topic: string;
    category?: TemplateCategory;
    provider: string;
    model: string;
    generatedAt: string;
  };
}

export interface ApplyTemplateData {
  template?: GeneratedTemplate;
  templateId?: string;
  topic: string;
  style?: 'academic' | 'practical' | 'beginner' | 'custom';
  customPrompt?: string;
  graph_id: string;
  provider?: string;
  model?: string;
}

export interface AppliedTemplateNode {
  id: string;
  title: string;
  content?: string;
  level: NodeLevel;
  parentId?: string;
}

export interface AppliedTemplateEdge {
  source: string;
  target: string;
  relationship_type?: string;
}

export interface ApplyTemplateResult {
  templateId: string;
  templateName: string;
  nodes: AppliedTemplateNode[];
  edges: AppliedTemplateEdge[];
  layoutSuggestion: LayoutSuggestion;
  metadata: {
    topic: string;
    style: string;
    generatedAt: string;
    provider: string;
    model: string;
  };
}

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

  generateEmbeddings: (limit?: number) => 
    request('/auto-graph/generate-embeddings', { 
      method: 'POST', 
      body: JSON.stringify({ limit }) 
    }),

  getEmbeddingStatus: () => 
    request('/auto-graph/embedding-status', { method: 'GET' }),

  generateTemplates: (data: GenerateTemplatesData): Promise<GenerateTemplatesResult> => {
    const config = getAIConfig('text');
    const payload = { ...data };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;
    return request('/auto-graph/generate-templates', { method: 'POST', body: JSON.stringify(payload) });
  },

  applyTemplate: (data: ApplyTemplateData): Promise<ApplyTemplateResult> => {
    const config = getAIConfig('text');
    const payload = { style: 'academic', ...data };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;
    return request('/auto-graph/apply-template', { method: 'POST', body: JSON.stringify(payload) });
  },
};
