import { Router, type Response } from 'express';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema, createGraphFromTemplateSchema, uuidParamsSchema } from '../schemas/index.js';
import { templateService, TemplateService } from '../services/templateService.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// List all templates (Auth Required for user templates, Optional for system templates)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { category } = req.query;
  const data = await templateService.listTemplates(req.supabase!, category as string);
  res.json(data);
});

// Get a specific template
router.get('/:id', optionalAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = await templateService.getTemplate(req.supabase!, id);
  if (!data) {
    throw new AppError('未找到该模板', 404, 'TEMPLATE_NOT_FOUND');
  }
  res.json(data);
});

// Create a new template (Auth Required)
router.post('/', requireAuth, validate({ body: createTemplateSchema }), async (req: AuthRequest, res: Response) => {
  const data = await templateService.createTemplate(req.supabase!, req.user.id, req.body);
  res.status(201).json(data);
});

// Update a template (Auth Required - Owner Only)
router.put('/:id', requireAuth, validate({ params: uuidParamsSchema, body: updateTemplateSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = await templateService.updateTemplate(req.supabase!, req.user.id, id, req.body);
  res.json(data);
});

// Delete a template (Auth Required - Owner Only, System templates cannot be deleted)
router.delete('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await templateService.deleteTemplate(req.supabase!, req.user.id, id);
  
  // Invalidate template caches
  await cacheService.delByPrefix('templates_');
  
  res.json({ message: '模板已删除' });
});

// Create graph from template (Auth Required)
router.post('/create-graph', requireAuth, validate({ body: createGraphFromTemplateSchema }), async (req: AuthRequest, res: Response) => {
  const { template_id, title, description } = req.body;
  const data = await templateService.createGraphFromTemplate(
    req.supabase!, 
    req.user.id, 
    template_id, 
    title, 
    description
  );
  res.status(201).json(data);
});

export default router;