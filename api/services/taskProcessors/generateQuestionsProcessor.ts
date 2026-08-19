import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';
import { cacheService, CacheKeys } from '../common/cacheService';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

import type { AIProviderType, CardDifficulty } from '@shared/types';
import { notDeleted } from '../common/softDeleteHelper';

interface GenerateQuestionsPayload {
  knowledge_point_id: string;
  node_title: string;
  node_content?: string;
  graph_id?: string;
  config?: {
    types?: string[];
    count?: number;
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
  provider?: string;
  model?: string;
}

interface AIGeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
  difficulty?: CardDifficulty;
}

/**
 * 1) 优先 cards_per_type：按题型独立分配数量（若用户在 UI 填了题型数量矩阵）
 * 2) 否则用 count_per_difficulty：按难度分配，默认 types 扩展到每一种；
 *    processor 里只取总题数做 AI 调用（我们通过 difficulty/mixed 传递混合比例，
 *    若需要更精细，可在 tasksToRun 按「题型 × 难度」并发）。
 * 3) 否则退回 totalCount（count）：按 types 均分
 */
function buildTasksToRun(payload: GenerateQuestionsPayload): {
  tasks: Array<{ type: string; count: number; difficulty?: CardDifficulty }>;
  totalCount: number;
  effectiveDifficulty: CardDifficulty | 'mixed';
} {
  const config = payload.config ?? {};
  const types =
    config.types && Array.isArray(config.types) && config.types.length > 0
      ? config.types
      : ['qa', 'choice'];
  const totalCountFallback = config.count ?? 5;

  // 1) cards_per_type：直接以该映射为准（只保留选中的 types，数量≥1）
  if (config.cards_per_type && typeof config.cards_per_type === 'object') {
    const entries: Array<[string, number]> = [];
    for (const t of types) {
      const v = config.cards_per_type[t];
      if (typeof v === 'number' && v > 0) entries.push([t, v]);
    }
    if (entries.length > 0) {
      const total = entries.reduce((s, [, v]) => s + v, 0);
      return {
        tasks: entries.map(([type, count]) => ({ type, count, difficulty: config.difficulty ?? 'medium' })),
        totalCount: total,
        effectiveDifficulty: config.difficulty ?? 'medium',
      };
    }
  }

  // 2) count_per_difficulty：在「全局难度 mixed / custom」时启用：把 easy/medium/hard 分配到每一个 type 并发
  if (
    config.count_per_difficulty &&
    typeof config.count_per_difficulty === 'object'
  ) {
    const diffs: Array<[CardDifficulty, number]> = [];
    (['easy', 'medium', 'hard'] as const).forEach((k) => {
      const v = config.count_per_difficulty?.[k];
      if (typeof v === 'number' && v > 0) diffs.push([k, v]);
    });
    if (diffs.length > 0) {
      const tasks: Array<{ type: string; count: number; difficulty: CardDifficulty }> = [];
      for (const type of types) {
        for (const [diff, cnt] of diffs) {
          if (cnt > 0) tasks.push({ type, count: cnt, difficulty: diff });
        }
      }
      const total = tasks.reduce((s, t) => s + t.count, 0);
      return {
        tasks,
        totalCount: total,
        effectiveDifficulty: 'mixed',
      };
    }
  }

  // 3) 回退：types × totalCount 均分
  let remaining = totalCountFallback;
  const tasks: Array<{ type: string; count: number; difficulty?: CardDifficulty }> = [];
  for (let i = 0; i < types.length; i++) {
    const countPerType = Math.ceil(remaining / (types.length - i));
    remaining -= countPerType;
    if (countPerType > 0) {
      tasks.push({ type: types[i], count: countPerType, difficulty: config.difficulty ?? 'medium' });
    }
  }
  return {
    tasks,
    totalCount: totalCountFallback,
    effectiveDifficulty: config.difficulty ?? 'medium',
  };
}

