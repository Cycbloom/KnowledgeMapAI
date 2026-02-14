import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys } from './cache.js';

export class GraphService {
  // Stateless service, no constructor

  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);
    
    return cacheService.getOrSet(cacheKey, async () => {
      const { data: graphs, error } = await supabase
        .from('knowledge_graphs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const graphIds = graphs?.map((g: any) => g.id) || [];
      
      if (graphIds.length === 0) {
        return [];
      }
      
      const { data: nodeCounts } = await supabase
        .from('nodes')
        .select('graph_id')
        .in('graph_id', graphIds)
        .is('deleted_at', null);
      
      const countMap = new Map<string, number>();
      nodeCounts?.forEach((n: any) => {
        countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
      });
      
      return graphs?.map((g: any) => ({
        ...g,
        nodes_count: countMap.get(g.id) || 0
      })) || [];
    });
  }

  async listTrash(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    
    const graphIds = graphs?.map((g: any) => g.id) || [];
    
    if (graphIds.length === 0) {
      return [];
    }
    
    const { data: nodeCounts } = await supabase
      .from('nodes')
      .select('graph_id')
      .in('graph_id', graphIds)
      .is('deleted_at', null);
    
    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: any) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });
    
    return graphs?.map((g: any) => ({
      ...g,
      nodes_count: countMap.get(g.id) || 0
    })) || [];
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
    const cacheKey = CacheKeys.GRAPH(id);
    
    const graph = await cacheService.getOrSet(cacheKey, async () => {
      const { data, error } = await supabase
        .from('knowledge_graphs')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data;
    });

    // Manual check if not using RLS for public access (double safety)
    if (!graph.is_public && (!userId || graph.user_id !== userId)) {
       throw new Error('Access denied');
    }

    return graph;
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
    await cacheService.del(CacheKeys.GRAPH(id));
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
    await cacheService.del(CacheKeys.GRAPH(id));
    // We don't necessarily need to delete the node cache immediately if we allow viewing trash,
    // but usually we want to clear it to prevent stale data if we restore it differently.
    // However, if we soft delete, the `getGraphNodes` should also block access unless we allow reading deleted graphs.
    // Let's clear it.
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
    await cacheService.del(CacheKeys.GRAPH_NODES('public', id));
    await cacheService.del(CacheKeys.LEARNING_PATH(id));
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
    await cacheService.del(CacheKeys.LEARNING_PATH(id));
  }

  async permanentDeleteGraph(supabase: SupabaseClient, userId: string, id: string) {
    const { error } = await supabase
      .from('knowledge_graphs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    await cacheService.del(CacheKeys.GRAPH(id));
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, id));
    await cacheService.delByPrefix(CacheKeys.STUDY_CARDS(id));
    await cacheService.del(CacheKeys.LEARNING_PATH(id));
  }

  async updateNode(supabase: SupabaseClient, userId: string, graphId: string, nodeId: string, updates: any) {
    // Verify access to the graph
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id, is_public')
      .eq('id', graphId)
      .is('deleted_at', null)
      .single();

    if (!graph) throw new Error('Graph not found');
    if (!graph.is_public && graph.user_id !== userId) {
      throw new Error('Access denied');
    }

    // Update the node
    const { data, error } = await supabase
      .from('nodes')
      .update(updates)
      .eq('id', nodeId)
      .eq('graph_id', graphId)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    await cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));
    await cacheService.del(CacheKeys.GRAPH_NODES('public', graphId));
    await cacheService.del(CacheKeys.LEARNING_PATH(graphId));

    return data;
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

      // Fetch nodes and edges in parallel
      const fetchNodes = async () => {
        const batchSize = 1000;
        let allNodes: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: nodes, error: nodesError } = await supabase
            .from('nodes')
            .select('*')
            .eq('graph_id', graphId)
            .is('deleted_at', null)
            .range(offset, offset + batchSize - 1);

          if (nodesError) throw nodesError;

          if (nodes && nodes.length > 0) {
            allNodes = allNodes.concat(nodes);
            offset += nodes.length;
            hasMore = nodes.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        return allNodes;
      };

      const fetchEdges = async () => {
        const batchSize = 1000;
        let allEdges: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: edges, error: edgesError } = await supabase
            .from('edges')
            .select('*')
            .eq('graph_id', graphId)
            .is('deleted_at', null)
            .range(offset, offset + batchSize - 1);

          if (edgesError) throw edgesError;

          if (edges && edges.length > 0) {
            allEdges = allEdges.concat(edges);
            offset += edges.length;
            hasMore = edges.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        return allEdges;
      };

      const [allNodes, allEdges] = await Promise.all([fetchNodes(), fetchEdges()]);

      console.log(`[GraphService] Graph ${graphId}: Fetched ${allNodes.length} nodes, ${allEdges.length} edges`);

      return { nodes: allNodes, edges: allEdges };
    });
  }

  async getLearningPath(supabase: SupabaseClient, userId: string | null, graphId: string) {
    // 1. Check Cache
    const cacheKey = CacheKeys.LEARNING_PATH(graphId);
    const cached = await cacheService.get<string[]>(cacheKey);

    if (cached) {
      // Verify access quickly
      const { data: graph, error } = await supabase
        .from('knowledge_graphs')
        .select('id, user_id, is_public')
        .eq('id', graphId)
        .is('deleted_at', null)
        .single();
        
      if (error || !graph) throw new Error('Graph not found');
      if (!graph.is_public && (!userId || graph.user_id !== userId)) {
        throw new Error('Access denied');
      }
      return cached;
    }

    // 2. Get graph nodes and edges
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
    const path = result.map(id => nodeMap.get(id));

    // Set Cache
    await cacheService.set(cacheKey, path);

    return path;
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

  async analyzeGraph(supabase: SupabaseClient, userId: string, graphId: string) {
    // Verify access
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id, is_public')
      .eq('id', graphId)
      .is('deleted_at', null)
      .single();

    if (!graph) throw new Error('Graph not found');
    if (!graph.is_public && graph.user_id !== userId) {
      throw new Error('Access denied');
    }

    // Get nodes and edges
    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);
    
    // Import analysis function (we'll need to port it to backend or use a shared utility)
    // For now, we'll do a simplified analysis here
    const analysis = this.performGraphAnalysis(nodes, edges);
    return analysis;
  }

  async findMissingConnections(supabase: SupabaseClient, userId: string, graphId: string, maxSuggestions: number = 10) {
    // Verify access
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id, is_public')
      .eq('id', graphId)
      .is('deleted_at', null)
      .single();

    if (!graph) throw new Error('Graph not found');
    if (!graph.is_public && graph.user_id !== userId) {
      throw new Error('Access denied');
    }

    const { nodes, edges } = await this.getGraphNodes(supabase, userId, graphId);
    return this.findMissingConnectionsInternal(nodes, edges, maxSuggestions);
  }

  private performGraphAnalysis(nodes: any[], edges: any[]): any {
    const normalizeId = (id: any) => String(id).trim();
    
    // Build adjacency lists
    const outDegree = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const childrenMap = new Map<string, Set<string>>();
    
    nodes.forEach(node => {
      const id = normalizeId(node.id);
      outDegree.set(id, 0);
      inDegree.set(id, 0);
      childrenMap.set(id, new Set());
    });
    
    edges.forEach(edge => {
      const src = normalizeId(edge.source_node_id);
      const tgt = normalizeId(edge.target_node_id);
      
      outDegree.set(src, (outDegree.get(src) || 0) + 1);
      inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
      childrenMap.get(src)?.add(tgt);
    });
    
    // Calculate degrees
    const degrees = new Map<string, number>();
    nodes.forEach(node => {
      const id = normalizeId(node.id);
      const degree = (outDegree.get(id) || 0) + (inDegree.get(id) || 0);
      degrees.set(id, degree);
    });
    
    // Find isolated nodes
    const isolatedNodes = nodes
      .filter(node => (degrees.get(normalizeId(node.id)) || 0) === 0)
      .map(node => node.id);
    
    // Find disconnected components
    const visited = new Set<string>();
    let componentCount = 0;
    
    const bfs = (startId: string) => {
      const queue = [startId];
      visited.add(startId);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const children = childrenMap.get(current) || new Set();
        
        children.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    };
    
    nodes.forEach(node => {
      const id = normalizeId(node.id);
      if (!visited.has(id)) {
        bfs(id);
        componentCount++;
      }
    });
    
    // Calculate depth
    const depths = new Map<string, number>();
    const rootNodes: string[] = [];
    
    nodes.forEach(node => {
      const id = normalizeId(node.id);
      if ((inDegree.get(id) || 0) === 0 && (outDegree.get(id) || 0) > 0) {
        rootNodes.push(node.id);
      }
    });
    
    if (rootNodes.length === 0) {
      const sortedByOutDegree = [...nodes]
        .sort((a, b) => (outDegree.get(normalizeId(b.id)) || 0) - (outDegree.get(normalizeId(a.id)) || 0))
        .slice(0, Math.min(3, nodes.length));
      rootNodes.push(...sortedByOutDegree.map(n => n.id));
    }
    
    const calculateDepth = (startId: string) => {
      const queue: Array<{ id: string; depth: number }> = [{ id: normalizeId(startId), depth: 0 }];
      const localVisited = new Set<string>();
      
      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (localVisited.has(id)) continue;
        localVisited.add(id);
        
        const currentDepth = depths.get(id) || 0;
        depths.set(id, Math.max(currentDepth, depth));
        
        const children = childrenMap.get(id) || new Set();
        children.forEach(childId => {
          if (!localVisited.has(childId)) {
            queue.push({ id: childId, depth: depth + 1 });
          }
        });
      }
    };
    
    rootNodes.forEach(rootId => calculateDepth(rootId));
    
    nodes.forEach(node => {
      const id = normalizeId(node.id);
      if (!depths.has(id)) {
        depths.set(id, 0);
      }
    });
    
    const depthValues = Array.from(depths.values());
    const maxDepth = depthValues.length > 0 ? Math.max(...depthValues) : 0;
    const avgDepth = depthValues.length > 0 
      ? Math.round((depthValues.reduce((a, b) => a + b, 0) / depthValues.length) * 10) / 10
      : 0;
    
    // Level distribution
    const levelDistribution: Record<string, number> = {
      root: 0,
      core: 0,
      sub: 0,
      normal: 0,
      leaf: 0
    };
    
    nodes.forEach(node => {
      const level = node.level || 'normal';
      if (levelDistribution.hasOwnProperty(level)) {
        levelDistribution[level]++;
      }
    });
    
    // Degree statistics
    const degreeValues = Array.from(degrees.values());
    const avgDegree = degreeValues.length > 0 
      ? Math.round((degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length) * 10) / 10
      : 0;
    const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;
    const minDegree = degreeValues.length > 0 ? Math.min(...degreeValues) : 0;
    
    // Central nodes
    const centralNodes = [...nodes]
      .map(node => ({
        id: node.id,
        degree: degrees.get(normalizeId(node.id)) || 0,
        title: node.title
      }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5);
    
    // Leaf nodes
    const leafNodes = nodes
      .filter(node => (outDegree.get(normalizeId(node.id)) || 0) === 0)
      .map(node => node.id);
    
    // Nodes without content
    const nodesWithoutContent = nodes
      .filter(node => !node.content || node.content.trim().length === 0)
      .map(node => node.id);
    
    // Nodes with many children
    const nodesWithManyChildren = [...nodes]
      .map(node => ({
        id: node.id,
        childrenCount: childrenMap.get(normalizeId(node.id))?.size || 0,
        title: node.title
      }))
      .filter(n => n.childrenCount >= 5)
      .sort((a, b) => b.childrenCount - a.childrenCount)
      .slice(0, 10);
    
    // Health score
    const healthIssues: string[] = [];
    let healthScore = 100;
    
    if (isolatedNodes.length > 0) {
      const penalty = Math.min(20, isolatedNodes.length * 2);
      healthScore -= penalty;
      healthIssues.push(`${isolatedNodes.length} 个孤立节点`);
    }
    
    if (componentCount > 1) {
      const penalty = Math.min(15, (componentCount - 1) * 5);
      healthScore -= penalty;
      healthIssues.push(`${componentCount} 个不连通的组件`);
    }
    
    if (nodesWithoutContent.length > nodes.length * 0.3) {
      const penalty = Math.min(15, Math.floor(nodesWithoutContent.length / nodes.length * 30));
      healthScore -= penalty;
      healthIssues.push(`${nodesWithoutContent.length} 个节点缺少内容`);
    }
    
    if (rootNodes.length === 0) {
      healthScore -= 10;
      healthIssues.push('缺少根节点');
    }
    
    if (avgDegree < 1) {
      healthScore -= 10;
      healthIssues.push('平均连接度较低');
    }
    
    healthScore = Math.max(0, healthScore);
    
    if (healthScore === 100) {
      healthIssues.push('图谱结构健康');
    }
    
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      isolatedNodes,
      disconnectedComponents: componentCount,
      maxDepth,
      avgDepth,
      levelDistribution,
      avgDegree,
      maxDegree,
      minDegree,
      centralNodes,
      rootNodes,
      leafNodes,
      nodesWithoutContent,
      nodesWithManyChildren,
      healthScore: Math.round(healthScore),
      healthIssues
    };
  }

  private findMissingConnectionsInternal(nodes: any[], edges: any[], maxSuggestions: number): any[] {
    const normalizeId = (id: any) => String(id).trim();
    const suggestions: Array<{ sourceId: string; targetId: string; reason: string }> = [];
    
    // Build existing connections set
    const existingConnections = new Set<string>();
    edges.forEach(edge => {
      const src = normalizeId(edge.source_node_id);
      const tgt = normalizeId(edge.target_node_id);
      existingConnections.add(`${src}-${tgt}`);
      existingConnections.add(`${tgt}-${src}`);
    });
    
    // Find nodes with same parent
    const parentMap = new Map<string, Set<string>>();
    edges.forEach(edge => {
      const src = normalizeId(edge.source_node_id);
      const tgt = normalizeId(edge.target_node_id);
      if (!parentMap.has(tgt)) {
        parentMap.set(tgt, new Set());
      }
      parentMap.get(tgt)!.add(src);
    });
    
    // Group nodes by parent
    const siblingsMap = new Map<string, string[]>();
    nodes.forEach(node => {
      const id = normalizeId(node.id);
      const parents = parentMap.get(id) || new Set();
      parents.forEach(parentId => {
        if (!siblingsMap.has(parentId)) {
          siblingsMap.set(parentId, []);
        }
        siblingsMap.get(parentId)!.push(id);
      });
    });
    
    // Suggest connections between siblings
    siblingsMap.forEach((siblings, parentId) => {
      for (let i = 0; i < siblings.length; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
          const src = siblings[i];
          const tgt = siblings[j];
          const key = `${src}-${tgt}`;
          
          if (!existingConnections.has(key)) {
            const sourceNode = nodes.find(n => normalizeId(n.id) === src);
            const targetNode = nodes.find(n => normalizeId(n.id) === tgt);
            
            if (sourceNode && targetNode) {
              const parentNode = nodes.find(n => normalizeId(n.id) === parentId);
              suggestions.push({
                sourceId: sourceNode.id,
                targetId: targetNode.id,
                reason: `同属于 "${parentNode?.title || '未知'}" 的子节点`
              });
            }
          }
        }
      }
    });
    
    return suggestions.slice(0, maxSuggestions);
  }
}


export const graphService = new GraphService();
