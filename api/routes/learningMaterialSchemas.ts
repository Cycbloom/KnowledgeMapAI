import { Router, Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { learningMaterialSchemaService } from '../services/ai/learningMaterialSchemaService';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { logger } from '../utils/logger';
import type {
  LearningMaterialSchemaCreate,
  LearningMaterialSchemaUpdate,
  LearningSchemaScope,
} from '@shared/types';

const router = Router();

const ALLOWED_SCOPES = ['user', 'graph'] as const;
type AllowedScope = (typeof ALLOWED_SCOPES)[number];

// ============================================================
// GET  /learning-material-schemas?graph_id=xxx
//     列出当前用户可用的所有章节配置方案（system + user + graph）
// ============================================================
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;
  const graphId = req.query.graph_id as string | undefined;

  try {
    const data = await learningMaterialSchemaService.list(req.supabase, userId, {
      graphId,
    });
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('List Learning Schemas Error:', error);
    throw new AppError(
      (error as Error).message,
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

// ============================================================
// GET  /learning-material-schemas/:id
//     获取单个配置详情
// ============================================================
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const data = await learningMaterialSchemaService.get(req.supabase, id);
    if (!data) {
      throw new AppError('配置不存在', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Get Learning Schema Error:', error);
    throw new AppError(
      (error as Error).message,
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

// ============================================================
// POST /learning-material-schemas
//     创建自定义配置（user 或 graph 级，不允许 system）
// ============================================================
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;
  const body = req.body as Partial<LearningMaterialSchemaCreate>;

  const name = (body.name ?? '').toString().trim();
  if (!name) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
      message: '名称不能为空',
    });
  }

  const scope = body.scope as LearningSchemaScope | undefined;
  if (!scope || !(ALLOWED_SCOPES as ReadonlyArray<string>).includes(scope)) {
    throw new AppError(ErrorCodes.VALIDATION_INVALID_PARAMS, {
      message: 'scope 必须是 user 或 graph',
    });
  }
  const safeScope = scope as AllowedScope;

  if (safeScope === 'graph' && !body.graph_id) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
      message: 'graph 级配置必须提供 graph_id',
    });
  }

  if (!Array.isArray(body.sections) || body.sections.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
      message: '至少需要一个章节',
    });
  }

  try {
    const created = await learningMaterialSchemaService.create(
      req.supabase,
      userId,
      {
        name,
        description: body.description,
        scope: safeScope,
        graph_id: safeScope === 'graph' ? body.graph_id : undefined,
        sections: body.sections,
        is_default: Boolean(body.is_default),
      },
    );
    res.json(created);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Create Learning Schema Error:', error);
    throw new AppError(
      (error as Error).message,
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

// ============================================================
// PUT  /learning-material-schemas/:id
//     更新自定义配置（system 级不允许修改）
// ============================================================
router.put('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  const body = req.body as Partial<LearningMaterialSchemaUpdate>;

  const payload: LearningMaterialSchemaUpdate = {};
  if (body.name !== undefined) {
    const name = body.name.toString().trim();
    if (!name) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: '名称不能为空',
      });
    }
    payload.name = name;
  }
  if (body.description !== undefined) {
    payload.description = body.description ?? null;
  }
  if (body.sections !== undefined) {
    if (!Array.isArray(body.sections) || body.sections.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: '至少需要一个章节',
      });
    }
    payload.sections = body.sections;
  }
  if (body.is_default !== undefined) {
    payload.is_default = Boolean(body.is_default);
  }

  try {
    const updated = await learningMaterialSchemaService.update(
      req.supabase,
      userId,
      id,
      payload,
    );
    res.json(updated);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Update Learning Schema Error:', error);
    throw new AppError(
      (error as Error).message,
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

// ============================================================
// DELETE /learning-material-schemas/:id
//        删除自定义配置（system 级不允许删除）
// ============================================================
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    await learningMaterialSchemaService.delete(req.supabase, userId, id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Delete Learning Schema Error:', error);
    throw new AppError(
      (error as Error).message,
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

export default router;
