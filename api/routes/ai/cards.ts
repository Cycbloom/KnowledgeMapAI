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

const router = Router();

router.post('/generate-cards', requireAuth, validate(generateCardsSchema), async (req: AuthedRequest, res: Response) => {
  const { node_title, node_content, count, types, provider, model, difficulty, custom_prompt, language, graph_id } = req.body;

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
});

/**
 * 把 config（总题数 / cards_per_type / count_per_difficulty / count_matrix）按 node_count 均分，
 * 产出每个节点的 payload.config，保证所有节点合起来 ≈ 用户指定总数，避免膨胀。
 *
 * 语义：count / cards_per_type / count_per_difficulty / count_matrix 都是「所有节点总计」。
 * 不传入时保持旧行为（每个节点 count=5，兼容存量调用）。
 *
 * 关键：当 nodeCount > 用户总量（如 count=5, nodeCount=10）时，base = floor(5/10) = 0，
 * 调用方的「余数补偿」会把用户总量（5）按格子分配到前 N 个节点上。
 * 早期实现用 `Math.max(1, base)` 强制每个节点至少 1，会导致总量被放大到 nodeCount（5 张要求变 10 张）。
 * 这里只做「无膨胀」分摊，是否分到 0 由余数补偿决定。
 */
export function splitConfigAcrossNodes<T extends {
  count?: number;
  cards_per_type?: Record<string, number>;
  count_per_difficulty?: { easy?: number; medium?: number; hard?: number };
  count_matrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
}>(
  config: T,
  nodeCount: number,
): T {
  if (nodeCount <= 1) return config;

  const clone = { ...config };

  if (typeof clone.count === "number" && clone.count > 0) {
    const base = Math.floor(clone.count / nodeCount);
    // 不再强制 Math.max(1, base)——当 nodeCount > count 时 base=0 正确；余数由调用方补到前 N 个节点
    clone.count = base;
  }

  if (clone.cards_per_type && typeof clone.cards_per_type === "object") {
    const splitCardsPerType: Record<string, number> = {};
    for (const [t, v] of Object.entries(clone.cards_per_type)) {
      if (typeof v === "number" && v > 0) {
        // 同上：移除 Math.max(1, …) 避免总量膨胀
        splitCardsPerType[t] = Math.floor(v / nodeCount);
      }
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

  // 题型×难度矩阵：逐格 floor 均分；余数由调用方按格子补偿
  if (clone.count_matrix && typeof clone.count_matrix === "object") {
    const splitMatrix: Record<string, { easy?: number; medium?: number; hard?: number }> = {};
    for (const [t, cell] of Object.entries(clone.count_matrix)) {
      if (!cell || typeof cell !== "object") continue;
      const splitCell: { easy?: number; medium?: number; hard?: number } = {};
      (["easy", "medium", "hard"] as const).forEach((k) => {
        const v = cell[k];
        if (typeof v === "number" && v > 0) splitCell[k] = Math.floor(v / nodeCount);
      });
      if (Object.keys(splitCell).length > 0) splitMatrix[t] = splitCell;
    }
    clone.count_matrix = splitMatrix;
  }

  return clone;
}

function deepClonePlain<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

router.post('/batch-generate-cards', requireAuth, validate(generateCardsBatchSchema), async (req: AuthedRequest, res: Response) => {
  const { node_ids, config } = req.body;

  const taskIds = [];
  const supabase = req.supabase;

  const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(supabase, node_ids);

  if (graphNodes && graphNodes.length > 0) {
    // 题库批量出题：用户填的 config 是每个节点的题量（不分摊、不求总数约等于用户总量），
    // 直接为每个节点复制一份完整配置。例：5 nodes × {choice:4, qa:4, tf:2} = 每节点 10 题，共产 50 张卡片。
    for (let i = 0; i < graphNodes.length; i++) {
      const gn = graphNodes[i];
      const nodeConfig = deepClonePlain(config ?? {});

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
});

router.post('/batch-expand-graph', requireAuth, validate(batchExpandGraphSchema), async (req: AuthedRequest, res: Response) => {
  const { node_ids } = req.body;

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
});

router.post('/expand-knowledge', requireAuth, validate(expandKnowledgeSchema), async (req: AuthedRequest, res: Response) => {
  const { node_title, node_content, node_level, existing_titles, current_children, expand_prompt, min_count, max_count, use_level_strategy, provider, model, graph_id } = req.body;

  const result = await aiService.expandKnowledge(node_title, node_content, existing_titles || [], current_children || [], { 
    provider, 
    model, 
    contextLevel: node_level, 
    expandPrompt: expand_prompt,
    minCount: min_count,
    maxCount: max_count,
    useLevelStrategy: use_level_strategy,
    userId: req.user.id,
    graphId: graph_id
  });
  res.json(result);
});

router.post('/branch-suggestions', requireAuth, validate(branchSuggestionsSchema), async (req: AuthedRequest, res: Response) => {
  const { node_title, node_content, existing_nodes, child_nodes, context_level, provider, model, graph_id } = req.body;

  const result = await aiService.getBranchSuggestions(node_title, node_content, existing_nodes || [], child_nodes || [], { 
    provider, 
    model, 
    contextLevel: context_level,
    userId: req.user.id,
    graphId: graph_id
  });
  res.json(result);
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

  const result = await aiService.analyzeCrossGraphConnections(
    { id: graph1_id, title: graph1_title, nodes: graph1_nodes },
    { id: graph2_id, title: graph2_title, nodes: graph2_nodes },
    { provider, model, userId: req.user.id }
  );
  res.json(result);
});

export default router;
