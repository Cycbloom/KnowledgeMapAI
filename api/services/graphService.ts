import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';

export class GraphService {
  // Stateless service, no constructor

  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      const { data, error } = await supabase
        .from('knowledge_graphs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    });
  }

  async createGraph(supabase: SupabaseClient, userId: string, title: string, description: string = '') {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .insert([
        { 
          user_id: userId, 
          title, 
          description, 
          settings: {} 
        }
      ])
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    return data;
  }

  async getGraph(supabase: SupabaseClient, userId: string, id: string) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error; // Controller catches this (404/500)
    return data;
  }

  async updateGraph(supabase: SupabaseClient, userId: string, id: string, updates: any) {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    return data;
  }

  async deleteGraph(supabase: SupabaseClient, userId: string, id: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    // Updated to use the new key structure which requires userId
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
    await cacheService.delByPrefix(CacheKeys.STUDY_CARDS(id));
  }

  async getGraphNodes(supabase: SupabaseClient, userId: string, graphId: string) {
    const cacheKey = CacheKeys.GRAPH_NODES(userId, graphId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      // Verify ownership first
      const { data: graph, error: graphError } = await supabase
        .from('knowledge_graphs')
        .select('id')
        .eq('id', graphId)
        .eq('user_id', userId)
        .single();

      if (graphError || !graph) {
        throw new Error('Graph not found or access denied');
      }

      // Fetch nodes
      const { data: nodes, error: nodesError } = await supabase
        .from('nodes')
        .select('*')
        .eq('graph_id', graphId);

      if (nodesError) throw nodesError;

      // Fetch edges
      const { data: edges, error: edgesError } = await supabase
        .from('edges')
        .select('*')
        .eq('graph_id', graphId);

      if (edgesError) throw edgesError;

      return { nodes, edges };
    });
  }

  async getGraphNodeStatus(supabase: SupabaseClient, userId: string, graphId: string) {
    // 1. Get nodes and edges
    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);

    // 1.5 Get graph settings
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('settings')
      .eq('id', graphId)
      .single();
    
    const settings = graph?.settings || {};
    // Default to true if undefined to preserve existing behavior, or false?
    // User said "Need a switch", implies they might want it off. 
    // Let's default to TRUE to not break existing "game" feel, but allow turning off.
    const gamificationEnabled = settings.gamification_enabled !== false; 
    const learningDirection = settings.learning_direction || 'top_down';

    // 2. Get all cards for this graph - Optimized to use graph_id
    const { data: cards, error: cardsError } = await supabase
      .from('study_cards')
      .select('node_id, review_count, fsrs_state')
      .eq('user_id', userId)
      .eq('graph_id', graphId);

    if (cardsError) throw cardsError;

    // 3. Map cards to nodes
    const nodeCardsMap = new Map<string, any[]>();
    cards?.forEach(card => {
      const list = nodeCardsMap.get(card.node_id) || [];
      list.push(card);
      nodeCardsMap.set(card.node_id, list);
    });

    // 4. Calculate Mastery
    const masteryMap = new Map<string, boolean>();
    nodes.forEach((node: any) => {
      const nodeCards = nodeCardsMap.get(node.id);
      if (!nodeCards || nodeCards.length === 0) {
        // No cards -> NOT mastered. 
        // This forces users to generate/create cards for a node before it can unlock children.
        masteryMap.set(node.id, false);
      } else {
        // Mastered if all cards have been reviewed at least once
        const allReviewed = nodeCards.every(c => c.review_count > 0);
        masteryMap.set(node.id, allReviewed);
      }
    });

    // 5. Calculate Locked Status
    const status: Record<string, { locked: boolean; mastered: boolean }> = {};

    if (!gamificationEnabled) {
      // If gamification is disabled, everything is unlocked
      nodes.forEach((node: any) => {
        status[node.id] = {
          locked: false,
          mastered: masteryMap.get(node.id) || false
        };
      });
      return status;
    }

    if (learningDirection === 'bottom_up') {
      // Bottom-Up: Leaf nodes first.
      // A node is locked if its CHILDREN (outgoing edges) are not mastered.
      // Parents depend on Children.
      
      const outgoingEdgesMap = new Map<string, string[]>();
      edges.forEach((edge: any) => {
        const list = outgoingEdgesMap.get(edge.source_node_id) || [];
        list.push(edge.target_node_id);
        outgoingEdgesMap.set(edge.source_node_id, list);
      });

      nodes.forEach((node: any) => {
        const children = outgoingEdgesMap.get(node.id) || [];
        
        let locked = false;
        if (children.length > 0) {
          // Locked if ANY child is NOT mastered
          const allChildrenMastered = children.every(cid => masteryMap.get(cid));
          locked = !allChildrenMastered;
        } else {
          // Leaf nodes (no children) are unlocked
          locked = false;
        }

        status[node.id] = {
          locked,
          mastered: masteryMap.get(node.id) || false
        };
      });

    } else {
      // Top-Down (Default): Root nodes first.
      // A node is locked if its PARENTS (incoming edges) are not mastered.
      
      // Build adjacency list (Parent -> Children is edges source -> target)
      // We need Incoming edges (Parents)
      const incomingEdgesMap = new Map<string, string[]>();
      edges.forEach((edge: any) => {
        const list = incomingEdgesMap.get(edge.target_node_id) || [];
        list.push(edge.source_node_id);
        incomingEdgesMap.set(edge.target_node_id, list);
      });
      
      nodes.forEach((node: any) => {
        const parents = incomingEdgesMap.get(node.id) || [];
        
        let locked = false;
        if (parents.length > 0) {
          // Locked if ANY parent is NOT mastered
          const allParentsMastered = parents.every(pid => masteryMap.get(pid));
          locked = !allParentsMastered;
        } else {
          // Root nodes are never locked
          locked = false;
        }

        status[node.id] = {
          locked,
          mastered: masteryMap.get(node.id) || false
        };
      });
    }

    return status;
  }
}

export const graphService = new GraphService();
