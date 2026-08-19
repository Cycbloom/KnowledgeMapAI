import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

import type { AIProviderType, CardDifficulty } from '@shared/types';
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
}

function numericDifficulty(d?: CardDifficulty | string): number {
  switch (d) {
    case 'easy': return 1;
    case 'medium': case 'mixed': default: return 2;
    case 'hard': return 3;
  }
}

/**
 * 生成每个节点的 (type, count, difficulty) 任务列表。
 * 优先级 cards_per_type > count_per_difficulty > types×count（或 pack_template 覆盖）
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

  // 1) cards_per_type
  if (config.cards_per_type && typeof config.cards_per_type === 'object') {
    const tasks: ReturnType<typeof buildNodeTasks> = [];
    for (const t of rawTypes) {
      const v = config.cards_per_type[t];
      if (typeof v === 'number' && v > 0) tasks.push({ type: t, count: v, difficulty: baseDiff });
    }
    if (tasks.length > 0) return tasks;
  }

  // 2) count_per_difficulty
  if (config.count_per_difficulty && typeof config.count_per_difficulty === 'object') {
    const diffs: Array<[CardDifficulty, number]> = [];
    (['easy', 'medium', 'hard'] as const).forEach((k) => {
      const v = config.count_per_difficulty?.[k];
      if (typeof v === 'number' && v > 0) diffs.push([k, v]);
    });
    if (diffs.length > 0) {
      const tasks: ReturnType<typeof buildNodeTasks> = [];
      for (const t of rawTypes) {
        for (const [d, v] of diffs) tasks.push({ type: t, count: v, difficulty: d });
      }
      return tasks;
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
      await updateTaskStatus(supabase, taskId, 'in_progress', undefined, undefined, undefined, userId);
      
      const { node_ids, config } = payload;
      const globalDifficulty = config?.difficulty ?? 'medium';
      const customPrompt = config?.custom_prompt;
      const language = config?.language;

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

      const results = [];
      let totalCards = 0;
      let processedCount = 0;
      const nodeTaskTemplate = buildNodeTasks(payload);

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
                });
                return (aiResult.cards || []) as AIGeneratedCard[];
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
                explanation: card.explanation,
                card_type: card.type ?? 'qa',
                options: card.options ? JSON.stringify(card.options) : null,
                next_review: new Date().toISOString(),
                difficulty: numericDifficulty(card.difficulty),
                fsrs_state: 'New' as const,
                fsrs_stability: 0,
                fsrs_difficulty: 0,
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
            progress: Math.round((processedCount / sortedNodes.length) * 100),
            current_node: node.title
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
