import { Router, type Response } from 'express';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createGraphSchema, updateGraphSchema, uuidParamsSchema, shareGraphSchema, createGraphFromTemplateSchema } from '../schemas/index.js';
import { graphService, GraphService } from '../services/graphService.js';
import { templateService } from '../services/templateService.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { achievementService } from '../services/achievementService.js';

const router = Router();

// List all graphs for the user (Auth Required)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphService.listGraphs(req.supabase!, req.user.id);
  res.json(data);
});

// List deleted graphs (Auth Required)
router.get('/trash', requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphService.listTrash(req.supabase!, req.user.id);
  res.json(data);
});

router.get('/map', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;
  const userId = req.user.id;

  const { data: graphs } = await supabase
    .from('knowledge_graphs')
    .select('id, title, description, created_at, is_public')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const { data: nodeCounts } = await supabase
    .from('nodes')
    .select('graph_id')
    .in('graph_id', (graphs || []).map(g => g.id))
    .is('deleted_at', null);

  const nodeCountMap = new Map<string, number>();
  (nodeCounts || []).forEach(n => {
    nodeCountMap.set(n.graph_id, (nodeCountMap.get(n.graph_id) || 0) + 1);
  });

  const graphIds = (graphs || []).map(g => g.id);

  const { data: relations } = await supabase
    .from('graph_relations')
    .select('id, source_graph_id, target_graph_id, relation_type, context, metadata, created_at')
    .or(`source_graph_id.in.(${graphIds.join(',')}),target_graph_id.in.(${graphIds.join(',')})`);

  const graphsWithCounts = (graphs || []).map(g => ({
    ...g,
    node_count: nodeCountMap.get(g.id) || 0,
  }));

  res.json({
    graphs: graphsWithCounts,
    relations: relations || [],
  });
});

// Create a new graph (Auth Required)
router.post('/', requireAuth, validate({ body: createGraphSchema }), async (req: AuthRequest, res: Response) => {
  const { title, description } = req.body;
  const data = await graphService.createGraph(req.supabase!, req.user.id, title, description);
  
  // Update achievements
  achievementService.updateCreationStats(req.user.id).catch(console.error);
  
  res.status(201).json(data);
});

// Create a new graph from template (Auth Required)
router.post('/from-template', requireAuth, validate({ body: createGraphFromTemplateSchema }), async (req: AuthRequest, res: Response) => {
  const { template_id, title, description } = req.body;
  const data = await templateService.createGraphFromTemplate(req.supabase!, req.user.id, template_id, title, description);
  res.status(201).json(data);
});

// Get a specific graph (Optional Auth for Public Graphs)
router.get('/:id', optionalAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || null;
  
  // Create anonymous supabase client if no user
  // Assuming middleware attaches a client regardless, or we use a service/anon client?
  // req.supabase should be available. If optionalAuth works correctly, it should attach anon client if no auth.
  
  const data = await graphService.getGraph(req.supabase!, userId, id);
  if (!data) {
    throw new AppError('未找到该图谱', 404, ErrorCodes.GRAPH_NOT_FOUND);
  }
  res.json(data);
});

// Update a graph (Auth Required - Owner Only)
router.put('/:id', requireAuth, validate({ params: uuidParamsSchema, body: updateGraphSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const data = await graphService.updateGraph(req.supabase!, req.user.id, id, updates);
  res.json(data);
});

// Toggle Public Status
router.put('/:id/share', requireAuth, validate({ params: uuidParamsSchema, body: shareGraphSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { is_public } = req.body;
  
  const data = await graphService.updateGraph(req.supabase!, req.user.id, id, { is_public });
  res.json(data);
});

// Delete a graph (Soft Delete)
router.delete('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await graphService.deleteGraph(req.supabase!, req.user.id, id);

  // Invalidate user graphs list and graph nodes
  await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, id));
  // Also invalidate public cache if it was public
  await cacheService.del(CacheKeys.GRAPH_NODES('public', id));
  
  res.json({ message: '图谱已移至回收站' });
});

// Restore a graph
router.post('/:id/restore', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await graphService.restoreGraph(req.supabase!, req.user.id, id);
  res.json({ message: '图谱已恢复' });
});

// Permanently Delete a graph
router.delete('/:id/permanent', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await graphService.permanentDeleteGraph(req.supabase!, req.user.id, id);
  res.json({ message: '图谱已永久删除' });
});

// Get nodes and edges for a graph (Optional Auth)
router.get('/:id/nodes', optionalAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || null;
  const data = await graphService.getGraphNodes(req.supabase!, userId, id);
  res.json(data);
});

// Get node status (Optional Auth - Public view has no status)
router.get('/:id/node-status', optionalAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || null;
  const data = userId ? await graphService.getGraphNodeStatus(req.supabase!, userId, id) : [];
  res.json(data);
});

// Get learning path for a graph (Optional Auth)
router.get('/:id/learning-path', optionalAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || null;
  
  // Reuse logic: users can see path if they can see the graph
  const data = await graphService.getLearningPath(req.supabase!, userId, id);
  res.json({ path: data });
});

// Analyze graph structure (Auth Required)
router.get('/:id/analyze', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  try {
    const analysis = await graphService.analyzeGraph(req.supabase!, userId, id);
    res.json(analysis);
  } catch (error: any) {
    throw new AppError(error.message || '图谱分析失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get missing connection suggestions (Auth Required)
router.get('/:id/missing-connections', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  const maxSuggestions = parseInt(req.query.max as string) || 10;
  
  try {
    const suggestions = await graphService.findMissingConnections(req.supabase!, userId, id, maxSuggestions);
    res.json({ suggestions });
  } catch (error: any) {
    throw new AppError(error.message || '获取连接建议失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
