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
  similarity?: number;
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
  private escapePattern(pattern: string): string {
    return pattern.replace(/[%_\\]/g, '\\$&');
  }

  async search(
    supabase: SupabaseClient,
    query: string
  ): Promise<SearchResult> {
    const pattern = `%${this.escapePattern(query)}%`;

    const { data: keywordGraphs, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description, updated_at')
      .ilike('title', pattern)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (graphError) {
      logger.error('Search graphs error:', graphError);
    }

    const { data: knowledgePoints, error: kpError } = await supabase
      .from('knowledge_points')
      .select('id, title, content, owner_id')
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .limit(20);

    if (kpError) {
      logger.error('Search knowledge points error:', kpError);
    }

    const kpIds = (knowledgePoints || []).map(kp => kp.id);
    
    let nodes: SearchNodeResult[] = [];
    
    if (kpIds.length > 0) {
      const { data: graphNodes, error: gnError } = await supabase
        .from('graph_nodes')
        .select(`
          knowledge_point_id,
          graph_id,
          knowledge_graphs (
            title
          )
        `)
        .in('knowledge_point_id', kpIds)
        .is('deleted_at', null);

      if (gnError) {
        logger.error('Search graph nodes error:', gnError);
      }

      const kpMap = new Map((knowledgePoints || []).map(kp => [kp.id, kp]));

      nodes = (graphNodes || []).map((gn: any) => {
        const kp = kpMap.get(gn.knowledge_point_id);
        return {
          id: kp?.id || gn.knowledge_point_id,
          title: kp?.title || '',
          content: kp?.content || '',
          graph_id: gn.graph_id,
          knowledge_graphs: gn.knowledge_graphs
        };
      });
    }

    return {
      graphs: (keywordGraphs || []) as SearchGraphResult[],
      nodes
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

    const [semanticNodes, semanticGraphs] = await Promise.all([
      supabase.rpc('match_nodes', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 20,
        p_user_id: userId
      }),
      supabase.rpc('search_similar_graphs', {
        p_query_embedding: embedding,
        p_user_id: userId,
        p_match_threshold: 0.5,
        p_match_count: 5
      })
    ]);

    if (semanticNodes.error) {
      logger.error('Semantic search nodes error:', semanticNodes.error);
    }

    if (semanticGraphs.error) {
      logger.error('Semantic search graphs error:', semanticGraphs.error);
    }

    let nodes: SearchNodeResult[] = [];
    let graphs: SearchGraphResult[] = [];

    if (semanticNodes.data && semanticNodes.data.length > 0) {
      const graphIds = Array.from(new Set(semanticNodes.data.map((n: any) => n.graph_id)));
      const { data: graphInfos } = await supabase
        .from('knowledge_graphs')
        .select('id, title')
        .in('id', graphIds);

      const graphMap = new Map(graphInfos?.map((g: any) => [g.id, g.title]));

      nodes = semanticNodes.data.map((n: any) => ({
        ...n,
        knowledge_graphs: { title: graphMap.get(n.graph_id) }
      }));
    }

    if (semanticGraphs.data && semanticGraphs.data.length > 0) {
      graphs = semanticGraphs.data.map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        updated_at: '',
        similarity: g.similarity
      }));
    }

    if (nodes.length > 0) {
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
      graphs,
      nodes,
      answer
    };
  }
}

export const searchService = new SearchService();
