import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { 
  generateCardsSchema, 
  generateCardsBatchSchema,
  expandKnowledgeSchema,
  branchSuggestionsSchema,
  batchExpandGraphSchema
} from '../../schemas/index';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { AppError } from '../../middleware/errorHandler';
import { aiService } from '../../services/ai';
import { asyncTaskService } from '../../services/asyncTaskService';
import { graphNodeService } from '../../services/graph';
import { studyRouteService } from '../../services/study';
import { logger } from '../../utils/logger';

const router = Router();

router.post('/generate-cards', requireAuth, validate(generateCardsSchema), async (req: AuthedRequest, res: Response) => {
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
    throw new AppError(err.message || 'AI card generation failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

const syncGenerateCardsSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1),
  config: z.object({
    types: z.array(z.string()).optional(),
    count: z.number().min(1).max(20).optional(),
  }).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.post('/sync-generate-cards', requireAuth, validate(syncGenerateCardsSchema), async (req: AuthedRequest, res: Response) => {
  const { node_ids, config, provider, model } = req.body;

  try {
    const { results, summary } = await studyRouteService.syncGenerateCardsForNodes(
      req.user.id,
      node_ids,
      { ...config, provider, model },
    );

    if (results.length === 0) {
      res.json({ success: true, results: [], message: 'No nodes found' });
      return;
    }

    res.json({
      success: true,
      results,
      summary,
      message: `Successfully generated ${summary.totalCards} cards for ${summary.successCount}/${summary.total} nodes`,
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Sync Generation Error:', error);
    throw new AppError(err.message || 'Sync generation failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/batch-generate-cards', requireAuth, validate(generateCardsBatchSchema), async (req: AuthedRequest, res: Response) => {
  const { node_ids, config } = req.body;

  try {
    const taskIds = [];
    const supabase = req.supabase;

    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(supabase, node_ids);

    if (graphNodes && graphNodes.length > 0) {
      for (const gn of graphNodes) {
        const task = await asyncTaskService.createTask(
          req.user.id, 
          'generate_questions', 
          { 
            knowledge_point_id: gn.knowledge_point_id, 
            node_title: gn.title || '', 
            node_content: gn.content || '',
            config
          }, 
          `生成题目: ${gn.title || ''}`
        );
        taskIds.push(task.id);
      }
    }

    res.json({ success: true, taskIds, message: `${taskIds.length} tasks started` });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Batch Generation Error:', error);
    throw new AppError(err.message || 'Batch generation failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/batch-expand-graph', requireAuth, validate(batchExpandGraphSchema), async (req: AuthedRequest, res: Response) => {
  const { node_ids } = req.body;

  try {
    const taskIds = [];
    const supabase = req.supabase;

    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(supabase, node_ids);

    if (graphNodes && graphNodes.length > 0) {
      for (const gn of graphNodes) {
        const task = await asyncTaskService.createTask(
          req.user.id,
          'expand_graph',
          {
            knowledge_point_id: gn.knowledge_point_id,
            node_title: gn.title || '',
            node_content: gn.content || '',
            graph_id: gn.graph_id
          },
          `拓展图谱: ${gn.title || ''}`
        );
        taskIds.push(task.id);
      }
    }

    res.json({ success: true, taskIds, message: `${taskIds.length} tasks started` });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Batch Expand Error:', error);
    throw new AppError(err.message || 'Batch expand failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/expand-knowledge', requireAuth, validate(expandKnowledgeSchema), async (req: AuthedRequest, res: Response) => {
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
    throw new AppError(err.message || 'AI 扩展失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/branch-suggestions', requireAuth, validate(branchSuggestionsSchema), async (req: AuthedRequest, res: Response) => {
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
    throw new AppError(err.message || 'AI 分支建议生成失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/tasks/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  
  try {
    const task = await asyncTaskService.getTask(req.supabase, id, req.user.id);
    
    if (!task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND);
    }

    res.json(task);

  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.FAILED_TO_FETCH_TASK);
  }
});

router.post('/cross-graph-connections', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graph1_id, graph1_title, graph1_nodes, graph2_id, graph2_title, graph2_nodes, provider, model } = req.body;

  if (!graph1_id || !graph2_id || !graph1_nodes || !graph2_nodes) {
    throw new AppError(ErrorCodes.MISSING_GRAPH_NODES_FIELDS);
  }

  try {
    const result = await aiService.analyzeCrossGraphConnections(
      { id: graph1_id, title: graph1_title, nodes: graph1_nodes },
      { id: graph2_id, title: graph2_title, nodes: graph2_nodes },
      { provider, model, userId: req.user.id }
    );
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Cross Graph Connections Error:', error);
    throw new AppError(err.message || 'AI 跨图谱连接分析失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
