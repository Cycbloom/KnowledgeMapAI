import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createNodeSchema, updateNodeSchema, createEdgeSchema, uuidParamsSchema, batchDeleteNodesSchema, batchUpdatePositionsSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { aiService } from '../services/aiService.js';
import { achievementService } from '../services/achievementService.js';

const router = Router();

// Create a new node
router.post('/nodes', requireAuth, validate(createNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id, graph_id, title, content, x_position, y_position, properties, level, is_accepted } = req.body;

  // Verify graph ownership
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('id')
    .eq('id', graph_id)
    .single();

  if (!graph) {
    throw new AppError('未经授权访问图谱', 403, ErrorCodes.FORBIDDEN);
  }

  const nodeData: any = { 
    graph_id, title, content, x_position, y_position, properties, level, is_accepted,
    deleted_at: null
  };
  if (id) nodeData.id = id;

  try {
    const tags = properties?.tags?.join(', ') || '';
    const textToEmbed = [title, content, tags].filter(Boolean).join('\n');
    
    if (textToEmbed) {
      const embedding = await aiService.generateEmbedding(textToEmbed);
      if (embedding) {
        nodeData.embedding = embedding;
      }
    }
  } catch (error) {
    console.error('Failed to generate embedding for new node:', error);
  }

  let data, error;
  
  if (id) {
    const result = await req.supabase!
      .from('nodes')
      .upsert([nodeData], { onConflict: 'id' })
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    const result = await req.supabase!
      .from('nodes')
      .insert([nodeData])
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error('Create node error:', error);
    throw new AppError(error.message || '创建节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  if (!data) {
    throw new AppError('创建节点失败：无法获取创建的节点', 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
  cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  cacheService.del(CacheKeys.LEARNING_PATH(graph_id));
  
  // Update achievements
  achievementService.updateCreationStats(req.user.id).catch(console.error);

  res.status(201).json(data);
});

// Get a node
router.get('/nodes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { data: node, error } = await req.supabase!
    .from('nodes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !node) {
    throw new AppError('Node not found', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  res.json(node);
});

// Update a node
router.put('/nodes/:id', requireAuth, validate(updateNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Generate embedding if content, title or tags are updated
  if (updates.content || updates.title || updates.properties?.tags) {
    try {
      // Fetch current node data to merge
      const { data: currentNode } = await req.supabase!
        .from('nodes')
        .select('title, content, properties')
        .eq('id', id)
        .single();

      if (currentNode) {
        const title = updates.title || currentNode.title || '';
        const content = updates.content || currentNode.content || '';
        const tags = updates.properties?.tags || currentNode.properties?.tags || [];
        
        const textToEmbed = [title, content, Array.isArray(tags) ? tags.join(', ') : '']
          .filter(Boolean)
          .join('\n');

        if (textToEmbed) {
          const embedding = await aiService.generateEmbedding(textToEmbed);
          if (embedding) {
            updates.embedding = embedding;
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate embedding for updated node:', error);
    }
  }

  const { data, error } = await req.supabase!
    .from('nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message || '更新节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  // Check if node exists and user has permission
  if (!data) {
    throw new AppError('Node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, data.graph_id));
  cacheService.del(CacheKeys.STUDY_CARDS(data.graph_id));
  cacheService.del(CacheKeys.LEARNING_PATH(data.graph_id));
  
  res.json(data);
});

// Get related nodes (Semantic Recommendation)
router.get('/nodes/:id/related', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 5;

  try {
    // 1. Get the source node
    const { data: node, error: nodeError } = await req.supabase!
      .from('nodes')
      .select('id, title, content, embedding, graph_id')
      .eq('id', id)
      .single();

    if (nodeError || !node) {
      throw new AppError('Node not found', 404, ErrorCodes.NODE_NOT_FOUND);
    }

    let embedding = node.embedding;

    // 2. If no embedding, generate it on the fly (Lazy Vectorization)
    if (!embedding && (node.content || node.title)) {
      const textToEmbed = node.content || node.title;
      embedding = await aiService.generateEmbedding(textToEmbed);
      
      // Save it back to DB for future use
      if (embedding) {
        await req.supabase!
          .from('nodes')
          .update({ embedding })
          .eq('id', id);
      }
    }

    if (!embedding) {
      return res.json([]); // Cannot find related without embedding
    }

    // 3. Find similar nodes
    const { data: relatedNodes, error: matchError } = await req.supabase!.rpc('match_nodes', {
      query_embedding: embedding,
      match_threshold: 0.5, // Threshold for "relatedness"
      match_count: limit + 1, // Fetch extra one to filter out self
      p_user_id: req.user.id
    });

    if (matchError) throw matchError;

    // Filter out the source node itself
    const results = (relatedNodes || [])
      .filter((n: any) => n.id !== id)
      .slice(0, limit);

    res.json(results);

  } catch (error: any) {
    console.error('Related nodes error:', error);
    // Don't fail the request if just AI fails, return empty
    if (error instanceof AppError) throw error;
    res.status(500).json({ error: 'Failed to fetch related nodes' });
  }
});

// Delete a node (Soft Delete)
router.delete('/nodes/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // We need to get graph_id before deleting to invalidate cache
  // Or we can select it during delete
  const { data, error, count } = await req.supabase!
    .from('nodes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('graph_id') // Return graph_id for cache invalidation
    .single();

  if (error) throw new AppError(error.message || '删除节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  // If count is 0 or no data, it means node not found
  if (!data) {
    throw new AppError('Node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  // Invalidate cache
  await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, data.graph_id));
  await cacheService.del(CacheKeys.STUDY_CARDS(data.graph_id));
  await cacheService.del(CacheKeys.LEARNING_PATH(data.graph_id));

  res.json({ message: '节点已删除' });
});

// Batch delete nodes
router.post('/nodes/batch-delete', requireAuth, validate(batchDeleteNodesSchema), async (req: AuthRequest, res: Response) => {
  const { node_ids } = req.body;

  // First, get one node to identify the graph (assuming all nodes belong to same graph for now, or just handle cache later)
  // Actually, we should get all graph_ids involved to invalidate caches.
  const { data: nodes } = await req.supabase!
    .from('nodes')
    .select('graph_id')
    .in('id', node_ids);
    
  if (!nodes || nodes.length === 0) {
     return res.json({ message: '未找到匹配的节点', count: 0 });
  }

  const { error, count } = await req.supabase!
    .from('nodes')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', node_ids);

  if (error) throw new AppError(error.message || '批量删除节点失败', 500, ErrorCodes.INTERNAL_ERROR);

  // Invalidate caches for all affected graphs
  const graphIds = [...new Set(nodes.map((n: { graph_id: string }) => n.graph_id))];
  for (const gid of graphIds) {
    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, gid));
    await cacheService.del(CacheKeys.STUDY_CARDS(gid));
    await cacheService.del(CacheKeys.LEARNING_PATH(gid));
  }
  await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));

  res.json({ message: `成功删除 ${count} 个节点`, count });
});

// Batch update node positions (for layout reorganization)
router.post('/nodes/batch-update-positions', requireAuth, validate(batchUpdatePositionsSchema), async (req: AuthRequest, res: Response) => {
  const { positions } = req.body;

  // Get graph_ids for cache invalidation
  const nodeIds = positions.map((p: { id: string }) => p.id);
  const { data: nodes } = await req.supabase!
    .from('nodes')
    .select('id, graph_id')
    .in('id', nodeIds);
    
  if (!nodes || nodes.length === 0) {
    return res.json({ message: '未找到匹配的节点', count: 0 });
  }

  // Update each node's position
  const updatePromises = positions.map((pos: { id: string; x_position: number; y_position: number }) => 
    req.supabase!
      .from('nodes')
      .update({ 
        x_position: pos.x_position, 
        y_position: pos.y_position 
      })
      .eq('id', pos.id)
  );

  const results = await Promise.all(updatePromises);
  
  // Check for errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('Batch position update errors:', errors);
  }

  // Invalidate caches for all affected graphs
  const graphIds = [...new Set(nodes.map((n: { graph_id: string }) => n.graph_id))];
  for (const gid of graphIds) {
    await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, gid));
  }

  res.json({ message: `成功更新 ${positions.length} 个节点位置`, count: positions.length });
});

// Create an edge
router.post('/edges', requireAuth, validate(createEdgeSchema), async (req: AuthRequest, res: Response) => {
  const { source_node_id, target_node_id, relationship_type } = req.body;

  // 1. Verify source node exists and is accessible by user (RLS)
  const { data: sourceNode, error: sourceError } = await req.supabase!
    .from('nodes')
    .select('id, graph_id')
    .eq('id', source_node_id)
    .single();

  if (sourceError || !sourceNode) {
    throw new AppError('Source node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  // 2. Verify target node exists and is accessible
  const { data: targetNode, error: targetError } = await req.supabase!
    .from('nodes')
    .select('id')
    .eq('id', target_node_id)
    .single();

  if (targetError || !targetNode) {
    throw new AppError('Target node not found or unauthorized', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  // 3. Check if edge already exists (including soft-deleted)
  const { data: existingEdge } = await req.supabase!
    .from('edges')
    .select('id, deleted_at')
    .eq('source_node_id', source_node_id)
    .eq('target_node_id', target_node_id)
    .eq('relationship_type', relationship_type)
    .maybeSingle();

  let data: any;
  let error: any;

  if (existingEdge) {
    // Edge exists, restore it if soft-deleted, or just return it
    if (existingEdge.deleted_at) {
      const result = await req.supabase!
        .from('edges')
        .update({ deleted_at: null })
        .eq('id', existingEdge.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Edge already exists and is active, just return it
      data = existingEdge;
      error = null;
    }
  } else {
    // Create new edge
    const result = await req.supabase!
      .from('edges')
      .insert([
        { source_node_id, target_node_id, relationship_type, graph_id: sourceNode.graph_id }
      ])
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) throw new AppError(error.message || '创建边失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, sourceNode.graph_id));
  cacheService.del(CacheKeys.LEARNING_PATH(sourceNode.graph_id));
  
  res.status(201).json(data);
});

// Delete an edge
router.delete('/edges/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Need to find which graph this edge belongs to.
  // Edge -> Source Node -> Graph
  // We can select source_node_id, then we need to look up graph_id?
  // Or Supabase can do nested select: select('source_node_id, nodes(graph_id)')?
  // Let's try nested select on delete? Delete returns the deleted row.
  
  // Delete and get graph_id for cache invalidation
  const { data: edge, error } = await req.supabase!
    .from('edges')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('graph_id')
    .single();

  if (error) throw new AppError(error.message || '删除边失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  if (!edge) {
    throw new AppError('Edge not found or unauthorized', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  
  const graphId = edge.graph_id;
  if (graphId) {
    cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graphId));
    cacheService.del(CacheKeys.LEARNING_PATH(graphId));
  }
  
  res.json({ message: 'Edge deleted' });
});

export default router;
