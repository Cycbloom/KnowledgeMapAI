import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

import {
  type AIProviderType,
  type CardDifficulty,
  cardDifficultyToNumber,
  cardDifficultyToFsrsInitial,
  normalizeCardDifficulty,
} from '@shared/types';
import { notDeleted } from '../common/softDeleteHelper';

interface BatchGenerateCardsPayload {
  node_ids: string[];
  graph_id?: string;
  config?: {
    types?: string[];
    count?: number;
    pack_template?: string;
    provider?: string;
    model?: string;
    difficulty?: CardDifficulty;
    coverage?: 'current_only' | 'with_children' | 'with_siblings' | 'graph';
    custom_prompt?: string;
    language?: string;
    cards_per_type?: Record<string, number>;
    count_per_difficulty?: {
      easy?: number;
      medium?: number;
      hard?: number;
    };
    /** 题型×难度二维矩阵（权威配置）：每个非零格子=一次独立 AI 调用 */
    count_matrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
  };
}

interface GraphNodeWithKnowledgePoint {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  level: string;
  knowledge_points: {
    id: string;
    title: string;
    content: string | null;
  }[] | null;
}

interface EdgeForParent {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
}

interface ParentGraphNodeWithKnowledgePoint {
  knowledge_point_id: string;
  knowledge_points: {
    id: string;
    title: string;
    content: string | null;
  }[] | null;
}

interface AIGeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
  difficulty?: CardDifficulty;
  /** 方案E：AI 返回的「原文依据」，用于锚定答案防幻觉 */
  evidence?: string;
}

/**
 * 生成每个节点的 (type, count, difficulty) 任务列表。
 * 优先级 count_matrix > cards_per_type > count_per_difficulty > types×count（或 pack_template 覆盖）
 */
function buildNodeTasks(payload: BatchGenerateCardsPayload): Array<{ type: string; count: number; difficulty: CardDifficulty }> {
  const config = payload.config ?? {};

  let rawTypes =
    config.types && Array.isArray(config.types) && config.types.length > 0
      ? config.types
      : ['qa', 'choice', 'true_false'];
  let rawCount = typeof config.count === 'number' ? config.count : 3;

  if (config.pack_template) {
    switch (config.pack_template) {
      case 'standard':
        rawTypes = ['choice', 'multi_choice', 'fill_in_the_blank', 'essay'];
        rawCount = 10;
        break;
      case 'exam':
        rawTypes = ['choice', 'multi_choice', 'essay'];
        rawCount = 15;
        break;
      case 'quick':
        rawTypes = ['qa', 'choice', 'true_false'];
        rawCount = 3;
        break;
    }
  }

  const baseDiff = config.difficulty ?? 'medium';
  const VALID_TYPES = new Set(['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay']);
  const VALID_DIFFS: ReadonlyArray<CardDifficulty> = ['easy', 'medium', 'hard'];

  // 0) count_matrix：每个非零格子 = 一个独立任务（单题型+单难度）
  if (config.count_matrix && typeof config.count_matrix === 'object') {
    const tasks: ReturnType<typeof buildNodeTasks> = [];
    for (const [type, cell] of Object.entries(config.count_matrix)) {
      if (!VALID_TYPES.has(type) || !cell || typeof cell !== 'object') continue;
      for (const diff of VALID_DIFFS) {
        const v = cell[diff];
        if (typeof v === 'number' && v > 0) tasks.push({ type, count: v, difficulty: diff });
      }
    }
    if (tasks.length > 0) return tasks;
  }

  // 1) cards_per_type
  if (config.cards_per_type && typeof config.cards_per_type === 'object') {
    const tasks: ReturnType<typeof buildNodeTasks> = [];
    for (const t of rawTypes) {
      const v = config.cards_per_type[t];
      if (typeof v === 'number' && v > 0) tasks.push({ type: t, count: v, difficulty: baseDiff });
    }
    if (tasks.length > 0) return tasks;
  }

  // 2) count_per_difficulty：每个难度的总数按题型均分（最大余数法），总数不膨胀
  if (config.count_per_difficulty && typeof config.count_per_difficulty === 'object') {
    const diffs: Array<[CardDifficulty, number]> = [];
    (['easy', 'medium', 'hard'] as const).forEach((k) => {
      const v = config.count_per_difficulty?.[k];
      if (typeof v === 'number' && v > 0) diffs.push([k, v]);
    });
    if (diffs.length > 0) {
      const tasks: ReturnType<typeof buildNodeTasks> = [];
      for (const [d, cnt] of diffs) {
        const base = Math.floor(cnt / rawTypes.length);
        const remainder = cnt - base * rawTypes.length;
        rawTypes.forEach((t, idx) => {
          const c = base + (idx < remainder ? 1 : 0);
          if (c > 0) tasks.push({ type: t, count: c, difficulty: d });
        });
      }
      if (tasks.length > 0) return tasks;
    }
  }

  // 3) 回退：均分 rawCount 到 rawTypes
  let remaining = rawCount;
  const tasks: ReturnType<typeof buildNodeTasks> = [];
  for (let i = 0; i < rawTypes.length; i++) {
    const c = Math.ceil(remaining / (rawTypes.length - i));
    remaining -= c;
    if (c > 0) tasks.push({ type: rawTypes[i], count: c, difficulty: baseDiff });
  }
  return tasks;
}

