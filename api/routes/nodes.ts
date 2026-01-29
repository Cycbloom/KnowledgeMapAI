import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { supabaseAdmin } from 'api/supabase.js';
import { validate } from '../middleware/validate.js';
import { createNodeSchema, updateNodeSchema, createEdgeSchema } from '../schemas/index.js';

const router = Router();

// Create a new node
router.post('/nodes', requireAuth, validate(createNodeSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, title, content, x_position, y_position, color, properties } = req.body;

  // Verify graph ownership
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('id')
    .eq('id', graph_id)
    .single();

  if (!graph) return res.status(403).json({ error: '未经授权访问图谱' });

  const { data, error } = await req.supabase!
    .from('nodes')
    .insert([
      { graph_id, title, content, x_position, y_position, color, properties }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update a node
router.put('/nodes/:id', requireAuth, validate(updateNodeSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // RLS ensures we can only update nodes in our own graphs
  // If the node doesn't exist or we don't own it, RLS will return an error or affect 0 rows.
  // We can select and update in one go, or just update.
  
  const { data, error } = await req.supabase!
    .from('nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  // If no data returned but no error, it means RLS filtered it out or ID doesn't exist
  if (!data) return res.status(404).json({ error: '未找到节点或无权修改' });
  
  res.json(data);
});

// Delete a node
router.delete('/nodes/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Check ownership
  const { data: node } = await supabaseAdmin
    .from('nodes')
    .select('graph_id')
    .eq('id', id)
    .single();
    
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const { data: graph } = await supabaseAdmin
    .from('knowledge_graphs')
    .select('id')
    .eq('id', node.graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized' });

  const { error } = await supabaseAdmin
    .from('nodes')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '节点已删除' });
});

// Create an edge
router.post('/edges', requireAuth, validate(createEdgeSchema), async (req: AuthRequest, res: Response) => {
  const { source_node_id, target_node_id, relationship_type } = req.body;

  // Verify ownership of source node (target should be in same graph usually, but let's check source at least)
  const { data: sourceNode } = await supabaseAdmin
    .from('nodes')
    .select('graph_id')
    .eq('id', source_node_id)
    .single();

  if (!sourceNode) return res.status(404).json({ error: 'Source node not found' });

  const { data: graph } = await supabaseAdmin
    .from('knowledge_graphs')
    .select('id')
    .eq('id', sourceNode.graph_id)
    .eq('user_id', req.user.id)
    .single();

  if (!graph) return res.status(403).json({ error: 'Unauthorized' });

  const { data, error } = await supabaseAdmin
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

  // RLS handles ownership
  const { error } = await req.supabase!
    .from('edges')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Edge deleted' });
});

export default router;
