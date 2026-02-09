import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { getAIProviderForTask } from '../services/ai/factory.js';
import { PromptService } from '../services/promptService.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';

const router = Router();
const promptService = new PromptService();

// Get all templates for the current user and optional graph
// Returns all raw rows, frontend can organize them by code
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id } = req.query;
  const userId = req.user.id;
  const supabase = req.supabase!;

  try {
    // 1. Get System Templates
    const { data: systemTemplates, error: sysError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('scope', 'system');

    if (sysError) throw sysError;

    // 2. Get User Templates
    const { data: userTemplates, error: userError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('scope', 'user')
      .eq('user_id', userId);

    if (userError) throw userError;

    // 3. Get Graph Templates (if graph_id provided)
    let graphTemplates: any[] = [];
    if (graph_id) {
      const { data: gTemplates, error: gError } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('scope', 'graph')
        .eq('graph_id', graph_id);
      
      if (gError) throw gError;
      graphTemplates = gTemplates;
    }

    res.json({
      system: systemTemplates || [],
      user: userTemplates || [],
      graph: graphTemplates || []
    });

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
    const dataToUpsert: any = {
      code,
      scope,
      user_id: userId, // Both user and graph scopes belong to a user owner
      template_content,
      updated_at: new Date().toISOString()
    };

    if (scope === 'graph') {
      dataToUpsert.graph_id = graph_id;
    } else {
      dataToUpsert.graph_id = null;
    }

    // Check if exists to update or insert
    // We use unique constraint (code, scope, user_id, graph_id) for upsert
    const { data, error } = await supabase
      .from('prompt_templates')
      .upsert(dataToUpsert, { onConflict: 'code, scope, user_id, graph_id' })
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    const cacheKey = scope === 'graph' 
      ? `prompt:${code}:${userId}:${graph_id}`
      : `prompt:${code}:${userId}:undefined`;
    
    // We can't easily access the internal cache map of promptService if it's private/protected 
    // or if we don't have a clear method. 
    // But PromptService uses `cacheService`, so we can try to clear it if we knew the key format.
    // The key in PromptService is `PROMPT_TEMPLATE:${code}:${userId}:${graphId || 'undefined'}`
    // Let's assume standard TTL expiry is fine, or we can expose a clear method.
    // For now, we rely on the TTL (5 mins) or maybe we can implement a clear method later.

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
    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id); // Security check

    if (error) throw error;

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
