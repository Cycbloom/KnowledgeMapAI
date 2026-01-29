import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// Export graph data
router.get('/export/:format', requireAuth, async (req: AuthRequest, res: Response) => {
  const { format } = req.params;
  const { graph_id } = req.query;

  if (!graph_id) return res.status(400).json({ error: '必须提供 graph_id' });

  // Fetch full graph data
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('*')
    .eq('id', graph_id)
    .single();
    
  if (!graph) return res.status(404).json({ error: 'Graph not found' });

  const { data: nodes } = await req.supabase!.from('nodes').select('*').eq('graph_id', graph_id);
  
  // Get edges via nodes (see graphs.ts for logic, or fetch all edges and filter in memory if needed)
  // For export, we probably want all edges connecting these nodes.
  // Efficient query: Edges where source OR target is in nodes.
  // Supabase doesn't support complex OR across relations easily in one go without raw SQL or multiple queries.
  // We'll fetch edges where source_node_id IN (nodeIds).
  const nodeIds = nodes?.map(n => n.id) || [];
  const { data: edges } = await req.supabase!.from('edges').select('*').in('source_node_id', nodeIds);

  const exportData = {
    graph,
    nodes,
    edges
  };

  if (format === 'json') {
    res.header('Content-Type', 'application/json');
    res.attachment(`graph-${graph_id}.json`);
    return res.send(JSON.stringify(exportData, null, 2));
  } else if (format === 'pdf') {
    // Mock PDF generation for now
    res.header('Content-Type', 'application/pdf');
    res.attachment(`graph-${graph_id}.pdf`);
    return res.send('PDF CONTENT MOCK'); 
  }

  res.status(400).json({ error: 'Unsupported format' });
});

// Import data
router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_title, nodes, edges } = req.body; // Expecting JSON structure

  if (!graph_title || !nodes) {
    return res.status(400).json({ error: '无效的导入数据' });
  }

  // 1. Create Graph
  const { data: graph, error: graphError } = await req.supabase!
    .from('knowledge_graphs')
    .insert([{ user_id: req.user.id, title: graph_title }])
    .select()
    .single();

  if (graphError) return res.status(500).json({ error: graphError.message });

  // 2. Create Nodes
  const nodeMap = new Map(); // Old ID to New ID
  const nodesToInsert = nodes.map((n: any) => {
    // We assume input has some ID, we map it to new UUIDs or let DB generate
    // If we want to preserve relationships, we need to map old IDs.
    // Let's assume input 'nodes' array has 'id' property.
    return {
      graph_id: graph.id,
      title: n.title,
      content: n.content,
      x_position: n.x_position || 0,
      y_position: n.y_position || 0,
      // Store old id in properties to map edges later if needed, or we do it in memory now?
      // Doing it in memory is complex if we batch insert.
      // Easiest: Insert one by one (slow) or use client-generated UUIDs if trusted?
      // Better: User provides content, we create new IDs. Edges must refer to indices or old IDs.
      // Let's assume the client handles ID mapping or we just dump data.
      // For MVP, we just insert nodes. Edges are tricky without ID mapping.
    };
  });

  // Bulk insert nodes
  const { data: insertedNodes, error: nodesError } = await req.supabase!
    .from('nodes')
    .insert(nodesToInsert)
    .select();

  if (nodesError) return res.status(500).json({ error: nodesError.message });

  // If we have edges and logic to map them, we would do it here.
  // For now, just return success with graph info.
  
  res.status(201).json({ message: 'Import successful', graph_id: graph.id, nodes_count: insertedNodes.length });
});

export default router;
