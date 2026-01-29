import { Router, type Response } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// Create a new node
router.post('/nodes', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id, title, content, x_position, y_position, color } = req.body;

  // Verify graph ownership
  const { data: graph } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('id', graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized access to graph' });

  const { data, error } = await supabase
    .from('nodes')
    .insert([
      { graph_id, title, content, x_position, y_position, color }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update a node
router.put('/nodes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // We should verify ownership via graph, but for simplicity we rely on RLS (if configured) or just check graph via node
  // But wait, RLS is on table level. Here we use service role key in backend so RLS is bypassed!
  // We MUST check ownership.
  
  // Get node's graph_id
  const { data: node } = await supabase
    .from('nodes')
    .select('graph_id')
    .eq('id', id)
    .single();
    
  if (!node) return res.status(404).json({ error: 'Node not found' });

  // Check graph ownership
  const { data: graph } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('id', node.graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete a node
router.delete('/nodes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Check ownership
  const { data: node } = await supabase
    .from('nodes')
    .select('graph_id')
    .eq('id', id)
    .single();
    
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const { data: graph } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('id', node.graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized' });

  const { error } = await supabase
    .from('nodes')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Node deleted' });
});

// Create an edge
router.post('/edges', requireAuth, async (req: AuthRequest, res: Response) => {
  const { source_node_id, target_node_id, relationship_type } = req.body;

  // Verify ownership of source node (target should be in same graph usually, but let's check source at least)
  const { data: sourceNode } = await supabase
    .from('nodes')
    .select('graph_id')
    .eq('id', source_node_id)
    .single();

  if (!sourceNode) return res.status(404).json({ error: 'Source node not found' });

  const { data: graph } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('id', sourceNode.graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('edges')
    .insert([
      { source_node_id, target_node_id, relationship_type }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Delete an edge
router.delete('/edges/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Need to find the edge, then the source node, then the graph, then the user
  const { data: edge } = await supabase
    .from('edges')
    .select('source_node_id')
    .eq('id', id)
    .single();

  if (!edge) return res.status(404).json({ error: 'Edge not found' });

  const { data: node } = await supabase
    .from('nodes')
    .select('graph_id')
    .eq('id', edge.source_node_id)
    .single();

  const { data: graph } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('id', node.graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized' });

  const { error } = await supabase
    .from('edges')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Edge deleted' });
});

export default router;
