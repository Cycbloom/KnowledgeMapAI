import { Router, Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { promptService } from '../services/ai';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

// Get all templates for the current user and optional graph
// Returns all raw rows, frontend can organize them by code
router.get('/', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { graph_id } = req.query;
  const userId = req.user.id;
  const supabase = req.supabase;

  const result = await promptService.list(supabase, {
    userId,
    graphId: graph_id as string | undefined
  });

  res.json(result);
}));

// Create or Update a template
router.post('/', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { code, scope, template_content, graph_id } = req.body;
  const userId = req.user.id;
  const supabase = req.supabase;

  if (typeof code !== 'string' || !code.trim()) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  const ALLOWED_SCOPES = ['user', 'graph'] as const;
  type AllowedScope = (typeof ALLOWED_SCOPES)[number];
  if (typeof scope !== 'string' || !(ALLOWED_SCOPES as ReadonlyArray<string>).includes(scope)) {
    throw new AppError(ErrorCodes.VALIDATION_INVALID_PARAMS);
  }
  const safeScope = scope as AllowedScope;

  if (typeof template_content !== 'string') {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  if (!template_content.trim()) {
    throw new AppError(
      'errors.errorCodes.validationEmpty',
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  if (safeScope === 'graph' && !graph_id) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
  }

  const data = await promptService.saveTemplate(supabase, {
    code,
    scope: safeScope,
    user_id: userId,
    graph_id: safeScope === 'graph' ? graph_id : null,
    template_content
  });

  res.json(data);
}));

// Delete a template (Reset to default)
router.delete('/:id', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const supabase = req.supabase;

  await promptService.deleteTemplate(supabase, id);

  res.json({ success: true });
}));

// Optimize Prompt using AI
router.post('/optimize', requireAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { template_content, instruction } = req.body;
  
  if (!template_content) {
    throw new AppError('模板内容不能为空', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const optimizedContent = await promptService.optimizeWithAI(template_content, instruction);
  res.json({ optimized_content: optimizedContent });
}));

export default router;
