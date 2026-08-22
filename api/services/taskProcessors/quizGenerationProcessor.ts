import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction, TaskControl, TaskAbortError } from './index';
import { aiService, type CardDifficulty } from '../ai/index';
import { cardDifficultyToNumber, cardDifficultyToFsrsInitial, type AIProviderType } from '@shared/types';
import { buildTasksToRun, allocateTasksByCount } from './questionTaskDispatcher';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { notDeleted } from '../common/softDeleteHelper';
import { deriveFocusTopicFallback } from '@shared/utils/cards';

interface QuizGenerationTaskConfig {
  cardTypes: string[];
  difficulty: CardDifficulty | 'mixed';
  cardsPerType?: Record<string, number>;
  countPerDifficulty?: { easy?: number; medium?: number; hard?: number };
  countMatrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
  /** 总数配额制：{ knowledge_point_id: 需要生成的题数 }，存在时按每个知识点的缺口生成 */
  perNodeCounts?: Record<string, number>;
  customPrompt?: string;
  provider?: string;
  model?: string;
}

interface QuizGenerationTaskPayload {
  quizSetId: string;
  userId: string;
  knowledgePointIds: string[];
  config: QuizGenerationTaskConfig;
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

interface GeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
  focus_topic?: unknown;
  difficulty?: string;
}

type AIGeneratedCardWithFocus = GeneratedCard & { focus_topic?: unknown };

interface InsertedCard {
  id: string;
}

