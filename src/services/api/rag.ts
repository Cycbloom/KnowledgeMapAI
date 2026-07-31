import { request, getAIConfig, getApiUrl } from './client';
import { useStore } from '@/store/useStore';
import { getAILanguage } from '@/hooks/ai/useAILanguage';
import { logger } from '@/utils/logger';
import { AppError, SharedErrorCodes } from "@/utils/errors";

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

    const token = useStore.getState().token;
    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/rag/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      if (response.status === 401) {
        useStore.getState().setUser(null, null);
      }
      const errorText = await response.text();
      throw new AppError(errorText || 'RAG Chat Stream failed', SharedErrorCodes.AI_PROVIDER_ERROR, 502);
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
            if (parsed.sources && onSources) onSources(parsed.sources as Source[]);
            if (parsed.error) throw new AppError(parsed.error, SharedErrorCodes.AI_INVALID_RESPONSE, 502);
          } catch (e) {
            if (signal?.aborted) {
              throw e;
            }
            logger.error('Stream parse error:', e);
          }
        }
      }
    }
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
