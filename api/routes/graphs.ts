import { Router, type Response } from 'express';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createGraphSchema, updateGraphSchema, uuidParamsSchema } from '../schemas/index.js';
import { graphService } from '../services/graphService.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// List all graphs for the user (Auth Required)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const data = await graphService.listGraphs(req.supabase!, req.user.id);
  res.json(data);
});

// Create a new graph (Auth Required)
router.post('/', requireAuth, validate({ body: createGraphSchema }), async (req: AuthRequest, res: Response) => {
  const { title, description } = req.body;
  const data = await graphService.createGraph(req.supabase!, req.user.id, title, description);
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
router.put('/:id/share', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { is_public } = req.body;
  
  if (typeof is_public !== 'boolean') {
    throw new AppError('Invalid is_public value', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const data = await graphService.updateGraph(req.supabase!, req.user.id, id, { is_public });
  res.json(data);
});

// Delete a graph (Auth Required)
router.delete('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await graphService.deleteGraph(req.supabase!, req.user.id, id);

  // Invalidate user graphs list and graph nodes
  await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, id));
  // Also invalidate public cache if it was public
  await cacheService.del(CacheKeys.GRAPH_NODES('public', id));
  
  res.json({ message: '图谱删除成功' });
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
  const data = await graphService.getGraphNodeStatus(req.supabase!, userId, id);
  res.json(data);
});

export default router;
