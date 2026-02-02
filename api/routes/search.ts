import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.json({ graphs: [], nodes: [] });
  }

  const query = q.trim();
  const pattern = `%${query}%`;

  try {
    // 1. Search Graphs
    const { data: graphs, error: graphError } = await req.supabase!
      .from('knowledge_graphs')
      .select('id, title, description, updated_at')
      .ilike('title', pattern)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (graphError) throw graphError;

    // 2. Search Nodes
    // We select graph title as well to show context
    const { data: nodes, error: nodeError } = await req.supabase!
      .from('nodes')
      .select('id, title, content, graph_id, knowledge_graphs(title)')
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .limit(20);

    if (nodeError) throw nodeError;

    // Filter out nodes where user doesn't have access to graph (RLS handles this usually, but good to be safe)
    // Actually RLS on 'nodes' table should already filter by user's graphs if set up correctly.
    // Assuming RLS policy: "Users can view nodes of their own graphs"

    res.json({
      graphs: graphs || [],
      nodes: nodes || []
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
