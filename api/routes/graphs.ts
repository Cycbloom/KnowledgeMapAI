import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createGraphSchema, updateGraphSchema } from '../schemas/index.js';

const router = Router();

// List all graphs for the user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await req.supabase!
    .from('knowledge_graphs')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
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
  res.json({ message: '图谱删除成功' });
});

// Get nodes and edges for a graph
router.get('/:id/nodes', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

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

  // Fetch edges (where source or target is in nodes list - but easier to just query by graph logic if edges had graph_id, but they don't.
  // Actually, edges link nodes. We need to fetch edges where source_node_id IN (nodes.ids).
  // But standard way is to just fetch all edges if the graph is small, or filter.
  // Since edges don't have graph_id, we must filter by the nodes we found.
  
  const nodeIds = nodes.map(n => n.id);
  
  if (nodeIds.length === 0) {
    return res.json({ nodes: [], edges: [] });
  }

  const { data: edges, error: edgesError } = await req.supabase!
    .from('edges')
    .select('*')
    .in('source_node_id', nodeIds); // This gets edges starting from these nodes. 
    // Technically we should check both ends, but in a closed graph, edges connect two nodes in the graph.
    // If we only check source, we might miss edges if we are importing partial data? No, valid edges connect valid nodes.
  
  if (edgesError) return res.status(500).json({ error: edgesError.message });

  res.json({ nodes, edges });
});

export default router;