export class QuizGenerationProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: QuizGenerationTaskPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl
  ): Promise<void> {
    logger.info(`Starting quiz generation task ${taskId} for user ${userId}`, { payload });
    
    try {
      await updateTaskStatus(supabase, taskId, 'in_progress', { stage: 'initializing', percent: 0 }, undefined, undefined, userId);

      const { quizSetId, knowledgePointIds, config } = payload;
      const { cardTypes = ['qa', 'choice'], difficulty = 'medium', cardsPerType, countPerDifficulty, countMatrix, perNodeCounts, customPrompt, provider, model } = config || {};

      const { data: quizSet, error: quizSetError } = await supabase
        .from('quiz_sets')
        .select('id, title, graph_id, config')
        .eq('id', quizSetId)
        .eq('user_id', userId)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError('Quiz set not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // 复用已有题目时，quiz_set_cards 可能已存在关联记录：
      // 新生成的卡片需接在已有 display_order 之后，card_count 也要累加
      const { data: existingCardRows } = await supabase
        .from('quiz_set_cards')
        .select('display_order')
        .eq('quiz_set_id', quizSetId);
      const existingCards = existingCardRows || [];
      const existingCount = existingCards.length;
      const maxDisplayOrder = existingCards.reduce(
        (max, c) => Math.max(max, Number(c.display_order) || 0),
        0,
      );

      await supabase
        .from('quiz_sets')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', quizSetId);

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
        .in('knowledge_point_id', knowledgePointIds)
        );

      if (gnError || !graphNodes || graphNodes.length === 0) {
        throw new AppError('Failed to fetch knowledge points', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      const nodes = graphNodes.map((gn: GraphNodeWithKnowledgePoint) => {
        const kp = gn.knowledge_points?.[0];
        return {
          id: kp?.id || gn.knowledge_point_id,
          graph_id: gn.graph_id,
          graph_node_id: gn.id,
          title: kp?.title || '',
          content: kp?.content || '',
          level: gn.level,
        };
      });

      const { data: edges } = await supabase
        .from('edges')
        .select('source_knowledge_point_id, target_knowledge_point_id')
        .in('target_knowledge_point_id', knowledgePointIds);

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
      const allGeneratedCards: InsertedCard[] = [];

      for (const node of sortedNodes) {
        control.throwIfAborted();
        const parentId = parentMap.get(node.id);
        const parentNode = parentId ? parentNodesMap.get(parentId) : null;
        let context = parentNode ? `Parent Node: "${parentNode.title}"` : 'Root Node';
        
        if (customPrompt) {
          context = `${context}\n\nCustom Instructions: ${customPrompt}`;
        }

        // 按题型×难度矩阵（或 cardsPerType / countPerDifficulty）分派生成任务，
        // 每个非零格子 = 一次独立 AI 调用，精确落地用户配置（批量生成）
        const dispatch = buildTasksToRun({
          types: cardTypes,
          count: 3,
          cardsPerType,
          countPerDifficulty,
          countMatrix,
          difficulty,
        });

        // 总数配额制：若配置了 perNodeCounts，按每个知识点的缺口数量生成，
        // matrix/cardsPerType 仅作为题型×难度构成权重（缺口不足的部分自动折算）
        let nodeTasks = dispatch.tasks;
        if (perNodeCounts) {
          const nodeCount = perNodeCounts[node.id];
          if (nodeCount === undefined || nodeCount <= 0) {
            continue;
          }
          nodeTasks = allocateTasksByCount(dispatch.tasks, nodeCount, cardTypes, difficulty);
        }

        let nodeCards = 0;
        let nodeFailed = false;
        let nodeError: string | undefined;

        for (const task of nodeTasks) {
          control.throwIfAborted();
          const taskDifficulty = task.difficulty ?? dispatch.effectiveDifficulty;
          try {
            const aiResult = await aiService.generateCards(node.title, node.content, {
              context,
              type: task.type,
              count: task.count,
              difficulty: taskDifficulty,
              provider: provider as AIProviderType | undefined,
              model,
              userId,
              graphId: quizSet.graph_id,
              customPrompt,
            });

            const cards = (aiResult.cards || []) as GeneratedCard[];

            if (cards.length > 0) {
              const cardsToInsert = cards.map((card: AIGeneratedCardWithFocus) => {
                const rawFocus = typeof card.focus_topic === 'string' ? card.focus_topic.trim() : '';
                const value = rawFocus.length > 0
                  ? rawFocus.slice(0, 200)
                  : deriveFocusTopicFallback(card.question, node.title);
                return {
                  user_id: userId,
                  knowledge_point_id: node.id,
                  graph_id: node.graph_id,
                  question: card.question,
                  answer: card.answer,
                  explanation: card.explanation,
                  card_type: card.type ?? task.type ?? 'qa',
                  options: card.options ? JSON.stringify(card.options) : null,
                  next_review: new Date().toISOString(),
                  difficulty: cardDifficultyToNumber(card.difficulty, taskDifficulty),
                  fsrs_state: "New",
                  fsrs_stability: 0,
                  fsrs_difficulty: cardDifficultyToFsrsInitial(card.difficulty, taskDifficulty),
                  fsrs_elapsed_days: 0,
                  fsrs_scheduled_days: 0,
                  fsrs_retrievability: 0,
                  focus_topic: value,
                };
              });

              const { data: insertedCards, error: insertError } = await supabase
                .from('study_cards')
                .insert(cardsToInsert)
                .select('id');

              if (insertError) {
                logger.error(`Failed to insert cards for node ${node.id} type ${task.type}`, insertError);
                nodeFailed = true;
                nodeError = insertError.message;
              } else {
                nodeCards += cards.length;
                totalCards += cards.length;
                allGeneratedCards.push(...(insertedCards || []));
              }
            }
          } catch (err: unknown) {
            logger.error(`Error generating ${task.type} for node ${node.id}:`, err);
            nodeFailed = true;
            nodeError = err instanceof Error ? err.message : String(err);
          }
        }

        results.push(
          nodeFailed
            ? { node_id: node.id, title: node.title, error: nodeError, status: 'failed' }
            : { node_id: node.id, title: node.title, cards: nodeCards, status: 'success' },
        );

        processedCount++;
        await updateTaskStatus(supabase, taskId, 'in_progress', {
          stage: 'generating',
          percent: Math.round((processedCount / sortedNodes.length) * 100),
          current: node.title,
          completed: processedCount,
          total: sortedNodes.length
        }, undefined, undefined, userId);
      }

      if (allGeneratedCards.length > 0) {
        const quizSetCardsToInsert = allGeneratedCards.map((card: InsertedCard, index: number) => ({
          quiz_set_id: quizSetId,
          card_id: card.id,
          display_order: maxDisplayOrder + index + 1
        }));

        const { error: linkError } = await supabase
          .from('quiz_set_cards')
          .insert(quizSetCardsToInsert);

        if (linkError) {
          logger.error('Failed to link cards to quiz set:', linkError);
        }
      }

      await supabase
        .from('quiz_sets')
        .update({
          status: 'ready',
          card_count: existingCount + totalCards,
          updated_at: new Date().toISOString()
        })
        .eq('id', quizSetId);

      logger.info(`Quiz generation completed: ${totalCards} cards for quiz set ${quizSetId}`);
      await updateTaskStatus(supabase, taskId, 'completed', {
        success: true,
        totalCards,
        quizSetId,
        details: results
      }, undefined, undefined, userId);

    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Quiz generation task ${taskId} ${error.reason}`);
        try {
          const { quizSetId } = payload;
          await supabase
            .from('quiz_sets')
            .update({ status: 'draft', updated_at: new Date().toISOString() })
            .eq('id', quizSetId);
        } catch (updateError) {
          logger.error('Failed to update quiz set status:', updateError);
        }
        await updateTaskStatus(supabase, taskId, error.reason, undefined, undefined, undefined, userId);
        return;
      }
      logger.error(`Quiz generation task ${taskId} failed:`, error);

      try {
        const { quizSetId } = payload;
        await supabase
          .from('quiz_sets')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', quizSetId);
      } catch (updateError) {
        logger.error('Failed to update quiz set status:', updateError);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, errorMessage, userId);
    }
  }
}

registerProcessor('generate_quiz', new QuizGenerationProcessor());
