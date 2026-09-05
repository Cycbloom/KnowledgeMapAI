import { request, getAIConfig } from './client';
import { getAILanguage } from '@/hooks/ai/useAILanguage';
import { createStreamHandler } from '../shared/streamHandler';

interface Source {
  id: string;
  title: string;
  content: string;
  similarity: number;
  hopDistance?: number;
  relationshipPath?: string;
  relationshipType?: string;
}

interface RagChatResponse {
  answer: string;
  sources: Source[];
  suggestedQuestions?: string[];
}

interface RagSearchResponse {
  results: Source[];
}

interface KnowledgeGap {
  topic: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface AnalyzeGapsResponse {
  gaps: KnowledgeGap[];
  suggestions: string[];
}

export const ragApi = {
  chat: (data: {
    message: string;
    graph_id?: string;
    current_node_id?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    provider?: string;
    model?: string;
    language?: string;
    session_id?: string;
    use_graph_context?: boolean;
    graph_hops?: number;
    search_mode?: 'semantic' | 'keyword' | 'hybrid';
  }) => {
    const config = getAIConfig('text');
    const payload = { ...data, language: data.language || getAILanguage() };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;
    return request<RagChatResponse>('/rag/chat', { method: 'POST', body: JSON.stringify(payload) });
  },
  
  chatStream: async (
    data: {
      message: string;
      graph_id?: string;
      current_node_id?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      session_id?: string;
      use_graph_context?: boolean;
      graph_hops?: number;
      search_mode?: 'semantic' | 'keyword' | 'hybrid';
    },
    onChunk: (content: string) => void,
    onSources?: (sources: Source[]) => void,
    signal?: AbortSignal
  ) => {
    const config = getAIConfig('text');
    const payload = { ...data, language: data.language || getAILanguage() };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;

    await createStreamHandler(
      "/rag/chat/stream",
      payload,
      onChunk,
      {
        signal,
        onEvent: (event) => {
          if (event.sources && onSources) onSources(event.sources as Source[]);
        },
      },
    );
  },
    search: (data: {
    query: string;
    graph_id?: string;
    match_threshold?: number;
    match_count?: number;
    use_graph_context?: boolean;
    graph_hops?: number;
    search_mode?: 'semantic' | 'keyword' | 'hybrid';
  }) => request<RagSearchResponse>('/rag/search', { method: 'POST', body: JSON.stringify(data) }),

  analyzeGaps: (graphId: string) => request<AnalyzeGapsResponse>('/rag/analyze-gaps', {
    method: 'POST',
    body: JSON.stringify({ graph_id: graphId })
  }),
};
