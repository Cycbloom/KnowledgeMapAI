import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uuidParamsSchema, createRelationshipTypeSchema, updateRelationshipTypeSchema } from '../schemas/index.js';
import { relationshipTypeService } from '../services/graph/index.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
const router = Router();
router.get('/', requireAuth, async (req, res) => {
    const types = await relationshipTypeService.getAll(req.supabase, req.user.id);
    res.json({ data: types });
});
router.get('/category/:category', requireAuth, async (req, res) => {
    const { category } = req.params;
    const validCategories = ['hierarchical', 'dependency', 'semantic', 'temporal', 'interaction', 'causal', 'custom'];
    if (!validCategories.includes(category)) {
        throw new AppError('无效的分类', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const types = await relationshipTypeService.getByCategory(req.supabase, category, req.user.id);
    res.json({ data: types });
});
router.get('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req, res) => {
    const { id } = req.params;
    const type = await relationshipTypeService.getById(req.supabase, id);
    if (!type) {
        throw new AppError('关系类型不存在', 404, ErrorCodes.NOT_FOUND);
    }
    res.json({ data: type });
});
router.post('/', requireAuth, validate({ body: createRelationshipTypeSchema }), async (req, res) => {
    const type = await relationshipTypeService.create(req.supabase, req.user.id, req.body);
    res.status(201).json({ data: type });
});
router.put('/:id', requireAuth, validate({ params: uuidParamsSchema, body: updateRelationshipTypeSchema }), async (req, res) => {
    const { id } = req.params;
    const type = await relationshipTypeService.update(req.supabase, id, req.user.id, req.body);
    res.json({ data: type });
});
router.delete('/:id', requireAuth, validate({ params: uuidParamsSchema }), async (req, res) => {
    const { id } = req.params;
    await relationshipTypeService.delete(req.supabase, id, req.user.id);
    res.json({ message: '关系类型已删除' });
});
export default router;
//# sourceMappingURL=relationshipTypes.js.map