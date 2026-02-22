import { SupabaseClient } from '@supabase/supabase-js';
import { aiService } from '../services/aiService.js';
import { logger } from './logger.js';

export interface SimilaritySearchOptions {
  threshold?: number;
  limit?: number;
}

export interface SimilarKnowledgePoint {
  id: string;
  title: string;
  content?: string;
  similarity: number;
  visibility: string;
  graphs_count?: number;
}

export async function searchSimilarKnowledgePoints(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  options: SimilaritySearchOptions = {}
): Promise<SimilarKnowledgePoint[]> {
  const { threshold = 0.85, limit = 10 } = options;

  try {
    const embedding = await aiService.generateEmbedding(text);
    if (!embedding) {
      logger.warn('Failed to generate embedding for similarity search');
      return [];
    }

    const { data, error } = await supabase.rpc('search_similar_knowledge_points', {
      p_query_embedding: embedding,
      p_user_id: userId,
      p_match_threshold: threshold,
      p_match_count: limit,
    });

    if (error) {
      logger.error('Similarity search error:', error);
      return [];
    }

    return (data || []) as SimilarKnowledgePoint[];
  } catch (error) {
    logger.error('Similarity search failed:', error);
    return [];
  }
}

export async function checkAndReuseKnowledgePoint(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  _content?: string,
  threshold: number = 0.85
): Promise<{ shouldReuse: boolean; existingKpId?: string }> {
  const similar = await searchSimilarKnowledgePoints(supabase, userId, title, { threshold, limit: 1 });

  if (similar.length > 0 && similar[0].similarity >= threshold) {
    return { shouldReuse: true, existingKpId: similar[0].id };
  }

  return { shouldReuse: false };
}

export interface SimilarGraph {
  id: string;
  title: string;
  description?: string;
  similarity: number;
}

export interface GraphTopicCheckResult {
  isDuplicate: boolean;
  similarGraphs: SimilarGraph[];
  embedding?: number[];
}

export interface GraphTopicCheckOptions {
  threshold?: number;
  limit?: number;
  excludeGraphId?: string;
}

export async function searchSimilarGraphs(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
  options: GraphTopicCheckOptions = {}
): Promise<{ similarGraphs: SimilarGraph[]; embedding?: number[] }> {
  const { threshold = 0.85, limit = 10, excludeGraphId } = options;

  try {
    const embedding = await aiService.generateEmbedding(topic);
    if (!embedding) {
      logger.warn('Failed to generate embedding for graph topic similarity search');
      return { similarGraphs: [] };
    }

    const { data, error } = await supabase.rpc('search_similar_graphs', {
      p_query_embedding: embedding,
      p_user_id: userId,
      p_match_threshold: threshold,
      p_match_count: limit,
      p_exclude_graph_id: excludeGraphId || null,
    });

    if (error) {
      logger.error('Graph similarity search error:', error);
      return { similarGraphs: [], embedding };
    }

    return { 
      similarGraphs: (data || []) as SimilarGraph[], 
      embedding 
    };
  } catch (error) {
    logger.error('Graph similarity search failed:', error);
    return { similarGraphs: [] };
  }
}

export async function checkDuplicateGraphTopic(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
  options: GraphTopicCheckOptions = {}
): Promise<GraphTopicCheckResult> {
  const { threshold = 0.85 } = options;

  const { similarGraphs, embedding } = await searchSimilarGraphs(supabase, userId, topic, options);

  const isDuplicate = similarGraphs.length > 0 && similarGraphs[0].similarity >= threshold;

  return {
    isDuplicate,
    similarGraphs,
    embedding,
  };
}
