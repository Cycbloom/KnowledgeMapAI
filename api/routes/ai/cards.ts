import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { 
  generateCardsSchema, 
  generateCardsBatchSchema,
  expandKnowledgeSchema,
  branchSuggestionsSchema,
  batchExpandGraphSchema
} from '../../schemas/index.js';
import { ErrorCodes } from '../../constants/errorCodes.js';
import { AppError } from '../../middleware/errorHandler.js';
import { aiService } from '../../services/aiService.js';
import { taskService } from '../../services/taskService.js';
import { graphNodeService } from '../../services/graphNodeService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

router.post('/generate-cards', requireAuth, validate(generateCardsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, count, types, provider, model, graph_id } = req.body;

  try {
    const aiResult = await aiService.generateCards(node_title, node_content, { 
      count, 
      types, 
      provider, 
      model,
      userId: req.user.id,
      graphId: graph_id
    });
    res.json({ cards: aiResult.cards || [] });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Error:', error);
    throw new AppError(err.message || 'AI card generation failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/batch-generate-cards', requireAuth, validate(generateCardsBatchSchema), async (req: AuthRequest, res: Response) => {
  const { node_ids, config } = req.body;

  try {
    const taskIds = [];
    const supabase = req.supabase!;

    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(supabase, node_ids);

    if (graphNodes && graphNodes.length > 0) {
      for (const gn of graphNodes) {
        const kp = gn.knowledge_point;
        const task = await taskService.createTask(
          req.user.id, 
          'generate_questions', 
          { 
            knowledge_point_id: kp?.id || gn.knowledge_point_id, 
            node_title: kp?.title || '', 
            node_content: kp?.content || '',
            config
          }, 
          `生成题目: ${kp?.title || ''}`
        );
        taskIds.push(task.id);
      }
    }

    res.json({ success: true, taskIds, message: `${taskIds.length} tasks started` });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Batch Generation Error:', error);
    throw new AppError(err.message || 'Batch generation failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/batch-expand-graph', requireAuth, validate(batchExpandGraphSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, node_ids, max_depth, provider, model } = req.body;

  try {
    const taskIds = [];
    const supabase = req.supabase!;

    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(supabase, node_ids);

    if (graphNodes && graphNodes.length > 0) {
      for (const gn of graphNodes) {
        const kp = gn.knowledge_point;
        const task = await taskService.createTask(
          req.user.id,
          'expand_graph',
          {
            knowledge_point_id: kp?.id || gn.knowledge_point_id,
            node_title: kp?.title || '',
            node_content: kp?.content || '',
            graph_id: gn.graph_id
          },
          `拓展图谱: ${kp?.title || ''}`
        );
        taskIds.push(task.id);
      }
    }

    res.json({ success: true, taskIds, message: `${taskIds.length} tasks started` });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Batch Expand Error:', error);
    throw new AppError(err.message || 'Batch expand failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/expand-knowledge', requireAuth, validate(expandKnowledgeSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, node_level, existing_titles, current_children, expand_prompt, provider, model, graph_id } = req.body;

  try {
    const result = await aiService.expandKnowledge(node_title, node_content, existing_titles || [], current_children || [], { 
      provider, 
      model, 
      contextLevel: node_level, 
      expandPrompt: expand_prompt,
      userId: req.user.id,
      graphId: graph_id
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Expand Error:', error);
    res.status(500).json({ error: err.message || 'AI 扩展失败' });
  }
});

router.post('/branch-suggestions', requireAuth, validate(branchSuggestionsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, existing_nodes, child_nodes, context_level, provider, model, graph_id } = req.body;

  try {
    const result = await aiService.getBranchSuggestions(node_title, node_content, existing_nodes || [], child_nodes || [], { 
      provider, 
      model, 
      contextLevel: context_level,
      userId: req.user.id,
      graphId: graph_id
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Branch Suggestions Error:', error);
    res.status(500).json({ error: err.message || 'AI 分支建议生成失败' });
  }
});

router.get('/tasks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  try {
    const task = await taskService.getTask(req.supabase!, id, req.user.id);
    
    if (!task) {
      throw new AppError('Task not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json(task);

  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch task', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
