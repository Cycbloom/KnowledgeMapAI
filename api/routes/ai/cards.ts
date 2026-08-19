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
  const { node_title, node_content, count, types, provider, model, difficulty, custom_prompt, language, graph_id } = req.body;

  try {
    const aiResult = await aiService.generateCards(node_title, node_content, { 
      count, 
      types, 
      provider, 
      model,
      userId: req.user.id,
      graphId: graph_id,
      difficulty,
      customPrompt: custom_prompt,
      language: language ?? undefined,
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
    count: z.number().min(1).max(50).optional(),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
    custom_prompt: z.string().max(10000).optional(),
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

/**
 * 把 config（总题数 / cards_per_type / count_per_difficulty）按 node_count 均分，
 * 产出每个节点的 payload.config，保证所有节点合起来 ≈ 用户指定总数，避免膨胀。
 *
 * 语义：count / cards_per_type / count_per_difficulty 都是「所有节点总计」。
 * 不传入时保持旧行为（每个节点 count=5，兼容存量调用）。
 */
function splitConfigAcrossNodes<T extends { count?: number; cards_per_type?: Record<string, number>; count_per_difficulty?: { easy?: number; medium?: number; hard?: number } }>(
  config: T,
  nodeCount: number,
): T {
  if (nodeCount <= 1) return config;

  const clone = { ...config };

  if (typeof clone.count === "number" && clone.count > 0) {
    const base = Math.floor(clone.count / nodeCount);
    // 余数会在调用方加到前 `remainder` 个节点上，这里先按 base 算基础
    clone.count = Math.max(1, base);
  }

  if (clone.cards_per_type && typeof clone.cards_per_type === "object") {
    const splitCardsPerType: Record<string, number> = {};
    for (const [t, v] of Object.entries(clone.cards_per_type)) {
      if (typeof v === "number" && v > 0) splitCardsPerType[t] = Math.max(1, Math.floor(v / nodeCount));
    }
    clone.cards_per_type = splitCardsPerType;
  }

  if (clone.count_per_difficulty && typeof clone.count_per_difficulty === "object") {
    const src = clone.count_per_difficulty;
    const split: typeof src = {};
    if (typeof src.easy === "number") split.easy = Math.max(0, Math.floor(src.easy / nodeCount));
    if (typeof src.medium === "number") split.medium = Math.max(0, Math.floor(src.medium / nodeCount));
    if (typeof src.hard === "number") split.hard = Math.max(0, Math.floor(src.hard / nodeCount));
    clone.count_per_difficulty = split;
  }

  return clone;
}

router.post('/batch-generate-cards', requireAuth, validate(generateCardsBatchSchema), async (req: AuthedRequest, res: Response) => {
  const { node_ids, config } = req.body;

  try {
    const taskIds = [];
    const supabase = req.supabase;

    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(supabase, node_ids);

    if (graphNodes && graphNodes.length > 0) {
      const nodeCount = graphNodes.length;
      // 每个节点的基础均分 config；余数（remainder）分配给前 `remainder` 个节点，避免总数偏差
      const baseConfig = splitConfigAcrossNodes(config ?? {}, nodeCount);

      // 计算各类「余数」用于前几个节点补偿
      let remainderCount = 0;
      const remainderPerType: Record<string, number> = {};
      const remainderPerDiff: { easy?: number; medium?: number; hard?: number } = {};
      if (typeof config?.count === "number" && config.count > 0) {
        remainderCount = config.count - (baseConfig.count ?? 0) * nodeCount;
      }
      if (config?.cards_per_type) {
        for (const [t, v] of Object.entries(config.cards_per_type)) {
          const base = Number(baseConfig.cards_per_type?.[t] ?? 0);
          const rem = Number(v ?? 0) - base * nodeCount;
          if (rem > 0) remainderPerType[t] = rem;
        }
      }
      if (config?.count_per_difficulty) {
        const src = config.count_per_difficulty;
        const base = baseConfig.count_per_difficulty ?? {};
        const addRem = (key: 'easy'|'medium'|'hard') => {
          if (typeof src[key] === 'number') {
            const b = Number(base[key] ?? 0);
            const rem = (src[key] as number) - b * nodeCount;
            if (rem > 0) remainderPerDiff[key] = rem;
          }
        };
        addRem('easy'); addRem('medium'); addRem('hard');
      }

      for (let i = 0; i < graphNodes.length; i++) {
        const gn = graphNodes[i];
        const nodeConfig: typeof baseConfig & { count?: number; cards_per_type?: Record<string, number>; count_per_difficulty?: { easy?: number; medium?: number; hard?: number } } =
          structuredClone ? structuredClone(baseConfig) : JSON.parse(JSON.stringify(baseConfig));

        // 把余数加到前 N 个节点（N = 余数大小）
        if (typeof nodeConfig.count === "number" && remainderCount > 0 && i < remainderCount) {
          nodeConfig.count += 1;
        }
        if (nodeConfig.cards_per_type) {
          for (const [t, rem] of Object.entries(remainderPerType)) {
            if (rem > 0 && i < rem) {
              nodeConfig.cards_per_type[t] = (nodeConfig.cards_per_type[t] ?? 0) + 1;
            }
          }
        }
        if (nodeConfig.count_per_difficulty) {
          const apply = (k: 'easy'|'medium'|'hard') => {
            const rem = remainderPerDiff[k];
            if (typeof rem === "number" && rem > 0 && i < rem) {
              const cpd = nodeConfig.count_per_difficulty;
              if (cpd) {
                cpd[k] = (cpd[k] ?? 0) + 1;
              }
            }
          };
          apply('easy'); apply('medium'); apply('hard');
        }

        const task = await asyncTaskService.createTask(
          req.user.id, 
          'generate_questions', 
          { 
            knowledge_point_id: gn.knowledge_point_id, 
            node_title: gn.title || '', 
            node_content: gn.content || '',
            config: nodeConfig,
            graph_id: gn.graph_id,
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
    throw new AppError(ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/cross-graph-connections', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graph1_id, graph1_title, graph1_nodes, graph2_id, graph2_title, graph2_nodes, provider, model } = req.body;

  if (!graph1_id || !graph2_id || !graph1_nodes || !graph2_nodes) {
    throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD);
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
