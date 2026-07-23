import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';
import { cacheService, CacheKeys } from '../common/cacheService';

import type { AIProviderType } from '@shared/types';
import { notDeleted } from '../common/softDeleteHelper';

interface GenerateQuestionsPayload {
  knowledge_point_id: string;
  node_title: string;
  node_content?: string;
  config?: {
    types?: string[];
    count?: number;
    provider?: string;
    model?: string;
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
      const graph_id = graphNodeData?.graph_id;

      const MAX_CONTENT_LENGTH = 15000;
      const truncatedContent = node_content
        ? node_content.substring(0, MAX_CONTENT_LENGTH)
        : '';

      const types =
        config?.types && Array.isArray(config.types) && config.types.length > 0
          ? config.types
          : ['qa', 'choice'];
      const totalRequestCount = config?.count || 5;
      const provider = config?.provider || payload.provider;
      const model = config?.model || payload.model;

      let remainingCount = totalRequestCount;
      const tasksToRun: { type: string; count: number }[] = [];

      for (let i = 0; i < types.length; i++) {
        const countPerType = Math.ceil(remainingCount / (types.length - i));
        remainingCount -= countPerType;
        if (countPerType > 0) {
          tasksToRun.push({ type: types[i], count: countPerType });
        }
      }

      logger.debug(
        `Generating questions for node ${node_title}. Types: ${types.join(',')}, Total: ${totalRequestCount}`,
      );

      const CONCURRENCY = 3;
      let completedTasks = 0;

      const processType = async ({
        type,
        count,
      }: {
        type: string;
        count: number;
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
              difficulty: 1,
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
          const progress = Math.round((completedTasks / tasksToRun.length) * 100);
          await updateTaskStatus(supabase, taskId, 'in_progress', {
            progress,
            current_node: `正在生成 ${this.getTypeName(type)}...`,
          }, undefined, undefined, userId);
        }
      };

      for (let i = 0; i < tasksToRun.length; i += CONCURRENCY) {
        const chunk = tasksToRun.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((t) => processType(t)));
      }

      if (totalCount === 0 && errors.length > 0) {
        throw new Error(`Failed to generate cards: ${errors.join('; ')}`);
      }

      if (graph_id) {
        await cacheService.del(CacheKeys.STUDY_CARDS(graph_id));
      }

      logger.info(`Generate questions task ${taskId} completed: ${totalCount} cards`);
      await updateTaskStatus(supabase, taskId, 'completed', {
        count: totalCount,
        progress: 100,
        errors: errors.length > 0 ? errors : undefined,
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
}

registerProcessor('generate_questions', new GenerateQuestionsProcessor());
