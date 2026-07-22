import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uuidParamsSchema, createRelationshipTypeSchema, updateRelationshipTypeSchema } from '../schemas/index';
import { relationshipTypeService } from '../services/graph';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { AppError } from '../middleware/errorHandler';
import type { RelationshipCategory } from '@shared/types';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const types = await relationshipTypeService.getAll(req.supabase, req.user.id);
  res.json({ data: types });
});

router.get(
  '/category/:category',
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { category } = req.params;
    const validCategories: RelationshipCategory[] = ['hierarchical', 'dependency', 'semantic', 'temporal', 'interaction', 'causal', 'custom'];

    if (!validCategories.includes(category as RelationshipCategory)) {
      throw new AppError('无效的分类', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const types = await relationshipTypeService.getByCategory(
      req.supabase,
      category as RelationshipCategory,
      req.user.id
    );
    res.json({ data: types });
  }
);

router.get(
  '/:id',
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const type = await relationshipTypeService.getById(req.supabase, id);

    if (!type) {
      throw new AppError('关系类型不存在', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json({ data: type });
  }
);

router.post(
  '/',
  requireAuth,
  validate({ body: createRelationshipTypeSchema }),
  async (req: AuthedRequest, res: Response) => {
    const type = await relationshipTypeService.create(
      req.supabase,
      req.user.id,
      req.body
    );
    res.status(201).json({ data: type });
  }
);

router.put(
  '/:id',
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateRelationshipTypeSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const type = await relationshipTypeService.update(
      req.supabase,
      id,
      req.user.id,
      req.body
    );
    res.json({ data: type });
  }
);

router.delete(
  '/:id',
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await relationshipTypeService.delete(req.supabase, id, req.user.id);
    res.json({ message: '关系类型已删除' });
  }
);

export default router;
