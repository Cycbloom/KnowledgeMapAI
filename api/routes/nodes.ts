import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
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

  // Use RLS-scoped client (req.supabase) instead of admin
  // Attempt to delete directly. RLS ensures we can only delete nodes in our graphs.
  const { error, count } = await req.supabase!
    .from('nodes')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  
  // If count is 0, it means either node doesn't exist or user doesn't own it.
  // We can return a generic 404 to avoid leaking existence of other users' nodes.
  if (count === 0) {
    return res.status(404).json({ error: 'Node not found or unauthorized' });
  }

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

  // 2. Verify target node exists and is accessible (Optional but recommended for consistency)
  const { data: targetNode, error: targetError } = await req.supabase!
    .from('nodes')
    .select('id')
    .eq('id', target_node_id)
    .single();

  if (targetError || !targetNode) {
    return res.status(404).json({ error: 'Target node not found or unauthorized' });
  }

  // 3. Create edge
  // Note: Edges table RLS should allow insert if source/target nodes are visible.
  // Assuming we have a policy for edges insert based on node ownership.
  // If not, we might need to rely on the fact that we checked nodes above.
  const { data, error } = await req.supabase!
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
