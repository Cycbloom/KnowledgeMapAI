import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { aiService } from '../services/aiService.js';
import { z } from 'zod';

const router = Router();

const createKnowledgePointSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    content: z.string().optional(),
    learning_material: z.string().optional(),
    properties: z.record(z.any()).optional(),
    visibility: z.enum(['private', 'public', 'pending']).optional().default('private'),
  })
});

const updateKnowledgePointSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().optional(),
    learning_material: z.string().optional(),
    properties: z.record(z.any()).optional(),
    visibility: z.enum(['private', 'public', 'pending']).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  })
});

const createGraphNodeSchema = z.object({
  body: z.object({
    graph_id: z.string().uuid(),
    knowledge_point_id: z.string().uuid(),
    x_position: z.number().optional().default(0),
    y_position: z.number().optional().default(0),
    level: z.enum(['root', 'core', 'sub', 'normal', 'leaf']).optional().default('normal'),
    is_accepted: z.boolean().optional().default(true),
  })
});

const searchSimilarSchema = z.object({
  body: z.object({
    query: z.string().min(1),
    threshold: z.number().min(0).max(1).optional().default(0.8),
    limit: z.number().min(1).max(20).optional().default(5),
  })
});

const combinedViewSchema = z.object({
  body: z.object({
    graph_ids: z.array(z.string().uuid()).min(2),
  })
});

router.get('/knowledge-points', requireAuth, async (req: AuthRequest, res: Response) => {
  const { visibility } = req.query;
  
  let query = req.supabase!
    .from('knowledge_points')
    .select('*');
  
  if (visibility === 'public') {
    query = query.eq('visibility', 'public');
  } else {
    query = query.or(`visibility.eq.public,owner_id.eq.${req.user.id}`);
  }
  
  const { data, error } = await query.order('updated_at', { ascending: false });
  
  if (error) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  res.json(data);
});

router.get('/knowledge-points/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const { data, error } = await req.supabase!
    .from('knowledge_points')
    .select('*')
    .eq('id', id)
    .or(`visibility.eq.public,owner_id.eq.${req.user.id}`)
    .single();
  
  if (error || !data) {
    throw new AppError('Knowledge point not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  
  res.json(data);
});

router.get('/knowledge-points/:id/graphs', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const { data, error } = await req.supabase!.rpc('get_knowledge_point_graphs', {
    p_knowledge_point_id: id,
    p_user_id: req.user.id
  });
  
  if (error) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  res.json(data);
});

router.post('/knowledge-points', requireAuth, validate(createKnowledgePointSchema), async (req: AuthRequest, res: Response) => {
  const { title, content, learning_material, properties, visibility } = req.body;
  
  const kpData: any = {
    title,
    content,
    learning_material,
    properties: properties || {},
    visibility: visibility || 'private',
    owner_id: req.user.id,
  };
  
  try {
    const textToEmbed = [title, content].filter(Boolean).join('\n');
    if (textToEmbed) {
      const embedding = await aiService.generateEmbedding(textToEmbed);
      if (embedding) {
        kpData.embedding = embedding;
      }
    }
  } catch (error) {
    console.error('Failed to generate embedding:', error);
  }
  
  const { data, error } = await req.supabase!
    .from('knowledge_points')
    .insert([kpData])
    .select()
    .single();
  
  if (error) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  res.status(201).json(data);
});

router.put('/knowledge-points/:id', requireAuth, validate(updateKnowledgePointSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  const { data: existing } = await req.supabase!
    .from('knowledge_points')
    .select('owner_id')
    .eq('id', id)
    .single();
  
  if (!existing || existing.owner_id !== req.user.id) {
    throw new AppError('Permission denied', 403, ErrorCodes.FORBIDDEN);
  }
  
  if (updates.title || updates.content) {
    try {
      const { data: current } = await req.supabase!
        .from('knowledge_points')
        .select('title, content')
        .eq('id', id)
        .single();
      
      const textToEmbed = [
        updates.title || current?.title,
        updates.content || current?.content
      ].filter(Boolean).join('\n');
      
      if (textToEmbed) {
        const embedding = await aiService.generateEmbedding(textToEmbed);
        if (embedding) {
          updates.embedding = embedding;
        }
      }
    } catch (error) {
      console.error('Failed to generate embedding:', error);
    }
  }
  
  const { data, error } = await req.supabase!
    .from('knowledge_points')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  res.json(data);
});

router.post('/knowledge-points/search-similar', requireAuth, validate(searchSimilarSchema), async (req: AuthRequest, res: Response) => {
  const { query, threshold, limit } = req.body;
  
  try {
    const embedding = await aiService.generateEmbedding(query);
    
    if (!embedding) {
      return res.json([]);
    }
    
    const { data, error } = await req.supabase!.rpc('search_similar_knowledge_points', {
      p_query_embedding: embedding,
      p_user_id: req.user.id,
      p_match_threshold: threshold,
      p_match_count: limit
    });
    
    if (error) {
      throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
    
    res.json(data || []);
  } catch (error: any) {
    console.error('Search similar error:', error);
    res.json([]);
  }
});

router.delete('/knowledge-points/:id/hard-delete', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const { data, error } = await req.supabase!.rpc('hard_delete_knowledge_point', {
    p_knowledge_point_id: id,
    p_user_id: req.user.id
  });
  
  if (error) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  res.json(data);
});

