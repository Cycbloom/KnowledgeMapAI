import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';

export class GraphService {
  // Stateless service, no constructor

  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      const { data, error } = await supabase
        .from('knowledge_graphs')
        .select('*, nodes(count)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to flat structure
      return data.map((g: any) => ({
        ...g,
        nodes_count: g.nodes?.[0]?.count || 0,
        nodes: undefined // cleanup
      }));
    });
  }

  async listTrash(supabase: SupabaseClient, userId: string) {
    // Trash is usually not cached or has a separate cache
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .select('*, nodes(count)')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    
    return data.map((g: any) => ({
      ...g,
      nodes_count: g.nodes?.[0]?.count || 0,
      nodes: undefined
    }));
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

  async getGraph(supabase: SupabaseClient, userId: string | null, id: string) {
    const query = supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (userId) {
      // If user is logged in, they can see their own graphs OR public graphs
      // But Supabase RLS might restrict it. 
      // Since we are using service role or authenticated client, we need to handle logic.
      // If using RLS, we just query. But here we might want to enforce ownership check explicitly OR allow if public.
      // Assuming RLS handles "read own" + "read public".
      // But to be safe and explicit:
      // The query above will fail if RLS prevents it.
      // If we want to check ownership specifically:
      // .or(`user_id.eq.${userId},is_public.eq.true`)
      // But standard .select().eq('id', id) combined with RLS is best.
      
      // However, the original code had .eq('user_id', userId). We need to relax that.
      // Let's rely on the result.
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Manual check if not using RLS for public access (double safety)
    if (!data.is_public && (!userId || data.user_id !== userId)) {
       throw new Error('Access denied');
    }

    return data;
  }

  async updateGraph(supabase: SupabaseClient, userId: string, id: string, updates: any) {
    // Only owner can update
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    // Also invalidate graph node cache as metadata changed
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
    return data;
  }

  async deleteGraph(supabase: SupabaseClient, userId: string, id: string) {
    // Soft delete
    const { error } = await supabase
      .from('knowledge_graphs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    // We don't necessarily need to delete the node cache immediately if we allow viewing trash,
    // but usually we want to clear it to prevent stale data if we restore it differently.
    // However, if we soft delete, the `getGraphNodes` should also block access unless we allow reading deleted graphs.
    // Let's clear it.
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
    await cacheService.del(CacheKeys.GRAPH_NODES('public', id));
  }

  async restoreGraph(supabase: SupabaseClient, userId: string, id: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
  }

  async permanentDeleteGraph(supabase: SupabaseClient, userId: string, id: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
    await cacheService.delByPrefix(CacheKeys.STUDY_CARDS(id));
  }

  async getGraphNodes(supabase: SupabaseClient, userId: string | null, graphId: string) {
    // userId can be null for public graphs
    // Use a composite cache key that handles null userId (e.g. "public")
    const cacheKey = CacheKeys.GRAPH_NODES(userId || 'public', graphId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      // 1. Verify access (Ownership or Public)
      const { data: graph, error: graphError } = await supabase
        .from('knowledge_graphs')
        .select('id, user_id, is_public')
        .eq('id', graphId)
        .is('deleted_at', null)
        .single();

      if (graphError || !graph) {
        throw new Error('Graph not found');
      }

      if (!graph.is_public && (!userId || graph.user_id !== userId)) {
        throw new Error('Access denied');
      }

      // Fetch nodes
      const { data: nodes, error: nodesError } = await supabase
        .from('nodes')
        .select('*')
        .eq('graph_id', graphId)
        .is('deleted_at', null);

      if (nodesError) throw nodesError;

      // Fetch edges
      const { data: edges, error: edgesError } = await supabase
        .from('edges')
        .select('*')
        .eq('graph_id', graphId)
        .is('deleted_at', null);

      if (edgesError) throw edgesError;

      return { nodes, edges };
    });
  }

  async getLearningPath(supabase: SupabaseClient, userId: string | null, graphId: string) {
    // 1. Get graph nodes and edges
    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);

    // 2. Identify Root nodes (in-degree 0) or explicitly level='root'
    // Map of id -> node
    const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
    
    // Adjacency list: id -> children[]
    const adj = new Map<string, string[]>();
    // In-degree count
    const inDegree = new Map<string, number>();

    nodes.forEach((n: any) => {
      adj.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    edges.forEach((e: any) => {
      if (adj.has(e.source_node_id) && nodeMap.has(e.target_node_id)) {
        adj.get(e.source_node_id)!.push(e.target_node_id);
        inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
      }
    });

    // 3. Algorithm: Modified Topological Sort / Level-Order
    // We want a coherent path. Pure topological sort can jump between branches.
    // DFS is often better for "learning flow" (Depth First).
    // But we need to respect dependencies (Parents before Children).
    
    // Strategy:
    // - Find all valid start nodes (in-degree 0). 
    // - Sort start nodes by priority (e.g., 'root' level first, then by x_position/title).
    // - Use a Priority Queue or Stack for traversal?
    // - Actually, a simple topological sort works well for dependencies.
    // - To keep it "grouped", when we pop a node, we should try to visit its children next IF they are ready (in-degree 0).
    
    const queue: string[] = []; // Ready to visit
    const result: string[] = [];
    
    // Initialize queue with roots
    nodes.forEach((n: any) => {
      if ((inDegree.get(n.id) || 0) === 0) {
        queue.push(n.id);
      }
    });

    // Sort initial queue to prioritize 'root' level
    const sortNodes = (ids: string[]) => {
      return ids.sort((a, b) => {
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        // Priority levels
        const levels = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
        const levelA = levels[nodeA?.level as keyof typeof levels] ?? 99;
        const levelB = levels[nodeB?.level as keyof typeof levels] ?? 99;
        
        if (levelA !== levelB) return levelA - levelB;
        // Secondary sort by x_position (left to right) or title
        return (nodeA?.x_position || 0) - (nodeB?.x_position || 0);
      });
    };

    queue.sort((a, b) => { // Sort initially
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        const levels = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
        const levelA = levels[nodeA?.level as keyof typeof levels] ?? 99;
        const levelB = levels[nodeB?.level as keyof typeof levels] ?? 99;
        return levelA - levelB;
    });

    // Kahn's Algorithm for Topological Sort with Priority
    // We want to process "branches" together if possible.
    // Standard Kahn's uses a Queue. If we sort the queue/buffer at each step, we can control order.
    
    // Instead of a simple queue, let's use a "Candidate List" and pick the best one.
    // Heuristic:
    // 1. Pick a node.
    // 2. Add it to result.
    // 3. Decrement neighbors in-degree.
    // 4. If neighbor becomes 0, add to candidates.
    // 5. From candidates, pick the one that is a CHILD of the last visited node (to maintain continuity) OR closest in hierarchy.
    
    let candidates = [...queue];
    let lastVisitedId: string | null = null;

    while (candidates.length > 0) {
      // Sort candidates
      // If we have a child of lastVisitedId in candidates, prioritize it!
      candidates.sort((a, b) => {
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        
        // 1. Continuity bonus: Is it a child of lastVisited?
        const isChildA = lastVisitedId && adj.get(lastVisitedId)?.includes(a);
        const isChildB = lastVisitedId && adj.get(lastVisitedId)?.includes(b);
        
        if (isChildA && !isChildB) return -1;
        if (!isChildA && isChildB) return 1;

        // 2. Level priority
        const levels = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
        const levelA = levels[nodeA?.level as keyof typeof levels] ?? 99;
        const levelB = levels[nodeB?.level as keyof typeof levels] ?? 99;
        
        if (levelA !== levelB) return levelA - levelB;

        // 3. Position (Left to Right)
        return (nodeA?.x_position || 0) - (nodeB?.x_position || 0);
      });

      const currentId = candidates.shift()!;
      result.push(currentId);
      lastVisitedId = currentId;

      // Process neighbors
      const neighbors = adj.get(currentId) || [];
      neighbors.forEach(neighborId => {
        const newDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          candidates.push(neighborId);
        }
      });
    }

    // Handle cycles or disconnected components (remaining nodes)
    if (result.length < nodes.length) {
      // Find unvisited nodes
      const visited = new Set(result);
      const unvisited = nodes.filter((n: any) => !visited.has(n.id));
      // Just append them sorted by level
      unvisited.sort((a: any, b: any) => {
         const levels = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
         const levelA = levels[a.level as keyof typeof levels] ?? 99;
         const levelB = levels[b.level as keyof typeof levels] ?? 99;
         return levelA - levelB;
      });
      result.push(...unvisited.map((n: any) => n.id));
    }

    // Return ordered node objects
    return result.map(id => nodeMap.get(id));
  }

  async getGraphNodeStatus(supabase: SupabaseClient, userId: string | null, graphId: string) {
    // 1. Get nodes and edges
    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);

    // If no user (public view), return all unlocked
    if (!userId) {
      const status: Record<string, { locked: boolean; mastered: boolean }> = {};
      nodes.forEach((node: any) => {
        status[node.id] = { locked: false, mastered: false };
      });
      return status;
    }

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
