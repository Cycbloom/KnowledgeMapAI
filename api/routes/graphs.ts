import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createGraphSchema, updateGraphSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';

const router = Router();

// List all graphs for the user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const cacheKey = CacheKeys.USER_GRAPHS(userId);

  // Try cache first
  const cachedData = cacheService.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const { data, error } = await req.supabase!
    .from('knowledge_graphs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  // Set cache
  cacheService.set(cacheKey, data);
  
  res.json(data);
});

// Create a new graph
router.post('/', requireAuth, validate(createGraphSchema), async (req: AuthRequest, res: Response) => {
  const { title, description } = req.body;
  // Manual validation removed

  const { data, error } = await req.supabase!
    .from('knowledge_graphs')
    .insert([
      { 
        user_id: req.user.id, 
        title, 
        description: description || '', 
        settings: {} 
      }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  // Invalidate user graphs list
  cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  
  res.status(201).json(data);
});

// Get a specific graph
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { data, error } = await req.supabase!
    .from('knowledge_graphs')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id) // Ensure ownership
    .single();

  if (error) return res.status(404).json({ error: '未找到该图谱' });
  res.json(data);
});

// Update a graph
router.put('/:id', requireAuth, validate(updateGraphSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await req.supabase!
    .from('knowledge_graphs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  // Invalidate user graphs list (title/desc might have changed)
  cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  
  res.json(data);
});

// Delete a graph
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { error } = await req.supabase!
    .from('knowledge_graphs')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  
  // Invalidate user graphs list and graph nodes
  cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  cacheService.del(CacheKeys.GRAPH_NODES(id));
  
  res.json({ message: '图谱删除成功' });
});

// Get nodes and edges for a graph
router.get('/:id/nodes', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Try cache
  const cacheKey = CacheKeys.GRAPH_NODES(id);
  const cachedData = cacheService.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  // Verify ownership first
  const { data: graph, error: graphError } = await req.supabase!
    .from('knowledge_graphs')
    .select('id')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (graphError || !graph) return res.status(404).json({ error: '未找到图谱' });

  // Fetch nodes
  const { data: nodes, error: nodesError } = await req.supabase!
    .from('nodes')
    .select('*')
    .eq('graph_id', id);

  if (nodesError) return res.status(500).json({ error: nodesError.message });

  // Fetch edges
  const nodeIds = nodes.map(n => n.id);
  
  if (nodeIds.length === 0) {
    const emptyResult = { nodes: [], edges: [] };
    cacheService.set(cacheKey, emptyResult);
    return res.json(emptyResult);
  }

  const { data: edges, error: edgesError } = await req.supabase!
    .from('edges')
    .select('*')
    .in('source_node_id', nodeIds);
  
  if (edgesError) return res.status(500).json({ error: edgesError.message });

  const result = { nodes, edges };
  cacheService.set(cacheKey, result);
  
  res.json(result);
});

export default router;
