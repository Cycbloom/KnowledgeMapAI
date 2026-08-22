import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction, TaskControl, TaskAbortError } from './index';
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
import {
  getSiblingNodes,
  getDirectChildren,
} from '../graph/siblingNodesService';
import type { GenerateCardsCoverage } from '../ai/cardGenerationService';
import { deriveFocusTopicFallback } from '@shared/utils/cards';
import { buildTasksToRun as buildTasksToRunShared } from './questionTaskDispatcher';

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
  focus_topic?: unknown;
}

type AIGeneratedCardWithFocus = AIGeneratedCard & { focus_topic?: unknown };

/**
 * 任务分派：将 generateQuestions 载荷（snake_case config）归一化为共享
 * questionTaskDispatcher 的输入，沿用相同优先级（count_matrix > cards_per_type
 * > count_per_difficulty > 回退）。
 */
function buildTasksToRun(
  payload: GenerateQuestionsPayload,
): ReturnType<typeof buildTasksToRunShared> {
  const config = payload.config ?? {};
  return buildTasksToRunShared({
    types: config.types,
    count: config.count,
    cardsPerType: config.cards_per_type,
    countPerDifficulty: config.count_per_difficulty,
    countMatrix: config.count_matrix,
    difficulty: config.difficulty,
  });
}

export class GenerateQuestionsProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: GenerateQuestionsPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl
  ): Promise<void> {
    logger.info(`Starting generate questions task ${taskId} for user ${userId}`, { payload });

    try {
      const { knowledge_point_id: node_id, node_title, node_content, config } = payload;
      let totalCount = 0;
      const errors: string[] = [];

      const { tasks: tasksToRun, totalCount: totalRequestCount, effectiveDifficulty } = buildTasksToRun(payload);

      await updateTaskStatus(
        supabase,
        taskId,
        'in_progress',
        {
          stage: 'init',
          stageLabel: this.getInitLabel(tasksToRun.length, totalRequestCount, effectiveDifficulty),
          progress: 0,
          processed: 0,
          total: tasksToRun.length,
          current_node: node_title ? `准备生成「${node_title}」题目` : '准备生成题目',
        },
        undefined,
        undefined,
        userId,
      );

      const { data: graphNodeData } = await notDeleted(supabase
        .from('graph_nodes')
        .select('graph_id, knowledge_point_id')
        .eq('knowledge_point_id', node_id)
        )
        .single();
      const graph_id = payload.graph_id || graphNodeData?.graph_id;

      // 方案F：兄弟节点干扰项 —— 覆盖 with_siblings / graph 时查询当前节点的同父兄弟节点
      const coverage = (config?.coverage as GenerateCardsCoverage) ?? 'current_only';
      const needsSiblings = coverage === 'with_siblings' || coverage === 'graph';
      const needsChildren = coverage === 'with_children' || coverage === 'graph';

      let siblingNodes: Awaited<ReturnType<typeof getSiblingNodes>> = [];
      if (needsSiblings) {
        try {
          siblingNodes = await getSiblingNodes(supabase, graph_id ?? '', node_id, 8);
        } catch (sibErr: unknown) {
          logger.warn('[GenerateQuestionsProcessor] Failed to fetch sibling nodes:', sibErr);
          siblingNodes = [];
        }
      }

      let childrenNodes: Awaited<ReturnType<typeof getDirectChildren>> = [];
      if (needsChildren) {
        try {
          childrenNodes = await getDirectChildren(supabase, graph_id ?? '', node_id, 8);
        } catch (childErr: unknown) {
          logger.warn('[GenerateQuestionsProcessor] Failed to fetch children nodes:', childErr);
          childrenNodes = [];
        }
      }

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
              coverage,
              ...(needsChildren && childrenNodes.length > 0 ? { childrenNodes } : {}),
              ...(needsSiblings && siblingNodes.length > 0 ? { siblingNodes } : {}),
              maxSiblingDistractors: 3,
            },
          );
          const cards = (aiResult.cards || []) as AIGeneratedCard[];

          if (cards.length > 0) {
            const cardsToInsert = cards.map((card: AIGeneratedCardWithFocus) => {
              const rawFocus = typeof card.focus_topic === 'string' ? card.focus_topic.trim() : '';
              const value = rawFocus.length > 0
                ? rawFocus.slice(0, 200)
                : deriveFocusTopicFallback(card.question, node_title);
              return {
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
                focus_topic: value,
              };
            });

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
          const typeName = this.getTypeName(type);
          const diffName = difficulty ? `·${this.getDiffName(difficulty)}` : '';
          await updateTaskStatus(supabase, taskId, 'in_progress', {
            stage: 'generating',
            stageLabel: this.getStageLabel(completedTasks, tasksToRun.length, totalRequestCount, totalCount),
            progress,
            processed: completedTasks,
            total: tasksToRun.length,
            current_node: `正在生成 ${typeName}${diffName}...`,
          }, undefined, undefined, userId);
        }
      };

      for (let i = 0; i < tasksToRun.length; i += CONCURRENCY) {
        control.throwIfAborted();
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
      if (error instanceof TaskAbortError) {
        logger.info(`Generate questions task ${taskId} ${error.reason}`);
        await updateTaskStatus(supabase, taskId, error.reason, undefined, undefined, undefined, userId);
        return;
      }
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

  private getInitLabel(
    taskCount: number,
    totalCards: number,
    effectiveDifficulty: CardDifficulty | 'mixed',
  ): string {
    const diffLabel = effectiveDifficulty === 'mixed' ? '混合难度' : `${this.getDiffName(effectiveDifficulty)}难度`;
    if (taskCount <= 0) return `初始化${diffLabel}题目生成流程`;
    return `准备生成 ${diffLabel} · ${taskCount} 组 AI 调用（共 ${totalCards} 题）`;
  }

  private getStageLabel(
    processedTasks: number,
    totalTasks: number,
    totalCardsRequested: number,
    cardsGeneratedSoFar: number,
  ): string {
    const head = `生成阶段 ${processedTasks}/${totalTasks}`;
    const tail = `已入库 ${cardsGeneratedSoFar}/${totalCardsRequested} 题`;
    return `${head} · ${tail}`;
  }
}

registerProcessor('generate_questions', new GenerateQuestionsProcessor());
