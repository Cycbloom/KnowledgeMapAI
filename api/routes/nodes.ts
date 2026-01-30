import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createNodeSchema, updateNodeSchema, createEdgeSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';

const router = Router();

// Create a new node
router.post('/nodes', requireAuth, validate(createNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id, graph_id, title, content, x_position, y_position, color, properties } = req.body;

  // Verify graph ownership
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('id')
    .eq('id', graph_id)
    .single();

  if (!graph) return res.status(403).json({ error: '未经授权访问图谱' });

  const nodeData: any = { graph_id, title, content, x_position, y_position, color, properties };
  if (id) nodeData.id = id;

  const { data, error } = await req.supabase!
    .from('nodes')
    .insert([nodeData])
    .select()
    .single();

  if (error) throw error;
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(graph_id));
  
  res.status(201).json(data);
});

// Update a node
router.put('/nodes/:id', requireAuth, validate(updateNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const { data, error } = await req.supabase!
    .from('nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: '未找到节点或无权修改' });
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(data.graph_id));
  cacheService.del(CacheKeys.STUDY_CARDS(data.graph_id));
  
  res.json(data);
});

// Delete a node
router.delete('/nodes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // We need to get graph_id before deleting to invalidate cache
  // Or we can select it during delete
  const { data, error, count } = await req.supabase!
    .from('nodes')
    .delete({ count: 'exact' })
    .eq('id', id)
    .select('graph_id') // Return graph_id for cache invalidation
    .single();

  if (error) throw error;
  
  // If count is 0 or no data, it means node not found
  if (!data) {
    return res.status(404).json({ error: 'Node not found or unauthorized' });
  }

  // Invalidate cache
  await cacheService.del(CacheKeys.GRAPH_NODES(data.graph_id));
  await cacheService.del(CacheKeys.STUDY_CARDS(data.graph_id));

  res.json({ message: '节点已删除' });
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
    return res.status(404).json({ error: 'Source node not found or unauthorized' });
  }

  // 2. Verify target node exists and is accessible
  const { data: targetNode, error: targetError } = await req.supabase!
    .from('nodes')
    .select('id')
    .eq('id', target_node_id)
    .single();

  if (targetError || !targetNode) {
    return res.status(404).json({ error: 'Target node not found or unauthorized' });
  }

  // 3. Create edge
  const { data, error } = await req.supabase!
    .from('edges')
    .insert([
      { source_node_id, target_node_id, relationship_type }
    ])
    .select()
    .single();

  if (error) throw error;
  
  // Invalidate cache
  cacheService.del(CacheKeys.GRAPH_NODES(sourceNode.graph_id));
  
  res.status(201).json(data);
});

// Delete an edge
router.delete('/edges/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Need to find which graph this edge belongs to.
  // Edge -> Source Node -> Graph
  // We can select source_node_id, then we need to look up graph_id?
  // Or Supabase can do nested select: select('source_node_id, nodes(graph_id)')?
  // Let's try nested select on delete? Delete returns the deleted row.
  
  // Step 1: Get the edge's source node to find the graph (before or during delete)
  // Deleting and selecting nested relation might not work in one go in Supabase/PostgREST for Delete.
  // So fetch first.
  
  const { data: edge } = await req.supabase!
    .from('edges')
    .select('source_node_id, nodes!inner(graph_id)')
    .eq('id', id)
    .single();
    
  if (!edge) return res.status(404).json({ error: 'Edge not found' });

  // Delete
  const { error } = await req.supabase!
    .from('edges')
    .delete()
    .eq('id', id);

  if (error) throw error;
  
  // Invalidate cache
  // @ts-ignore - Supabase types might be tricky with nested join aliases
  const graphId = (edge.nodes as any)?.graph_id;
  if (graphId) {
    cacheService.del(CacheKeys.GRAPH_NODES(graphId));
  }
  
  res.json({ message: 'Edge deleted' });
});

export default router;
