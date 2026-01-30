import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importDataSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';

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

// Import data with Manual Rollback Transaction
router.post('/import', requireAuth, validate(importDataSchema), async (req: AuthRequest, res: Response) => {
  const { graph_title, nodes, edges } = req.body;
  let createdGraphId: string | null = null;

  try {
    // 1. Create Graph
    const { data: graph, error: graphError } = await req.supabase!
      .from('knowledge_graphs')
      .insert([{ user_id: req.user.id, title: graph_title }])
      .select()
      .single();

    if (graphError) throw new Error(graphError.message);
    createdGraphId = graph.id;

    // 2. Create Nodes
    const nodeMap = new Map(); // Old ID to New ID
    const nodesToInsert = [];
    
    if (nodes && Array.isArray(nodes)) {
      for (const n of nodes) {
        nodesToInsert.push({
          graph_id: graph.id,
          title: n.title,
          content: n.content,
          x_position: n.x_position || 0,
          y_position: n.y_position || 0,
          z_position: n.z_position || 0,
          color: n.color,
          level: n.level || 'normal',
          properties: n.properties || {}
        });
      }
      
      const { data: insertedNodes, error: nodesError } = await req.supabase!
        .from('nodes')
        .insert(nodesToInsert)
        .select();

      if (nodesError) throw new Error(nodesError.message);

      // Build ID map
      if (insertedNodes && insertedNodes.length === nodes.length) {
        for (let i = 0; i < nodes.length; i++) {
          const oldId = nodes[i].id;
          const newId = insertedNodes[i].id;
          if (oldId) {
            nodeMap.set(oldId, newId);
          }
        }
      }

      // 3. Create Edges
      if (edges && Array.isArray(edges) && edges.length > 0) {
        const edgesToInsert = [];
        
        for (const e of edges) {
          const sourceId = nodeMap.get(e.source);
          const targetId = nodeMap.get(e.target);
          
          if (sourceId && targetId) {
            edgesToInsert.push({
              source_node_id: sourceId,
              target_node_id: targetId,
              relationship_type: e.relationship || 'related'
            });
          }
        }
        
        if (edgesToInsert.length > 0) {
          const { error: edgesError } = await req.supabase!
            .from('edges')
            .insert(edgesToInsert);
            
          if (edgesError) throw new Error(edgesError.message);
        }
      }
    }

    // Success! Invalidate user graphs cache
    await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
    
    res.status(201).json({ graph });

  } catch (error: any) {
    console.error('Import failed, rolling back:', error);
    
    // Rollback: Delete the graph if it was created
    if (createdGraphId) {
      await req.supabase!
        .from('knowledge_graphs')
        .delete()
        .eq('id', createdGraphId);
    }
    
    throw error;
  }
});

export default router;
