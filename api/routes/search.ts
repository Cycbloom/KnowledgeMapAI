import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { aiService } from '../services/aiService.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q, type } = req.query;
  
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.json({ graphs: [], nodes: [] });
  }

  const query = q.trim();

  try {
    let graphs: any[] = [];
    let nodes: any[] = [];

    // Semantic Search
    if (type === 'semantic') {
      const embedding = await aiService.generateEmbedding(query);
      let answer = '';
      
      if (embedding) {
        const { data: semanticNodes, error: semanticError } = await req.supabase!.rpc('match_nodes', {
          query_embedding: embedding,
          match_threshold: 0.5, // Adjustable threshold
          match_count: 20,
          p_user_id: req.user.id
        });

        if (semanticError) throw semanticError;
        
        if (semanticNodes && semanticNodes.length > 0) {
           const graphIds = [...new Set(semanticNodes.map((n: any) => n.graph_id))];
           const { data: graphInfos } = await req.supabase!
             .from('knowledge_graphs')
             .select('id, title')
             .in('id', graphIds);
             
           const graphMap = new Map(graphInfos?.map((g: any) => [g.id, g.title]));
           
           nodes = semanticNodes.map((n: any) => ({
             ...n,
             knowledge_graphs: { title: graphMap.get(n.graph_id) }
           }));

           // RAG: Generate Answer
           // Use top 5 nodes as context
           const contextNodes = nodes.slice(0, 5);
           const contextText = contextNodes.map((n, i) => 
             `[${i+1}] Title: ${n.title}\nContent: ${n.content || '(No content)'}\nGraph: ${n.knowledge_graphs?.title}`
           ).join('\n\n');

           const messages = [
             { role: 'system', content: 'You are a helpful knowledge assistant. Answer the user\'s question based ONLY on the provided context nodes. If the answer is not in the context, say so. Keep the answer concise and helpful. Respond in the same language as the user query (likely Chinese).' },
             { role: 'user', content: `Context:\n${contextText}\n\nQuestion: ${query}` }
           ];

           try {
             answer = await aiService.chat(messages);
           } catch (aiError) {
             console.error('RAG Generation failed:', aiError);
             // Non-blocking, just return empty answer
           }
        }
      }
      
      res.json({
        graphs: [],
        nodes: nodes || [],
        answer
      });
      return;
    } 
    // Keyword Search (Default)
    else {
      const pattern = `%${query}%`;
      
      // 1. Search Graphs
      const { data: keywordGraphs, error: graphError } = await req.supabase!
        .from('knowledge_graphs')
        .select('id, title, description, updated_at')
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (graphError) throw graphError;
      graphs = keywordGraphs || [];

      // 2. Search Nodes
      const { data: keywordNodes, error: nodeError } = await req.supabase!
        .from('nodes')
        .select('id, title, content, graph_id, knowledge_graphs(title)')
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(20);

      if (nodeError) throw nodeError;
      nodes = keywordNodes || [];
    }

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
