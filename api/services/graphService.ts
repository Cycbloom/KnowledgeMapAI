import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';

interface GraphWithCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  nodes_count: number;
}

export class GraphService {
  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      const { data, error } = await supabase
        .rpc('get_user_graphs_with_counts', { p_user_id: userId });

      if (error) {
        console.error('RPC error, falling back to manual query:', error);
        return this.listGraphsFallback(supabase, userId);
      }

      return (data as GraphWithCount[]) || [];
    });
  }

  private async listGraphsFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];
    
    if (graphIds.length === 0) {
      return [];
    }
    
    const { data: nodeCounts } = await supabase
      .from('nodes')
      .select('graph_id')
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });
    
    const { data: nodesData } = await supabase
      .from('nodes')
      .select('graph_id, properties')
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const tagsMap = new Map<string, Set<string>>();
    nodesData?.forEach((n: { graph_id: string; properties: any }) => {
      const tags = n.properties?.tags || [];
      if (!tagsMap.has(n.graph_id)) {
        tagsMap.set(n.graph_id, new Set());
      }
      tags.forEach((tag: string) => tagsMap.get(n.graph_id)!.add(tag));
    });
    
    return graphs?.map((g: Record<string, unknown>) => ({
      ...g,
      nodes_count: countMap.get(g.id as string) || 0,
      tags: Array.from(tagsMap.get(g.id as string) || [])
    })) || [];
  }

  async listTrash(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_trashed_graphs', { p_user_id: userId });

    if (error) {
      console.error('RPC error, falling back to manual query:', error);
      return this.listTrashFallback(supabase, userId);
    }

    return (data as GraphWithCount[]) || [];
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
      .from('nodes')
      .select('graph_id')
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });
    
    return graphs?.map((g: Record<string, unknown>) => ({
      ...g,
      nodes_count: countMap.get(g.id as string) || 0
    })) || [];
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

    const { data, error } = await query.single();

    if (error) throw error;
    return data;
  }

  async createGraph(supabase: SupabaseClient, userId: string, title: string, description?: string) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .insert({
        user_id: userId,
        title,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    
    return data;
  }

  async updateGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    updates: { title?: string; description?: string; is_public?: boolean }
  ) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', graphId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH(graphId));
    
    return data;
  }

  async deleteGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', graphId)
      .eq('user_id', userId);

    if (error) throw error;
    
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

  async getGraphNodes(supabase: SupabaseClient, userId: string | null, graphId: string) {
    const { data: nodes, error: nodesError } = await supabase
      .from('nodes')
      .select('*')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (nodesError) throw nodesError;

    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('*')
      .eq('graph_id', graphId);

    if (edgesError) throw edgesError;

    return { nodes: nodes || [], edges: edges || [] };
  }

  async getGraphNodeStatus(supabase: SupabaseClient, userId: string, graphId: string) {
    const { data, error } = await supabase
      .from('node_status')
      .select('*')
      .eq('user_id', userId)
      .eq('graph_id', graphId);

    if (error) throw error;
    return data || [];
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
      connectedPairs.add(`${edge.source_node_id}-${edge.target_node_id}`);
      connectedPairs.add(`${edge.target_node_id}-${edge.source_node_id}`);
    });

    const suggestions: Array<{ source: string; target: string; score: number }> = [];
    
    for (let i = 0; i < nodes.length && suggestions.length < maxSuggestions; i++) {
      for (let j = i + 1; j < nodes.length && suggestions.length < maxSuggestions; j++) {
        const sourceId = nodes[i].id as string;
        const targetId = nodes[j].id as string;
        const key = `${sourceId}-${targetId}`;

        if (!connectedPairs.has(key)) {
          const sourceLevel = (nodes[i].level as number) || 0;
          const targetLevel = (nodes[j].level as number) || 0;
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
}

export const graphService = new GraphService();
