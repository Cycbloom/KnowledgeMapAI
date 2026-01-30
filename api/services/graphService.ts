import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';

export class GraphService {
  constructor(private supabase: SupabaseClient, private userId: string) {}

  async listGraphs() {
    const cacheKey = CacheKeys.USER_GRAPHS(this.userId);
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const { data, error } = await this.supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    await cacheService.set(cacheKey, data);
    return data;
  }

  async createGraph(title: string, description: string = '') {
    const { data, error } = await this.supabase
      .from('knowledge_graphs')
      .insert([
        { 
          user_id: this.userId, 
          title, 
          description, 
          settings: {} 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(this.userId));
    return data;
  }

  async getGraph(id: string) {
    const { data, error } = await this.supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.userId)
      .single();

    if (error) throw error; // Controller catches this (404/500)
    return data;
  }

  async updateGraph(id: string, updates: any) {
    const { data, error } = await this.supabase
      .from('knowledge_graphs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(this.userId));
    return data;
  }

  async deleteGraph(id: string) {
    const { error } = await this.supabase
      .from('knowledge_graphs')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(this.userId));
    await cacheService.delByPrefix(CacheKeys.GRAPH_NODES(id));
    await cacheService.delByPrefix(CacheKeys.STUDY_CARDS(id));
  }

  async getGraphNodes(graphId: string) {
    const cacheKey = CacheKeys.GRAPH_NODES(graphId);
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    // Verify ownership first
    const { data: graph, error: graphError } = await this.supabase
      .from('knowledge_graphs')
      .select('id')
      .eq('id', graphId)
      .eq('user_id', this.userId)
      .single();

    if (graphError || !graph) throw new Error('未找到图谱');

    // Fetch nodes
    const { data: nodes, error: nodesError } = await this.supabase
      .from('nodes')
      .select('*')
      .eq('graph_id', graphId);

    if (nodesError) throw nodesError;

    // Fetch edges efficiently using inner join on source_node
    const { data: edgesData, error: edgesError } = await this.supabase
      .from('edges')
      .select('*, source_node:source_node_id!inner(graph_id)')
      .eq('source_node.graph_id', graphId);

    if (edgesError) throw edgesError;
    const edges = edgesData || [];

    const result = { nodes, edges };
    await cacheService.set(cacheKey, result);
    
    return result;
  }
}
