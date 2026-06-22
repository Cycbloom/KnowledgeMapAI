import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { searchSimilarKnowledgePoints } from '../../utils/similaritySearch';
import { PaginationOptions, getPaginationParams } from '../../utils/pagination';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { cacheService, CacheKeys, CacheTTL, computeTextHash } from '../common/cacheService';
import type { KnowledgePoint, KnowledgePointVisibility } from '../../../shared/types/index';

export type { KnowledgePoint, KnowledgePointVisibility };

export interface ListKnowledgePointsOptions {
  visibility?: 'public' | 'private' | 'pending';
  userId?: string;
}

export interface ListPublicKnowledgePointsOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface SubmitPublicOptions {
  knowledge_point_id: string;
  suggested_changes?: {
    title?: string;
    content?: string;
    learning_material?: string;
  };
}

export interface AutoReviewResult {
  passed: boolean;
  issues: string[];
}

export interface PendingKnowledgePointItem {
  id: string;
  knowledge_point_id: string;
  knowledge_point: KnowledgePoint;
  suggested_changes: Record<string, unknown> | null;
  submitted_by: string;
  submitted_at: string;
  auto_review_result: AutoReviewResult;
}

export interface CreateKnowledgePointData {
  title: string;
  content?: string;
  summary?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  visibility?: KnowledgePointVisibility;
  owner_id: string;
  embedding?: number[] | null;
}

export interface UpdateKnowledgePointData {
  title?: string;
  content?: string;
  summary?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  visibility?: KnowledgePointVisibility;
}

export interface SimilarKnowledgePointResult {
  id: string;
  title: string;
  content?: string;
  similarity: number;
  visibility: KnowledgePointVisibility;
  graphs_count?: number;
}

export interface KnowledgePointGraph {
  graph_id: string;
  graph_title: string;
  graph_node_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
}

export class KnowledgePointService {
  async create(
    supabase: SupabaseClient,
    data: CreateKnowledgePointData
  ): Promise<KnowledgePoint> {
    const kpData: Record<string, unknown> = {
      title: data.title,
      content: data.content || '',
      summary: data.summary || null,
      learning_material: data.learning_material || '',
      properties: data.properties || {},
      visibility: data.visibility || 'private',
      owner_id: data.owner_id,
    };

    if (data.embedding !== undefined) {
      kpData.embedding = data.embedding;
    }

    const { data: newKp, error } = await supabase
      .from('knowledge_points')
      .insert([kpData])
      .select()
      .single();

    if (error) {
      logger.error('Create knowledge point error:', error);
      throw error;
    }

    return newKp as KnowledgePoint;
  }

  async get(supabase: SupabaseClient, id: string): Promise<KnowledgePoint | null> {
    const cacheKey = CacheKeys.KNOWLEDGE_POINT(id);

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const { data, error } = await supabase
          .from('knowledge_points')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          logger.error('Get knowledge point error:', error);
          throw error;
        }

