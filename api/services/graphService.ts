import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';
import { buildNodeFromGraphNode, GRAPH_NODES_SELECT } from '../utils/nodeHelpers.js';
import { softDelete } from '../utils/softDelete.js';
import { logger } from '../utils/logger.js';
import { LEVEL_WEIGHTS, getLevelIndex } from '../utils/levelUtils.js';
import { withRpcFallback } from '../utils/rpcFallback.js';
import { checkDuplicateGraphTopic, GraphTopicCheckResult } from '../utils/similaritySearch.js';
import { aiService } from './ai/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';

interface GraphWithCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  nodes_count: number;
}

export class GraphService {
  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      return withRpcFallback<GraphWithCount[]>(supabase, {
        rpcName: 'get_user_graphs_with_counts',
        rpcParams: { p_user_id: userId },
        fallbackFn: () => this.listGraphsFallback(supabase, userId)
      });
    });
  }

  private async listGraphsFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('is_favorite', { ascending: false })
      .order('last_used_at', { ascending: false });

    if (error) throw error;
    
    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];
    
    if (graphIds.length === 0) {
      return [];
    }
    
    const { data: nodeCounts } = await supabase
      .from('graph_nodes')
      .select('graph_id')
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });
    
    const { data: graphNodesData } = await supabase
      .from('graph_nodes')
      .select(`
        graph_id,
        knowledge_points (
          properties
        )
      `)
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const tagsMap = new Map<string, Set<string>>();
    graphNodesData?.forEach((gn: { graph_id: string; knowledge_points: any }) => {
      const tags = gn.knowledge_points?.properties?.tags || [];
      if (!tagsMap.has(gn.graph_id)) {
        tagsMap.set(gn.graph_id, new Set());
      }
      tags.forEach((tag: string) => tagsMap.get(gn.graph_id)!.add(tag));
    });
    
    return (graphs?.map((g: Record<string, unknown>) => ({
      id: g.id as string,
      user_id: g.user_id as string,
      title: g.title as string,
      description: g.description as string | null,
      is_public: g.is_public as boolean,
      is_favorite: g.is_favorite as boolean,
      created_at: g.created_at as string,
      updated_at: g.updated_at as string,
      deleted_at: g.deleted_at as string | null,
      nodes_count: countMap.get(g.id as string) || 0,
      tags: Array.from(tagsMap.get(g.id as string) || [])
    })) || []) as GraphWithCount[];
  }

  async listTrash(supabase: SupabaseClient, userId: string) {
    return withRpcFallback<GraphWithCount[]>(supabase, {
      rpcName: 'get_user_trashed_graphs',
      rpcParams: { p_user_id: userId },
      fallbackFn: () => this.listTrashFallback(supabase, userId)
    });
  }

  private async listTrashFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    
    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];
    
    if (graphIds.length === 0) {
      return [];
    }
    
    const { data: nodeCounts } = await supabase
      .from('graph_nodes')
      .select('graph_id')
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });
    
    return (graphs?.map((g: Record<string, unknown>) => ({
      id: g.id as string,
      user_id: g.user_id as string,
      title: g.title as string,
      description: g.description as string | null,
      is_public: g.is_public as boolean,
      is_favorite: g.is_favorite as boolean,
      created_at: g.created_at as string,
      updated_at: g.updated_at as string,
      deleted_at: g.deleted_at as string | null,
      nodes_count: countMap.get(g.id as string) || 0
    })) || []) as GraphWithCount[];
  }

  async getGraph(supabase: SupabaseClient, graphId: string, userId: string | null) {
    let query = supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('id', graphId)
      .is('deleted_at', null);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error('getGraph error:', error);
      throw error;
    }
    
    if (!data) {
      const { data: publicGraph, error: publicError } = await supabase
        .from('knowledge_graphs')
        .select('*')
        .eq('id', graphId)
        .eq('is_public', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (publicError) {
        logger.error('getGraph public fallback error:', publicError);
        throw publicError;
      }
      
      return publicGraph;
    }
    
    return data;
  }

  async updateLastUsedAt(supabase: SupabaseClient, graphId: string, userId: string) {
    await supabase
      .from('knowledge_graphs')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', graphId)
      .eq('user_id', userId);
  }

  async createGraph(supabase: SupabaseClient, userId: string, title: string, description?: string, options?: { skipDuplicateCheck?: boolean }) {
    if (!options?.skipDuplicateCheck) {
      const duplicateCheck = await checkDuplicateGraphTopic(supabase, userId, title, { threshold: 0.85 });
      if (duplicateCheck.isDuplicate) {
        const similarGraph = duplicateCheck.similarGraphs[0];
        throw new AppError(
          `主题重复：与现有图谱「${similarGraph.title}」相似度为 ${(similarGraph.similarity * 100).toFixed(1)}%`,
          400,
          ErrorCodes.DUPLICATE_TOPIC
        );
      }
    }

    let embedding: number[] | undefined;
    try {
      embedding = await aiService.generateEmbedding(title);
    } catch (e) {
      logger.warn('Failed to generate embedding for graph topic:', e);
    }

    const { data, error } = await supabase
      .from('knowledge_graphs')
      .insert({
        user_id: userId,
        title,
        description: description || null,
        embedding,
      })
      .select()
      .single();

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    
    return data;
  }

  async checkTopicDuplicate(supabase: SupabaseClient, userId: string, topic: string, excludeGraphId?: string): Promise<GraphTopicCheckResult> {
    return checkDuplicateGraphTopic(supabase, userId, topic, { excludeGraphId });
  }

  async updateGraphEmbedding(supabase: SupabaseClient, graphId: string, title: string) {
    try {
      const embedding = await aiService.generateEmbedding(title);
      if (embedding) {
        await supabase
          .from('knowledge_graphs')
          .update({ embedding })
          .eq('id', graphId);
      }
    } catch (e) {
      logger.warn('Failed to update graph embedding:', e);
    }
  }

  async updateGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    updates: { title?: string; description?: string; is_public?: boolean }
  ) {
    if (updates.title) {
      const duplicateCheck = await checkDuplicateGraphTopic(supabase, userId, updates.title, { 
        excludeGraphId: graphId 
      });
      if (duplicateCheck.isDuplicate) {
        const similarGraph = duplicateCheck.similarGraphs[0];
        throw new AppError(
          `主题重复：与现有图谱「${similarGraph.title}」相似度为 ${(similarGraph.similarity * 100).toFixed(1)}%`,
          400,
          ErrorCodes.DUPLICATE_TOPIC
        );
      }
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.title) {
      try {
        const embedding = await aiService.generateEmbedding(updates.title);
        if (embedding) {
          updateData.embedding = embedding;
        }
      } catch (e) {
        logger.warn('Failed to generate embedding for updated graph topic:', e);
      }
    }

    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update(updateData)
      .eq('id', graphId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH(graphId));
    
    return data;
  }

  async toggleFavorite(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    isFavorite: boolean
  ) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update({
        is_favorite: isFavorite,
        updated_at: new Date().toISOString(),
      })
      .eq('id', graphId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    
    return data;
  }

  async deleteGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    const result = await softDelete(supabase, 'knowledge_graphs', graphId);
    if (!result.success) {
      throw new Error(result.error || '删除图谱失败');
    }
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH(graphId));
  }

  async restoreGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .update({ deleted_at: null })
      .eq('id', graphId)
      .eq('user_id', userId);

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
  }

  async permanentDeleteGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .delete()
      .eq('id', graphId)
      .eq('user_id', userId);

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
  }

  async restoreGraphs(supabase: SupabaseClient, graphIds: string[], userId: string) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update({ deleted_at: null })
      .in('id', graphIds)
      .eq('user_id', userId)
      .select('id');

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    
    return { count: data?.length || 0 };
  }

  async permanentDeleteGraphs(supabase: SupabaseClient, graphIds: string[], userId: string) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .delete()
      .in('id', graphIds)
      .eq('user_id', userId)
      .select('id');

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    
    return { count: data?.length || 0 };
  }

  async getGraphNodes(supabase: SupabaseClient, userId: string | null, graphId: string) {
    const { data: graphNodes, error: gnError } = await supabase
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (gnError) {
      logger.error('getGraphNodes error:', gnError);
      throw gnError;
    }

    const nodes = (graphNodes || []).map(gn => {
      const node = buildNodeFromGraphNode(gn);
      if (!node) return null;
      return {
        id: node.id,
        graph_id: node.graph_id,
        graph_node_id: node.id,
        title: node.title,
        content: node.content,
        x_position: node.x_position,
        y_position: node.y_position,
        level: node.level,
        properties: node.properties,
        learning_material: node.learning_material,
        is_accepted: node.is_accepted,
        knowledge_point_id: node.knowledge_point_id,
        visibility: node.visibility,
        owner_id: node.owner_id,
        created_at: node.created_at,
        updated_at: node.updated_at,
      };
    }).filter(Boolean);

    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('*')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (edgesError) throw edgesError;

    return { nodes, edges: edges || [] };
  }

  async getGraphNodeStatus(supabase: SupabaseClient, userId: string, graphId: string) {
    const { data: cards, error } = await supabase
      .from('study_cards')
      .select('knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, review_count')
      .eq('user_id', userId)
      .eq('graph_id', graphId);

    if (error) {
      logger.error('getGraphNodeStatus error:', error);
      return {};
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const statusMap: Record<string, any> = {};
    
    (cards || []).forEach((card: any) => {
      const nextReview = card.next_review ? new Date(card.next_review) : null;
      const isDue = nextReview && nextReview <= now;
      const isDueToday = nextReview && nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const isMastered = card.fsrs_stability && card.fsrs_stability > 21;
      
      statusMap[card.knowledge_point_id] = {
        mastered: isMastered,
        locked: false,
        review_count: card.review_count || 0,
        next_review: card.next_review,
        due: isDue,
        due_today: isDueToday,
      };
    });

    return statusMap;
  }

  async getLearningPath(supabase: SupabaseClient, userId: string | null, graphId: string) {
    const { data, error } = await supabase
      .from('learning_paths')
      .select('*')
      .eq('graph_id', graphId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async analyzeGraph(supabase: SupabaseClient, userId: string, graphId: string) {
    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);

    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const avgConnections = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

    const levels = nodes.reduce((acc: Record<number, number>, node: Record<string, unknown>) => {
      const level = (node.level as number) || 0;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    return {
      nodeCount,
      edgeCount,
      avgConnections: Math.round(avgConnections * 100) / 100,
      levels,
      density: nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1) / 2) : 0,
    };
  }

  async findMissingConnections(supabase: SupabaseClient, userId: string, graphId: string, maxSuggestions: number) {
    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);

    const connectedPairs = new Set<string>();
    edges.forEach((edge: Record<string, unknown>) => {
      connectedPairs.add(`${edge.source_knowledge_point_id}-${edge.target_knowledge_point_id}`);
      connectedPairs.add(`${edge.target_knowledge_point_id}-${edge.source_knowledge_point_id}`);
    });

    const suggestions: Array<{ source: string; target: string; score: number }> = [];
    
    for (let i = 0; i < nodes.length && suggestions.length < maxSuggestions; i++) {
      for (let j = i + 1; j < nodes.length && suggestions.length < maxSuggestions; j++) {
        const sourceId = nodes[i].id as string;
        const targetId = nodes[j].id as string;
        const key = `${sourceId}-${targetId}`;

        if (!connectedPairs.has(key)) {
          const sourceLevel = getLevelIndex(nodes[i].level as string) || 0;
          const targetLevel = getLevelIndex(nodes[j].level as string) || 0;
          const score = Math.abs(sourceLevel - targetLevel);

          suggestions.push({
            source: sourceId,
            target: targetId,
            score,
          });
        }
      }
    }

    return suggestions.sort((a, b) => a.score - b.score).slice(0, maxSuggestions);
  }

  async getCombinedView(supabase: SupabaseClient, userId: string, graphIds: string[]) {
    const { data: graphs, error: graphsError } = await supabase
      .from('knowledge_graphs')
      .select('id, title')
      .in('id', graphIds)
      .eq('user_id', userId);

    if (graphsError) {
      throw graphsError;
    }

    if (!graphs || graphs.length !== graphIds.length) {
      throw new Error('Some graphs not found or unauthorized');
    }

    const { data: graphNodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select(`
        id,
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties,
          visibility,
          owner_id
        )
      `)
      .in('graph_id', graphIds)
      .is('deleted_at', null);

    if (nodesError) {
      throw nodesError;
    }

    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('id, graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight')
      .in('graph_id', graphIds)
      .is('deleted_at', null);

    if (edgesError) {
      throw edgesError;
    }

    const graphMap = new Map(graphs.map(g => [g.id, g]));
    const result = {
      graphs: graphIds.map((gid: string) => ({
        graph_id: gid,
        graph_title: graphMap.get(gid)?.title || '',
        color: '',
        nodes: (graphNodes || []).filter((gn: any) => gn.graph_id === gid),
        edges: (edges || []).filter((e: any) => e.graph_id === gid)
      })),
      shared_knowledge_points: [] as any[]
    };

    const kpGraphMap = new Map<string, any[]>();
    (graphNodes || []).forEach((gn: any) => {
      const kpId = gn.knowledge_point_id;
      if (!kpGraphMap.has(kpId)) {
        kpGraphMap.set(kpId, []);
      }
      kpGraphMap.get(kpId)!.push(gn);
    });

    kpGraphMap.forEach((nodes, kpId) => {
      if (nodes.length > 1) {
        result.shared_knowledge_points.push({
          knowledge_point_id: kpId,
          knowledge_point: nodes[0].knowledge_points,
          graph_nodes: nodes
        });
      }
    });

    return result;
  }
}

export const graphService = new GraphService();
