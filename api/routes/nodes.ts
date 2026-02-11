import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createNodeSchema, updateNodeSchema, createEdgeSchema, uuidParamsSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { aiService } from '../services/aiService.js';

const router = Router();

// Create a new node
router.post('/nodes', requireAuth, validate(createNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id, graph_id, title, content, x_position, y_position, color, properties, level, is_accepted } = req.body;

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
    graph_id, title, content, x_position, y_position, color, properties, level, is_accepted,
    deleted_at: null // Ensure restored if upserting
  };
  if (id) nodeData.id = id;

  // Generate embedding
  try {
    const textToEmbed = content || title;
    if (textToEmbed) {
      const embedding = await aiService.generateEmbedding(textToEmbed);
      if (embedding) {
        nodeData.embedding = embedding;
      }
    }
  } catch (error) {
    console.error('Failed to generate embedding for new node:', error);
  }

  const { data, error } = await req.supabase!
    .from('nodes')
    .upsert([nodeData], { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new AppError(error.message || '创建节点失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
  cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  cacheService.del(CacheKeys.LEARNING_PATH(graph_id));
  
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
  
  // Generate embedding if content is updated
  if (updates.content) {
    try {
      const embedding = await aiService.generateEmbedding(updates.content);
      if (embedding) {
        updates.embedding = embedding;
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
router.post('/nodes/batch-delete', requireAuth, async (req: AuthRequest, res: Response) => {
  const { node_ids } = req.body; // Expect array of UUIDs

  if (!node_ids || !Array.isArray(node_ids) || node_ids.length === 0) {
    throw new AppError('请提供有效的节点ID列表', 400, ErrorCodes.INVALID_PARAMS);
  }

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

  // 3. Create edge
  const { data, error } = await req.supabase!
    .from('edges')
    .upsert([
      { source_node_id, target_node_id, relationship_type, graph_id: sourceNode.graph_id, deleted_at: null }
    ], { onConflict: 'id' }) // Ideally conflict on (source, target)? But id is PK. We don't have unique constraint on source-target?
    // If user creates duplicate edge, it's a new ID usually.
    // If we want to restore, we need to know the ID.
    // But edge creation usually doesn't pass ID from frontend unless it's Undo.
    // Frontend `addEdge` usually generates temp ID then server returns real ID.
    // If "Undo" creates edge, it might not have the ID.
    // So soft delete for edges is mostly for cascading?
    // If we just INSERT, it creates a NEW row. The old soft-deleted row stays there.
    // This is fine. "Zombie" edges are acceptable.
    .select()
    .single();

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
