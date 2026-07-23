import { Router, Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { promptService } from '../services/ai';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { logger } from '../utils/logger';

const router = Router();

// Get all templates for the current user and optional graph
// Returns all raw rows, frontend can organize them by code
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graph_id } = req.query;
  const userId = req.user.id;
  const supabase = req.supabase;

  try {
    const result = await promptService.list(supabase, {
      userId,
      graphId: graph_id as string | undefined
    });

    res.json(result);

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Get Prompts Error:', error);
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

// Create or Update a template
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { code, scope, template_content, graph_id } = req.body;
  const userId = req.user.id;
  const supabase = req.supabase;

  if (!code || !scope || !template_content) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  if (scope === 'system') {
    throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE);
  }

  if (scope === 'graph' && !graph_id) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  try {
    const data = await promptService.saveTemplate(supabase, {
      code,
      scope,
      user_id: userId,
      graph_id: scope === 'graph' ? graph_id : null,
      template_content
    });

    res.json(data);

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Save Prompt Error:', error);
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

// Delete a template (Reset to default)
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const supabase = req.supabase;

  try {
    await promptService.deleteTemplate(supabase, id);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Delete Prompt Error:', error);
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

// Optimize Prompt using AI
router.post('/optimize', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { template_content, instruction } = req.body;
  
  if (!template_content) {
    throw new AppError('模板内容不能为空', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const optimizedContent = await promptService.optimizeWithAI(template_content, instruction);
    res.json({ optimized_content: optimizedContent });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Optimize Prompt Error:', error);
    throw new AppError((error as Error).message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
