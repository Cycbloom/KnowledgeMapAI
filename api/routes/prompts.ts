import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { getAIProviderForTask } from '../services/ai/factory';
import { promptService } from '../services/ai/promptService';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { logger } from '../utils/logger';

const router = Router();

// Get all templates for the current user and optional graph
// Returns all raw rows, frontend can organize them by code
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id } = req.query;
  const userId = req.user.id;
  const supabase = req.supabase!;

  try {
    const result = await promptService.list(supabase, {
      userId,
      graphId: graph_id as string | undefined
    });

    res.json(result);

  } catch (error: any) {
    logger.error('Get Prompts Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or Update a template
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { code, scope, template_content, graph_id } = req.body;
  const userId = req.user.id;
  const supabase = req.supabase!;

  if (!code || !scope || !template_content) {
    throw new AppError('Missing required fields', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (scope === 'system') {
    throw new AppError('Cannot modify system templates directly', 403, ErrorCodes.FORBIDDEN);
  }

  if (scope === 'graph' && !graph_id) {
    throw new AppError('Graph ID required for graph scope', 400, ErrorCodes.VALIDATION_ERROR);
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

  } catch (error: any) {
    logger.error('Save Prompt Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a template (Reset to default)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const supabase = req.supabase!;

  try {
    await promptService.deleteTemplate(supabase, id);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete Prompt Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Optimize Prompt using AI
router.post('/optimize', requireAuth, async (req: AuthRequest, res: Response) => {
  const { template_content, instruction } = req.body;
  
  if (!template_content) {
    throw new AppError('Template content required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const provider = await getAIProviderForTask('text');
    
    if (!provider.hasKey) {
      throw new AppError('AI Provider not configured', 500, ErrorCodes.INTERNAL_ERROR);
    }

    const messages: any[] = [
      {
        role: "system",
        content: `You are an expert Prompt Engineer. Your task is to optimize the given prompt template for an LLM.
        
        Goals:
        1. Improve clarity and precision.
        2. Maintain all existing Handlebars variables (e.g., {{variable}}). DO NOT remove or rename them.
        3. Maintain the original intent and output format.
        4. Apply best practices (Persona, Context, Task, Constraints).
        5. If an instruction is provided, follow it to modify the prompt.
        
        Output:
        Return ONLY the optimized prompt text. Do not include explanations or markdown fences unless part of the prompt.`
      },
      {
        role: "user",
        content: `Original Prompt:
${template_content}

${instruction ? `User Instruction: ${instruction}` : ''}`
      }
    ];

    const completion = await provider.client.chat.completions.create({
      messages,
      model: provider.model,
      temperature: 0.7,
    });

    const optimizedContent = completion.choices[0].message.content;
    res.json({ optimized_content: optimizedContent });

  } catch (error: any) {
    logger.error('Optimize Prompt Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
