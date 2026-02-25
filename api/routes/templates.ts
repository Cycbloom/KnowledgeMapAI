import { Router, type Response } from 'express';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema, uuidParamsSchema } from '../schemas/index.js';
import { templateService } from '../services/templateService.js';
import { cacheService } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { category } = req.query;
  const data = await templateService.getTemplates(req.supabase!, req.user?.id || '', { category: category as string });
  res.json(data);
});

router.get('/:id', optionalAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = await templateService.getTemplate(req.supabase!, id);
  if (!data) {
    throw new AppError('未找到该模板', 404, 'TEMPLATE_NOT_FOUND');
  }
  res.json(data);
});

router.post('/', requireAuth, validate({ body: createTemplateSchema }), async (req: AuthRequest, res: Response) => {
  const data = await templateService.createTemplate(req.supabase!, req.user.id, req.body);
  res.status(201).json(data);
});

router.put('/:id', requireAuth, validate({ params: uuidParamsSchema, body: updateTemplateSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = await templateService.updateTemplate(req.supabase!, req.user.id, id, req.body);
  res.json(data);
});

router.delete('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await templateService.deleteTemplate(req.supabase!, req.user.id, id);
  
  await cacheService.delByPrefix('templates_');
  
  res.json({ message: '模板已删除' });
});

export default router;