export class GenerateQuestionsProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: GenerateQuestionsPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    logger.info(`Starting generate questions task ${taskId} for user ${userId}`, { payload });

    try {
      await updateTaskStatus(supabase, taskId, 'in_progress', undefined, undefined, undefined, userId);

      const { knowledge_point_id: node_id, node_title, node_content, config } = payload;
      let totalCount = 0;
      const errors: string[] = [];

      const { data: graphNodeData } = await notDeleted(supabase
        .from('graph_nodes')
        .select('graph_id, knowledge_point_id')
        .eq('knowledge_point_id', node_id)
        )
        .single();
      const graph_id = payload.graph_id || graphNodeData?.graph_id;

      const MAX_CONTENT_LENGTH = 15000;
      const truncatedContent = node_content
        ? node_content.substring(0, MAX_CONTENT_LENGTH)
        : '';

      const provider = config?.provider || payload.provider;
      const model = config?.model || payload.model;
      const language = config?.language;
      const customPrompt = config?.custom_prompt;

      const { tasks: tasksToRun, totalCount: totalRequestCount, effectiveDifficulty } = buildTasksToRun(payload);

      logger.debug(
        `Generating questions for node ${node_title}. Total: ${totalRequestCount}, effectiveDifficulty=${effectiveDifficulty}, tasks=${tasksToRun
          .map((t) => `${t.type}×${t.count}[${t.difficulty ?? '-'}]`)
          .join(' | ')}`,
      );

      const CONCURRENCY = 3;
      let completedTasks = 0;

      const processType = async ({
        type,
        count,
        difficulty,
      }: {
        type: string;
        count: number;
        difficulty?: CardDifficulty;
      }) => {
        try {
          const aiResult = await aiService.generateCards(
            node_title,
            truncatedContent,
            {
              type,
              count,
              provider: provider as AIProviderType | undefined,
              model,
              userId,
              graphId: graph_id,
              difficulty: difficulty ?? effectiveDifficulty,
              customPrompt,
              language,
            },
          );
          const cards = (aiResult.cards || []) as AIGeneratedCard[];

          if (cards.length > 0) {
            const cardsToInsert = cards.map((card) => ({
              user_id: userId,
              knowledge_point_id: node_id,
              graph_id,
              question: card.question,
              answer: card.answer,
              explanation: card.explanation,
              card_type: card.type ?? type,
              options: card.options ? JSON.stringify(card.options) : null,
              next_review: new Date().toISOString(),
              difficulty: this.toNumericDifficulty(card.difficulty ?? difficulty ?? effectiveDifficulty),
              fsrs_state: "New",
              fsrs_stability: 0,
              fsrs_difficulty: 0,
              fsrs_elapsed_days: 0,
              fsrs_scheduled_days: 0,
              fsrs_retrievability: 0,
            }));

            const { error } = await supabase
              .from('study_cards')
              .insert(cardsToInsert);

            if (error) {
              logger.error(
                `[GenerateQuestionsProcessor] Failed to insert cards for type ${type}:`,
                error,
              );
              errors.push(`Failed to insert ${type}: ${error.message}`);
            } else {
              totalCount += cards.length;
            }
          } else {
            logger.warn(`[GenerateQuestionsProcessor] AI returned 0 cards for type ${type}`);
          }
        } catch (err: unknown) {
          logger.error(`Error generating type ${type}:`, err);
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Failed to generate ${type}: ${errMsg}`);
        } finally {
          completedTasks++;
          const progress = tasksToRun.length
            ? Math.round((completedTasks / tasksToRun.length) * 100)
            : 100;
          await updateTaskStatus(supabase, taskId, 'in_progress', {
            progress,
            current_node: `正在生成 ${this.getTypeName(type)}${difficulty ? `·${this.getDiffName(difficulty)}` : ''}...`,
          }, undefined, undefined, userId);
        }
      };

      for (let i = 0; i < tasksToRun.length; i += CONCURRENCY) {
        const chunk = tasksToRun.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((t) => processType(t)));
      }

      if (totalCount === 0 && errors.length > 0) {
        throw new AppError(`Failed to generate cards: ${errors.join('; ')}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      if (graph_id) {
        await cacheService.del(CacheKeys.STUDY_CARDS(graph_id));
      }

      logger.info(`Generate questions task ${taskId} completed: ${totalCount} cards`);
      await updateTaskStatus(supabase, taskId, 'completed', {
        count: totalCount,
        progress: 100,
        errors: errors.length > 0 ? errors : undefined,
        total_requested: totalRequestCount,
      }, undefined, undefined, userId);

    } catch (error: unknown) {
      logger.error(`Generate questions task ${taskId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, errorMessage, userId);
    }
  }

  private getTypeName(type: string): string {
    const map: Record<string, string> = {
      qa: '问答题',
      choice: '单选题',
      true_false: '判断题',
      multi_choice: '多选题',
      fill_in_the_blank: '填空题',
      essay: '解答题',
    };
    return map[type] || type;
  }

  private getDiffName(d: string): string {
    return { easy: '简单', medium: '中等', hard: '困难', mixed: '混合' }[d] ?? d;
  }

  private toNumericDifficulty(d?: CardDifficulty | string): number {
    switch (d) {
      case 'easy':
        return 1;
      case 'medium':
      case 'mixed':
      default:
        return 2;
      case 'hard':
        return 3;
    }
  }
}

registerProcessor('generate_questions', new GenerateQuestionsProcessor());