        return data as KnowledgePoint | null;
      },
      300,
      ['knowledge_point', `kp_${id}`]
    );
  }

  async update(
    supabase: SupabaseClient,
    id: string,
    data: UpdateKnowledgePointData
  ): Promise<KnowledgePoint> {
    // 更新前获取原标题，用于失效旧 embedding 缓存
    let oldTitle: string | undefined;
    if (data.title !== undefined) {
      const existingKp = await this.get(supabase, id);
      oldTitle = existingKp?.title;
    }

    const updates: Record<string, unknown> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedKp, error } = await supabase
      .from('knowledge_points')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update knowledge point error:', error);
      throw error;
    }

    await cacheService.del(CacheKeys.KNOWLEDGE_POINT(id));

    // 失效 embedding 缓存（标题变更时需同时清理新旧标题的缓存）
    if (data.title !== undefined) {
      // 删除新标题的缓存
      if (data.title) {
        const newTitleHash = computeTextHash(data.title);
        await cacheService.del(CacheKeys.EMBEDDING(newTitleHash));
      }
      // 删除原标题的缓存（标题变更后旧缓存不再有效）
      if (oldTitle && oldTitle !== data.title) {
        const oldTitleHash = computeTextHash(oldTitle);
        await cacheService.del(CacheKeys.EMBEDDING(oldTitleHash));
      }
    }

    return updatedKp as KnowledgePoint;
  }

  async delete(supabase: SupabaseClient, id: string, userId: string): Promise<{
    success: boolean;
    affected_graphs: number;
    deleted_graph_nodes: number;
    deleted_edges: number;
    deleted_cards: number;
  }> {
    const { data, error } = await supabase.rpc('hard_delete_knowledge_point', {
      p_knowledge_point_id: id,
      p_user_id: userId,
    });

    if (error) {
      logger.error('Hard delete knowledge point error:', error);
      throw error;
    }

    return {
      success: data?.success ?? false,
      affected_graphs: data?.affected_graphs ?? 0,
      deleted_graph_nodes: data?.deleted_graph_nodes ?? 0,
      deleted_edges: data?.deleted_edges ?? 0,
      deleted_cards: data?.deleted_cards ?? 0,
    };
  }

  async searchSimilar(
    supabase: SupabaseClient,
    embedding: number[],
    userId: string,
    threshold: number = 0.85,
    limit: number = 10
  ): Promise<SimilarKnowledgePointResult[]> {
    const embeddingHash = computeTextHash(embedding.map(v => v.toFixed(6)).join(','));
    const cacheKey = CacheKeys.SEARCH_SIMILAR(embeddingHash, userId);

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const { data, error } = await supabase.rpc('search_similar_knowledge_points', {
          p_query_embedding: embedding,
          p_user_id: userId,
          p_match_threshold: threshold,
          p_match_count: limit,
        });

        if (error) {
          logger.error('Search similar knowledge points error:', error);
          throw error;
        }

        return (data || []) as SimilarKnowledgePointResult[];
      },
      CacheTTL.SEARCH,
      ['search']
    );
  }

  async listAccessible(
    supabase: SupabaseClient,
    userId: string
  ): Promise<KnowledgePoint[]> {
    const { data, error } = await supabase
      .from('knowledge_points')
      .select('*')
      .or(`owner_id.eq.${userId},visibility.eq.public`)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('List accessible knowledge points error:', error);
      throw error;
    }

    return (data || []) as KnowledgePoint[];
  }

  async getGraphs(
    supabase: SupabaseClient,
    knowledgePointId: string,
    userId: string
  ): Promise<KnowledgePointGraph[]> {
    const { data, error } = await supabase.rpc('get_knowledge_point_graphs', {
      p_knowledge_point_id: knowledgePointId,
      p_user_id: userId,
    });

    if (error) {
      logger.error('Get knowledge point graphs error:', error);
      throw error;
    }

    return (data || []) as KnowledgePointGraph[];
  }

  async list(
    supabase: SupabaseClient,
    userId: string,
    options?: ListKnowledgePointsOptions
  ): Promise<KnowledgePoint[]> {
    let query = supabase
      .from('knowledge_points')
      .select('*');

    if (options?.visibility === 'public') {
      query = query.eq('visibility', 'public');
    } else {
      query = query.or(`visibility.eq.public,owner_id.eq.${userId}`);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      logger.error('List knowledge points error:', error);
      throw error;
    }

    return (data || []) as KnowledgePoint[];
  }

  async getAccessible(
    supabase: SupabaseClient,
    id: string,
    userId: string
  ): Promise<KnowledgePoint | null> {
    const { data, error } = await supabase
      .from('knowledge_points')
      .select('*')
      .eq('id', id)
      .or(`visibility.eq.public,owner_id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      logger.error('Get accessible knowledge point error:', error);
      throw error;
    }

    return data as KnowledgePoint | null;
  }

  async checkOwnership(
    supabase: SupabaseClient,
    id: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('knowledge_points')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (error || !data) {
      return false;
    }

    return data.owner_id === userId;
  }

  async listPublic(
    supabase: SupabaseClient,
    options?: ListPublicKnowledgePointsOptions
  ): Promise<PaginatedResult<KnowledgePoint>> {
    const { search, limit = 20, offset = 0 } = options || {};

    let query = supabase
      .from('knowledge_points')
      .select('id, title, content, summary, learning_material, properties, visibility, owner_id, created_at, updated_at', { count: 'exact' })
      .eq('visibility', 'public');

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('List public knowledge points error:', error);
      throw error;
    }

    return {
      items: (data || []) as KnowledgePoint[],
      total: count || 0,
    };
  }

  async submitForPublic(
    supabase: SupabaseClient,
    options: SubmitPublicOptions,
    userId: string
  ): Promise<{ success: boolean; message: string; auto_review_result: AutoReviewResult }> {
    const { knowledge_point_id, suggested_changes } = options;

    const kp = await this.get(supabase, knowledge_point_id);

    if (!kp) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (kp.owner_id !== userId) {
      throw new AppError(ErrorCodes.AUTH_FORBIDDEN);
    }

    const autoReviewResult: AutoReviewResult = {
      passed: true,
      issues: [],
    };

    const titleToCheck = suggested_changes?.title || kp.title;
    const contentToCheck = suggested_changes?.content || kp.content;

    if (!titleToCheck || titleToCheck.trim().length < 2) {
      autoReviewResult.passed = false;
      autoReviewResult.issues.push('标题太短，至少需要2个字符');
    }

    if (titleToCheck && titleToCheck.length > 200) {
      autoReviewResult.passed = false;
      autoReviewResult.issues.push('标题过长，最多200个字符');
    }

    if (!contentToCheck || contentToCheck.trim().length < 10) {
      autoReviewResult.passed = false;
      autoReviewResult.issues.push('内容太短，至少需要10个字符');
    }

    try {
      const tags = (kp.properties?.tags as string[])?.join(', ') || '';
      const textToSearch = [titleToCheck, contentToCheck, tags].filter(Boolean).join('\n');

      if (textToSearch) {
        const similarKps = await searchSimilarKnowledgePoints(supabase, userId, textToSearch, {
          threshold: 0.9,
          limit: 5,
        });

        const publicDuplicates = similarKps.filter(
          (skp) => skp.id !== knowledge_point_id && skp.visibility === 'public'
        );

        if (publicDuplicates.length > 0) {
          autoReviewResult.passed = false;
          autoReviewResult.issues.push(`发现${publicDuplicates.length}个相似的公共知识点，可能存在重复`);
        }
      }
    } catch (error) {
      logger.warn('Auto-review similarity check failed:', error);
    }

    await this.update(supabase, knowledge_point_id, {
      visibility: 'pending',
      properties: {
        ...kp.properties,
        suggested_changes: suggested_changes || null,
        auto_review_result: autoReviewResult,
        submitted_for_public_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: autoReviewResult.passed
        ? '知识点已提交审核，等待管理员批准'
        : '知识点已提交，但自动审核发现问题',
      auto_review_result: autoReviewResult,
    };
  }

  async listPending(
    supabase: SupabaseClient,
    options?: PaginationOptions
  ): Promise<PaginatedResult<PendingKnowledgePointItem>> {
    const { offset, end } = getPaginationParams(options);

    const { data, error, count } = await supabase
      .from('knowledge_points')
      .select('id, title, content, summary, learning_material, properties, owner_id, created_at, updated_at', { count: 'exact' })
      .eq('visibility', 'pending')
      .order('updated_at', { ascending: true })
      .range(offset, end);

    if (error) {
      logger.error('List pending knowledge points error:', error);
      throw error;
    }

    const items: PendingKnowledgePointItem[] = (data || []).map((kp) => ({
      id: kp.id,
      knowledge_point_id: kp.id,
      knowledge_point: kp as KnowledgePoint,
      suggested_changes: (kp.properties?.suggested_changes as Record<string, unknown>) || null,
      submitted_by: kp.owner_id,
      submitted_at: (kp.properties?.submitted_for_public_at as string) || kp.updated_at,
      auto_review_result: (kp.properties?.auto_review_result as AutoReviewResult) || { passed: true, issues: [] },
    }));

    return {
      items,
      total: count || 0,
    };
  }

  async approvePublic(
    supabase: SupabaseClient,
    knowledgePointId: string,
    adminUserId: string
  ): Promise<KnowledgePoint> {
    const kp = await this.get(supabase, knowledgePointId);

    if (!kp || kp.visibility !== 'pending') {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const suggestedChanges = kp.properties?.suggested_changes as Record<string, unknown> | undefined;
    const updates: UpdateKnowledgePointData = {
      visibility: 'public',
    };

    if (suggestedChanges) {
      if (suggestedChanges.title) updates.title = suggestedChanges.title as string;
      if (suggestedChanges.content) updates.content = suggestedChanges.content as string;
      if (suggestedChanges.learning_material) updates.learning_material = suggestedChanges.learning_material as string;
    }

    updates.properties = {
      ...kp.properties,
      approved_at: new Date().toISOString(),
      approved_by: adminUserId,
      suggested_changes: null,
    };

    return this.update(supabase, knowledgePointId, updates);
  }

  async rejectPublic(
    supabase: SupabaseClient,
    knowledgePointId: string,
    adminUserId: string,
    reason: string
  ): Promise<KnowledgePoint> {
    const kp = await this.get(supabase, knowledgePointId);

    if (!kp || kp.visibility !== 'pending') {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return this.update(supabase, knowledgePointId, {
      visibility: 'private',
      properties: {
        ...kp.properties,
        rejected_at: new Date().toISOString(),
        rejected_by: adminUserId,
        rejection_reason: reason,
        suggested_changes: null,
      },
    });
  }
}

export const knowledgePointService = new KnowledgePointService();
