import { SupabaseClient } from '@supabase/supabase-js';
import { aiService } from './aiService.js';
import { logger } from '../utils/logger.js';

export interface SearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
}

export interface SearchGraphResult {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
}

export interface SearchNodeResult {
  id: string;
  title: string;
  content?: string;
  graph_id: string;
  knowledge_graphs?: {
    title: string;
  };
  similarity?: number;
  explanation?: string;
}

export interface SemanticSearchResult {
  graphs: SearchGraphResult[];
  nodes: SearchNodeResult[];
  answer: string;
}

export class SearchService {
  async search(
    supabase: SupabaseClient,
    query: string
  ): Promise<SearchResult> {
    const pattern = `%${query}%`;

    const { data: keywordGraphs, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description, updated_at')
      .ilike('title', pattern)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (graphError) {
      logger.error('Search graphs error:', graphError);
      throw graphError;
    }

    const { data: keywordGraphNodes, error: nodeError } = await supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        graph_id,
        knowledge_points (
          id,
          title,
          content
        ),
        knowledge_graphs (
          title
        )
      `)
      .or(`knowledge_points.title.ilike.${pattern},knowledge_points.content.ilike.${pattern}`)
      .is('deleted_at', null)
      .limit(20);

    if (nodeError) {
      logger.error('Search nodes error:', nodeError);
      throw nodeError;
    }

    const nodes: SearchNodeResult[] = (keywordGraphNodes || []).map((gn: any) => {
      const kp = Array.isArray(gn.knowledge_points) ? gn.knowledge_points[0] : gn.knowledge_points;
      return {
        id: kp?.id || gn.knowledge_point_id,
        title: kp?.title || '',
        content: kp?.content || '',
        graph_id: gn.graph_id,
        knowledge_graphs: gn.knowledge_graphs
      };
    });

    return {
      graphs: (keywordGraphs || []) as SearchGraphResult[],
      nodes: nodes || []
    };
  }

  async semanticSearch(
    supabase: SupabaseClient,
    query: string,
    userId: string
  ): Promise<SemanticSearchResult> {
    const embedding = await aiService.generateEmbedding(query);
    let answer = '';

    if (!embedding) {
      return {
        graphs: [],
        nodes: [],
        answer: ''
      };
    }

    const { data: semanticNodes, error: semanticError } = await supabase.rpc('match_nodes', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 20,
      p_user_id: userId
    });

    if (semanticError) {
      logger.error('Semantic search error:', semanticError);
      throw semanticError;
    }

    let nodes: SearchNodeResult[] = [];

    if (semanticNodes && semanticNodes.length > 0) {
      const graphIds = Array.from(new Set(semanticNodes.map((n: any) => n.graph_id)));
      const { data: graphInfos } = await supabase
        .from('knowledge_graphs')
        .select('id, title')
        .in('id', graphIds);

      const graphMap = new Map(graphInfos?.map((g: any) => [g.id, g.title]));

      nodes = semanticNodes.map((n: any) => ({
        ...n,
        knowledge_graphs: { title: graphMap.get(n.graph_id) }
      }));

      const contextNodes = nodes.slice(0, 5);
      const contextText = contextNodes.map((n, i) =>
        `[${i + 1}] Title: ${n.title}\nGraph: ${n.knowledge_graphs?.title}\nContent: ${n.content || '(No content)'}\nExplanation: ${n.explanation || '(No explanation)'}`
      ).join('\n\n---\n\n');

      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        {
          role: 'system',
          content: `You are an intelligent Knowledge Graph assistant. 
Your goal is to answer the user's question accurately using ONLY the provided context information.
If the provided context does not contain the answer, explicitly state that you cannot find the answer in the knowledge base.
Do not hallucinate or use outside knowledge unless it is general common sense to interpret the context.
Format your answer in Markdown.
Respond in the same language as the user's question (detect from question).`
        },
        { role: 'user', content: `Context:\n${contextText}\n\nQuestion: ${query}` }
      ];

      try {
        answer = await aiService.chat(messages);
      } catch (aiError) {
        logger.error('RAG Generation failed:', aiError);
      }
    }

    return {
      graphs: [],
      nodes: nodes || [],
      answer
    };
  }
}

export const searchService = new SearchService();
