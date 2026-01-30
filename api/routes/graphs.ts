import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createGraphSchema, updateGraphSchema, uuidParamsSchema } from '../schemas/index.js';
import { GraphService } from '../services/graphService.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';



const router = Router();

// List all graphs for the user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const service = new GraphService(req.supabase!, req.user.id);
  const data = await service.listGraphs();
  res.json(data);
});

// Create a new graph
router.post('/', requireAuth, validate({ body: createGraphSchema }), async (req: AuthRequest, res: Response) => {
  const { title, description } = req.body;
  const service = new GraphService(req.supabase!, req.user.id);
  const data = await service.createGraph(title, description);
  res.status(201).json(data);
});

// Get a specific graph
router.get('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const service = new GraphService(req.supabase!, req.user.id);
  const data = await service.getGraph(id);
  if (!data) {
    throw new AppError('未找到该图谱', 404, ErrorCodes.GRAPH_NOT_FOUND);
  }
  res.json(data);
});

// Update a graph
router.put('/:id', requireAuth, validate({ params: uuidParamsSchema, body: updateGraphSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const service = new GraphService(req.supabase!, req.user.id);
  const data = await service.updateGraph(id, updates);
  res.json(data);
});

// Delete a graph
router.delete('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const service = new GraphService(req.supabase!, req.user.id);
  await service.deleteGraph(id);

  // Invalidate user graphs list and graph nodes
  await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
  await cacheService.del(CacheKeys.GRAPH_NODES(id));
  
  res.json({ message: '图谱删除成功' });
});

// Get nodes and edges for a graph
router.get('/:id/nodes', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Try cache
  const cacheKey = CacheKeys.GRAPH_NODES(id);
  const cachedData = await cacheService.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const service = new GraphService(req.supabase!, req.user.id);
  const data = await service.getGraphNodes(id);
  res.json(data);
});

export default router;
