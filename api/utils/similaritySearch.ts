import { SupabaseClient } from '@supabase/supabase-js';
import { aiService } from '../services/ai/aiService';
import { cacheService, CacheKeys, CacheTTL, computeTextHash } from '../services/common/cacheService';
import { logger } from './logger';

export interface SimilaritySearchOptions {
  threshold?: number;
  limit?: number;
  /** 跳过相似度缓存，实时查库。用于创建知识点前复用检查，避免缓存快照看不到刚创建的知识点 */
  bypassCache?: boolean;
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
  const { threshold = 0.85, limit = 10, bypassCache = false } = options;

  const fetch = async () => {
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

    return Array.isArray(data) ? (data as SimilarKnowledgePoint[]) : [];
  };

  if (bypassCache) {
    try {
      return await fetch();
    } catch (error) {
      logger.error('Similarity search failed:', error);
      return [];
    }
  }

  const cacheKey = CacheKeys.SEARCH_SIMILAR(computeTextHash(text), userId);

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      try {
        return await fetch();
      } catch (error) {
        logger.error('Similarity search failed:', error);
        return [];
      }
    },
    CacheTTL.SEARCH,
    ['search']
  );
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

export interface ReuseKnowledgePointOptions {
  threshold?: number;
  /** 排除已在目标图谱中的知识点，避免重复关联触发唯一约束；常用于节点创建时的跨图谱复用检查 */
  excludeGraphId?: string;
  bypassCache?: boolean;
}

/**
 * 跨图谱知识复用：按标题语义检索本人知识点，命中阈值则返回可复用的 knowledge_point id。
 * 可选排除目标图谱内已存在的知识点，确保在同图谱内不会误用、也不会触发 graph_nodes 唯一约束。
 * 未命中返回 null，调用方应正常新建知识点。
 */
export async function findReusableKnowledgePointId(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  options: ReuseKnowledgePointOptions = {},
): Promise<string | null> {
  const { threshold = 0.85, excludeGraphId, bypassCache = false } = options;

  const similar = await searchSimilarKnowledgePoints(supabase, userId, title, {
    threshold,
    limit: 20,
    bypassCache,
  });

  if (!Array.isArray(similar) || similar.length === 0) return null;

  let candidates = similar;

  if (excludeGraphId) {
    const candidateIds = similar.map((s) => s.id);
    const { data: existingInGraph } = await supabase
      .from("graph_nodes")
      .select("knowledge_point_id")
      .in("knowledge_point_id", candidateIds)
      .eq("graph_id", excludeGraphId)
      .is("deleted_at", null);

    const inGraphIds = new Set(
      (existingInGraph || []).map((g) => g.knowledge_point_id),
    );
    if (inGraphIds.size > 0) {
      candidates = similar.filter((s) => !inGraphIds.has(s.id));
      if (candidates.length === 0) return null;
    }
  }

  const best = candidates[0];
  if (best.similarity >= threshold) {
    return best.id;
  }

  return null;
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
  /** 跳过相似度缓存，实时查库。用于创建图谱前的去重检查，避免缓存快照看不到刚创建的图谱 */
  bypassCache?: boolean;
}

export async function searchSimilarGraphs(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
  options: GraphTopicCheckOptions = {}
): Promise<{ similarGraphs: SimilarGraph[]; embedding?: number[] }> {
  const { threshold = 0.85, limit = 10, excludeGraphId, bypassCache = false } = options;

  const fetch = async () => {
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
      similarGraphs: Array.isArray(data) ? (data as SimilarGraph[]) : [],
      embedding
    };
  };

  if (bypassCache) {
    return fetch();
  }

  const cacheKey = CacheKeys.SEARCH_SIMILAR(computeTextHash(topic), userId);
  return cacheService.getOrSet(
    cacheKey,
    fetch,
    CacheTTL.SEARCH,
    ['search']
  );
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