router.post('/graph-nodes', requireAuth, validate(createGraphNodeSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, knowledge_point_id, x_position, y_position, level, is_accepted } = req.body;
  
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('id')
    .eq('id', graph_id)
    .eq('user_id', req.user.id)
    .single();
  
  if (!graph) {
    throw new AppError('Graph not found or unauthorized', 403, ErrorCodes.FORBIDDEN);
  }
  
  const { data, error } = await req.supabase!
    .from('graph_nodes')
    .insert([{
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted
    }])
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') {
      throw new AppError('Knowledge point already exists in this graph', 400, ErrorCodes.VALIDATION_ERROR);
    }
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
  
  res.status(201).json(data);
});

router.post('/graph-nodes/add-existing', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id, knowledge_point_id, x_position, y_position, level } = req.body;
  
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('id')
    .eq('id', graph_id)
    .eq('user_id', req.user.id)
    .single();
  
  if (!graph) {
    throw new AppError('Graph not found or unauthorized', 403, ErrorCodes.FORBIDDEN);
  }
  
  const { data: kp } = await req.supabase!
    .from('knowledge_points')
    .select('id')
    .eq('id', knowledge_point_id)
    .or(`visibility.eq.public,owner_id.eq.${req.user.id}`)
    .single();
  
  if (!kp) {
    throw new AppError('Knowledge point not found or inaccessible', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  
  const { data, error } = await req.supabase!
    .from('graph_nodes')
    .insert([{
      graph_id,
      knowledge_point_id,
      x_position: x_position || 0,
      y_position: y_position || 0,
      level: level || 'normal'
    }])
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') {
      throw new AppError('Knowledge point already exists in this graph', 400, ErrorCodes.VALIDATION_ERROR);
    }
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
  
  res.status(201).json(data);
});

router.delete('/graph-nodes/:id/soft-delete', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  const { data, error } = await req.supabase!.rpc('soft_delete_graph_node', {
    p_graph_node_id: id,
    p_user_id: req.user.id
  });
  
  if (error) {
    throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  if (!data) {
    throw new AppError('Graph node not found or unauthorized', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  
  res.json({ success: true });
});

router.post('/combined-view', requireAuth, validate(combinedViewSchema), async (req: AuthRequest, res: Response) => {
  const { graph_ids } = req.body;
  
  const { data: graphs, error: graphsError } = await req.supabase!
    .from('knowledge_graphs')
    .select('id, title')
    .in('id', graph_ids)
    .eq('user_id', req.user.id);
  
  if (graphsError) {
    throw new AppError(graphsError.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  if (!graphs || graphs.length !== graph_ids.length) {
    throw new AppError('Some graphs not found or unauthorized', 403, ErrorCodes.FORBIDDEN);
  }
  
  const { data: graphNodes, error: nodesError } = await req.supabase!
    .from('graph_nodes')
    .select(`
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      knowledge_points (
        id,
        title,
        content,
        learning_material,
        properties,
        visibility,
        owner_id
      )
    `)
    .in('graph_id', graph_ids)
    .is('deleted_at', null);
  
  if (nodesError) {
    throw new AppError(nodesError.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  const { data: edges, error: edgesError } = await req.supabase!
    .from('edges')
    .select('id, graph_id, source_node_id, target_node_id, relationship_type, weight')
    .in('graph_id', graph_ids)
    .is('deleted_at', null);
  
  if (edgesError) {
    throw new AppError(edgesError.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  const graphMap = new Map(graphs.map(g => [g.id, g]));
  const result = {
    graphs: graph_ids.map((gid: string) => ({
      graph_id: gid,
      graph_title: graphMap.get(gid)?.title || '',
      color: '',
      nodes: (graphNodes || []).filter((gn: any) => gn.graph_id === gid),
      edges: (edges || []).filter((e: any) => e.graph_id === gid)
    })),
    shared_knowledge_points: [] as any[]
  };
  
  const kpGraphMap = new Map<string, any[]>();
  (graphNodes || []).forEach((gn: any) => {
    const kpId = gn.knowledge_point_id;
    if (!kpGraphMap.has(kpId)) {
      kpGraphMap.set(kpId, []);
    }
    kpGraphMap.get(kpId)!.push(gn);
  });
  
  kpGraphMap.forEach((nodes, kpId) => {
    if (nodes.length > 1) {
      result.shared_knowledge_points.push({
        knowledge_point_id: kpId,
        knowledge_point: nodes[0].knowledge_points,
        graph_nodes: nodes
      });
    }
  });
  
  res.json(result);
});

export default router;
