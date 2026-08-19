import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';
import { cacheService, CacheKeys } from '../common/cacheService';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

import {
  type AIProviderType,
  type CardDifficulty,
  cardDifficultyToNumber,
  cardDifficultyToFsrsInitial,
} from '@shared/types';
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
    /** 题型×难度二维矩阵（权威配置）：每个非零格子=一次独立 AI 调用 */
    count_matrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
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
  /** 方案E：AI 返回的「原文依据」，用于锚定答案防幻觉 */
  evidence?: string;
}

/**
 * 任务分派策略（优先级从高到低）：
 * 0) count_matrix：题型×难度二维矩阵，每个非零格子 = 一个独立任务（单题型+单难度，
 *    每个任务一次独立 AI 调用）——UI 矩阵的权威语义，精确落地用户配置
 * 1) cards_per_type：按题型独立分配数量（若用户在 UI 填了题型数量矩阵的行合计）
 * 2) count_per_difficulty：按难度分配（每个难度的总数按题型均分，最大余数法分摊误差）
 * 3) 回退：totalCount（count）按 types 均分
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
  const VALID_TYPES = new Set(['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay']);
  const VALID_DIFFS: ReadonlyArray<CardDifficulty> = ['easy', 'medium', 'hard'];

  // 0) count_matrix：每个非零格子 = 一个独立任务（单题型+单难度）
  // 关键：用户显式传了 matrix 即便全零也必须早退，不能回退到 count ?? 5 的默认 5 张
  // （否则 splitConfigAcrossNodes 把「总题数 3」分摊成 9 节点 × 0 + 1 节点 × 3 = 3 时，
  //  其余 8 个节点本应 0 张，但回退路径会给每个节点补 5 张默认卡片，造成巨大数据膨胀）
  if (config.count_matrix && typeof config.count_matrix === 'object') {
    const tasks: Array<{ type: string; count: number; difficulty: CardDifficulty }> = [];
    for (const [type, cell] of Object.entries(config.count_matrix)) {
      if (!VALID_TYPES.has(type) || !cell || typeof cell !== 'object') continue;
      for (const diff of VALID_DIFFS) {
        const v = cell[diff];
        if (typeof v === 'number' && v > 0) {
          tasks.push({ type, count: v, difficulty: diff });
        }
      }
    }
    const total = tasks.reduce((s, t) => s + t.count, 0);
    return { tasks, totalCount: total, effectiveDifficulty: 'mixed' };
  }

  // 1) cards_per_type：直接以该映射为准（只保留选中的 types，数量≥1）
  // 同上：用户显式传了 cpt 即便全零也早退
  if (config.cards_per_type && typeof config.cards_per_type === 'object') {
    const entries: Array<[string, number]> = [];
    for (const t of types) {
      const v = config.cards_per_type[t];
      if (typeof v === 'number' && v > 0) entries.push([t, v]);
    }
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return {
      tasks: entries.map(([type, count]) => ({ type, count, difficulty: config.difficulty ?? 'medium' })),
      totalCount: total,
      effectiveDifficulty: config.difficulty ?? 'medium',
    };
  }

  // 2) count_per_difficulty：每个难度的总数按题型均分（最大余数法），总数不膨胀
  // 同上：用户显式传了 cpd 即便全零也早退
  if (
    config.count_per_difficulty &&
    typeof config.count_per_difficulty === 'object'
  ) {
    const diffs: Array<[CardDifficulty, number]> = [];
    (['easy', 'medium', 'hard'] as const).forEach((k) => {
      const v = config.count_per_difficulty?.[k];
      if (typeof v === 'number' && v > 0) diffs.push([k, v]);
    });
    const tasks: Array<{ type: string; count: number; difficulty: CardDifficulty }> = [];
    for (const [diff, cnt] of diffs) {
      // cnt 是该难度的总题数：均分到所有选中题型，余数给前面的题型
      const base = Math.floor(cnt / types.length);
      const remainder = cnt - base * types.length;
      types.forEach((type, idx) => {
        const c = base + (idx < remainder ? 1 : 0);
        if (c > 0) tasks.push({ type, count: c, difficulty: diff });
      });
    }
    const total = tasks.reduce((s, t) => s + t.count, 0);
    return {
      tasks,
      totalCount: total,
      effectiveDifficulty: 'mixed',
    };
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

      // 方案A：查询库内该知识点已有题题干 → 注入 anti-duplicate 约束，降低与已有题重复概率
      const { data: existingRows } = await notDeleted(supabase
        .from('study_cards')
        .select('question')
        .eq('knowledge_point_id', node_id)
        .limit(30));
      const existingQuestions = (existingRows || [])
        .map((r) => r.question)
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 0);

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
              existingQuestions,
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
              // 方案E：把 AI 返回的「原文依据」并入 explanation，让答案可追溯、防幻觉
              explanation: card.evidence
                ? [card.explanation, `原文依据：${card.evidence}`].filter(Boolean).join('\n\n')
                : card.explanation,
              card_type: card.type ?? type,
              options: card.options ? JSON.stringify(card.options) : null,
              next_review: new Date().toISOString(),
              // 方案B：入库前用 AI 自评难度做 sanity check，非法/缺失回退到任务难度
              difficulty: cardDifficultyToNumber(
                card.difficulty,
                difficulty ?? effectiveDifficulty,
              ),
              fsrs_state: "New",
              fsrs_stability: 0,
              // 方案B：FSRS 初始难度种子（易=3 / 中=5 / 难=7），复习时由 FSRS 自适应更新
              fsrs_difficulty: cardDifficultyToFsrsInitial(
                card.difficulty,
                difficulty ?? effectiveDifficulty,
              ),
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
}

registerProcessor('generate_questions', new GenerateQuestionsProcessor());