export class BatchGenerateCardsProcessor implements TaskProcessor {
  async process(
    taskId: string, 
    userId: string, 
    payload: BatchGenerateCardsPayload, 
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    logger.info(`Starting batch generate cards task ${taskId} for user ${userId}`, { payload });
      
      try {
        const { node_ids, config } = payload;
        const globalDifficulty = config?.difficulty ?? 'medium';
        const customPrompt = config?.custom_prompt;
        const language = config?.language;

        const nodeTaskTemplate = buildNodeTasks(payload);
        const totalRequestedCards = nodeTaskTemplate.reduce((s, t) => s + t.count, 0);

      const { data: graphNodes, error: gnError } = await notDeleted(supabase
        .from('graph_nodes')
        .select(`
          id,
          graph_id,
          knowledge_point_id,
          level,
          knowledge_points (
            id,
            title,
            content
          )
        `)
        .in('knowledge_point_id', node_ids)
        );

      if (gnError || !graphNodes || graphNodes.length === 0) {
        throw new AppError('Failed to fetch nodes', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      const nodes = graphNodes.map((gn: GraphNodeWithKnowledgePoint) => {
        const kp = gn.knowledge_points?.[0];
        return {
          id: kp?.id || gn.knowledge_point_id,
          graph_id: payload.graph_id || gn.graph_id,
          graph_node_id: gn.id,
          title: kp?.title || '',
          content: kp?.content || '',
          level: gn.level,
        };
      });

      // 方案A：批量查库内已有题题干 → 按节点分组，生成时注入 anti-duplicate 约束
      const { data: existingRows } = await notDeleted(supabase
        .from('study_cards')
        .select('knowledge_point_id, question')
        .in('knowledge_point_id', node_ids)
        .limit(500));
      const existingByNode = new Map<string, string[]>();
      (existingRows || []).forEach((r) => {
        if (typeof r.question === 'string' && r.question.trim().length > 0) {
          const arr = existingByNode.get(r.knowledge_point_id) ?? [];
          arr.push(r.question);
          existingByNode.set(r.knowledge_point_id, arr);
        }
      });

      const { data: edges } = await supabase
        .from('edges')
        .select('source_knowledge_point_id, target_knowledge_point_id')
        .in('target_knowledge_point_id', node_ids);
      
      const parentMap = new Map<string, string>();
      if (edges) {
        edges.forEach((e: EdgeForParent) => parentMap.set(e.target_knowledge_point_id, e.source_knowledge_point_id));
      }

      const parentIds = Array.from(parentMap.values());
      const parentNodesMap = new Map<string, { id: string; title: string; content: string | null }>();
      
      if (parentIds.length > 0) {
        const { data: parentGraphNodes } = await notDeleted(supabase
          .from('graph_nodes')
          .select(`
            knowledge_point_id,
            knowledge_points (
              id,
              title,
              content
            )
          `)
          .in('knowledge_point_id', parentIds)
          );
        
        if (parentGraphNodes) {
          parentGraphNodes.forEach((pgn: ParentGraphNodeWithKnowledgePoint) => {
            const kp = pgn.knowledge_points?.[0];
            parentNodesMap.set(pgn.knowledge_point_id, {
              id: kp?.id || pgn.knowledge_point_id,
              title: kp?.title || '',
              content: kp?.content || '',
            });
          });
        }
      }

      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const sortedNodes = [...nodes].sort((a, b) => {
        const la = levelOrder[a.level || 'leaf'] ?? 4;
        const lb = levelOrder[b.level || 'leaf'] ?? 4;
        return la - lb;
      });

      await updateTaskStatus(supabase, taskId, 'in_progress', {
        stage: 'init',
        stageLabel: `准备生成 ${sortedNodes.length} 个节点 · 合计约 ${totalRequestedCards} 题`,
        progress: 0,
        processed: 0,
        total: sortedNodes.length,
        current_node: `准备处理 ${sortedNodes.length} 个节点`,
      }, undefined, undefined, userId);

      const results = [];
      let totalCards = 0;
      let processedCount = 0;

      for (const node of sortedNodes) {
        const parentId = parentMap.get(node.id);
        const parentNode = parentId ? parentNodesMap.get(parentId) : null;
        const context = parentNode ? `Parent Node: "${parentNode.title}"` : 'Root Node';

        try {
          const CONCURRENCY = 3;
          let nodeCardCount = 0;

          for (let i = 0; i < nodeTaskTemplate.length; i += CONCURRENCY) {
            const chunk = nodeTaskTemplate.slice(i, i + CONCURRENCY);
            const chunkResults = await Promise.all(
              chunk.map(async (t) => {
                const aiResult = await aiService.generateCards(node.title, node.content, {
                  context,
                  types: [t.type],
                  count: t.count,
                  pack_type: config?.pack_template,
                  provider: config?.provider as AIProviderType | undefined,
                  model: config?.model,
                  userId,
                  graphId: node.graph_id,
                  difficulty: t.difficulty ?? globalDifficulty,
                  customPrompt,
                  language,
                  existingQuestions: existingByNode.get(node.id) ?? [],
                });
                const rawCards = (aiResult.cards || []) as AIGeneratedCard[];
                // 方案B：入库前 normalize AI 自评难度，非法值回退到本任务难度
                const taskFallback = t.difficulty ?? globalDifficulty;
                return rawCards.map((card) => ({
                  ...card,
                  difficulty: normalizeCardDifficulty(card.difficulty, taskFallback),
                }));
              }),
            );
            const cards = chunkResults.flat();

            if (cards.length > 0) {
              const cardsToInsert = cards.map((card) => ({
                user_id: userId,
                knowledge_point_id: node.id,
                graph_id: node.graph_id,
                question: card.question,
                answer: card.answer,
                // 方案E：把 AI 返回的「原文依据」并入 explanation，让答案可追溯、防幻觉
                explanation: card.evidence
                  ? [card.explanation, `原文依据：${card.evidence}`].filter(Boolean).join('\n\n')
                  : card.explanation,
                card_type: card.type ?? 'qa',
                options: card.options ? JSON.stringify(card.options) : null,
                next_review: new Date().toISOString(),
                difficulty: cardDifficultyToNumber(card.difficulty),
                fsrs_state: 'New' as const,
                fsrs_stability: 0,
                // 方案B：FSRS 初始难度种子（易=3 / 中=5 / 难=7），复习时由 FSRS 自适应更新
                fsrs_difficulty: cardDifficultyToFsrsInitial(card.difficulty),
                fsrs_elapsed_days: 0,
                fsrs_scheduled_days: 0,
                fsrs_retrievability: 0,
              }));

              const { error: insertError } = await supabase
                .from('study_cards')
                .insert(cardsToInsert);

              if (insertError) {
                logger.error(`Failed to insert cards for node ${node.id}`, insertError);
              } else {
                nodeCardCount += cards.length;
              }
            }
          }
          
          totalCards += nodeCardCount;
          results.push({ node_id: node.id, title: node.title, cards: nodeCardCount, status: 'success' });
        } catch (err: unknown) {
            logger.error(`Error processing node ${node.id}:`, err);
            const errMsg = err instanceof Error ? err.message : String(err);
            results.push({ node_id: node.id, title: node.title, error: errMsg, status: 'failed' });
        }
        
        processedCount++;
        await updateTaskStatus(supabase, taskId, 'in_progress', { 
            stage: 'generating',
            stageLabel: `节点进度 ${processedCount}/${sortedNodes.length} · 已入库 ${totalCards}/${totalRequestedCards} 题`,
            progress: Math.round((processedCount / sortedNodes.length) * 100),
            processed: processedCount,
            total: sortedNodes.length,
            current_node: node.title,
        }, undefined, undefined, userId);
      }

      logger.info(`Batch card generation completed: ${totalCards} cards generated`);
      await updateTaskStatus(supabase, taskId, 'completed', { 
        success: true, 
        totalCards, 
        details: results 
      }, undefined, undefined, userId);

    } catch (error: unknown) {
      logger.error(`Batch generate cards task ${taskId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, errorMessage, userId);
    }
  }
}

registerProcessor('batch_generate_cards', new BatchGenerateCardsProcessor());
