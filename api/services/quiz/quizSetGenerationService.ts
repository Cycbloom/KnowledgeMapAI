import { SupabaseClient } from "@supabase/supabase-js";
import { asyncTaskService } from "../asyncTaskService";
import { studyService } from "../study/studyService";
import { aiService } from "../ai/aiService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { StudyCard } from "../../../shared/types/common";
import { transactionExecutor } from "../../database/transactionExecutor";
import { notDeleted } from '../common/softDeleteHelper';
import { getKnowledgePoint } from '../../utils/nodeHelpers';
import { cardDifficultyToNumber } from '../../../shared/types/quiz';
import { deriveFocusTopicFallback } from '../../../shared/utils/cards';
import i18next from "i18next";
import type {
  GraphNodeWithKnowledgePoint,
  GenerateCardsOptions,
} from "./quizSetShared";

/**
 * 测验集生成服务：批量生成后台任务编排与单卡 AI 重生成。
 */
export class QuizSetGenerationService {
  async generateCards(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    options: Omit<GenerateCardsOptions, "quiz_set_id">,
  ): Promise<{ success: boolean; task_id: string; message: string }> {
    const { node_ids, config } = options;

    try {
      const { data: quizSet, error: quizSetError } = await supabase
        .from("quiz_sets")
        .select("*")
        .eq("id", quizSetId)
        .eq("user_id", userId)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          i18next.t("quiz.api.errors.quizSetNotFound"),
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      await supabase
        .from("quiz_sets")
        .update({ status: "generating", updated_at: new Date().toISOString() })
        .eq("id", quizSetId);

      const task = await asyncTaskService.createTask(userId, "generate_quiz", {
        quizSetId,
        knowledgePointIds: node_ids,
        config,
      });

      return {
        success: true,
        task_id: task.id,
        message: i18next.t("quiz.api.messages.generationTaskCreated"),
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error generating quiz:", error);

      try {
        await supabase
          .from("quiz_sets")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("id", quizSetId);
      } catch (resetError) {
        logger.error("Failed to reset quiz set status:", resetError);
      }

      throw new AppError(
        err.message || i18next.t("quiz.api.errors.generateQuizFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async regenerateCard(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; card: Record<string, unknown>; message: string }> {
    try {
      const { data: quizSet, error: quizSetError } = await supabase
        .from("quiz_sets")
        .select("*")
        .eq("id", quizSetId)
        .eq("user_id", userId)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          i18next.t("quiz.api.errors.quizSetNotFound"),
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const { data: cardLink, error: cardLinkError } = await supabase
        .from("quiz_set_cards")
        .select("*, card:study_cards(*)")
        .eq("quiz_set_id", quizSetId)
        .eq("card_id", cardId)
        .single();

      if (cardLinkError || !cardLink) {
        throw new AppError(
          i18next.t("quiz.api.errors.cardNotFound"),
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const oldCard = cardLink.card as StudyCard;
      const displayOrder = cardLink.display_order;

      if (!oldCard?.knowledge_point_id) {
        throw new AppError(
          i18next.t("quiz.api.errors.cardMissingKnowledgePoint"),
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      // graph_nodes 表没有 title/content 列，需 embed knowledge_points 获取；
      // 同一知识点可能存在于多个图谱的 graph_nodes 中，取任一行即可（title/content 来自知识点本身）
      const { data: graphNodeRows } = await notDeleted(supabase
        .from("graph_nodes")
        .select(`
          knowledge_point_id,
          knowledge_points (
            id,
            title,
            content
          )
        `)
        .eq("knowledge_point_id", oldCard.knowledge_point_id)
        )
        .limit(1);

      const graphNode = (graphNodeRows as GraphNodeWithKnowledgePoint[] | null)?.[0];

      if (!graphNode) {
        throw new AppError(
          i18next.t("quiz.api.errors.knowledgePointNotFound"),
          404,
          ErrorCodes.RESOURCE_NODE_NOT_FOUND,
        );
      }

      // PostgREST 对多对一 embed 可能返回对象或数组，用共享 helper 归一化，
      // 否则 title/content 会静默丢失，导致 AI 收不到主题生成通用题目
      const kp = getKnowledgePoint(graphNode.knowledge_points ?? null);

      const config = quizSet.config || {};
      // 前端存储键为 cardTypes；向后兼容历史数据里的 types 键
      const types =
        config.types ||
        config.cardTypes ||
        [oldCard.card_type || "qa"];
      const difficulty = config.difficulty || "medium";
      const count = 1;

      const aiResult = await aiService.generateCards(
        kp?.title || "",
        kp?.content || "",
        {
          count,
          types,
          difficulty,
          provider: config.provider,
          model: config.model,
          userId,
          graphId: quizSet.graph_id,
        },
      );

      const newCards = aiResult.cards || [];
      if (newCards.length === 0) {
        throw new AppError(i18next.t("quiz.api.errors.aiGenerateFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      const newCardData = newCards[0] as {
        question: string;
        answer: string;
        explanation?: string;
        type?: StudyCard["card_type"];
        card_type?: StudyCard["card_type"];
        options?: string[];
        difficulty?: string;
        focus_topic?: unknown;
      };

      const cardType =
        newCardData.type || newCardData.card_type || oldCard.card_type;

      // AI 自评难度转数值落库（1=易 / 2=中 / 3=难），缺失时回退卷面配置难度，
      // 避免重新生成的卡片难度被硬编码为 1（简单）导致“越生成越简单”。
      const cardDifficultyNumber = cardDifficultyToNumber(
        newCardData.difficulty,
        difficulty,
      );

      // “考察点”focus_topic：优先取 AI 返回的细粒度考察点，缺失时回退题干/知识点标题，
      // 与批量生成路径保持一致，避免重新生成后考察点字段为空。
      const rawFocus =
        typeof newCardData.focus_topic === "string"
          ? newCardData.focus_topic.trim()
          : "";
      const focusTopic =
        rawFocus.length > 0
          ? rawFocus.slice(0, 200)
          : deriveFocusTopicFallback(newCardData.question, kp?.title);

      if (transactionExecutor.isAvailable()) {
        const newCard = await transactionExecutor.executeInTransaction(
          async (client) => {
            // 1. Create new study_card
            const insertResult = await client.query(
              `INSERT INTO study_cards (user_id, knowledge_point_id, graph_id, source_graph_id, question, answer, explanation, card_type, options, next_review, difficulty, fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_retrievability, focus_topic)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, 'New', 0, 0, 0, 0, 0, $11) RETURNING *`,
              [
                userId,
                oldCard.knowledge_point_id,
                quizSet.graph_id,
                quizSet.graph_id,
                newCardData.question,
                newCardData.answer,
                newCardData.explanation || null,
                cardType || "qa",
                newCardData.options ? JSON.stringify(newCardData.options) : null,
                cardDifficultyNumber,
                focusTopic,
              ],
            );

            const insertedCard = insertResult.rows[0];
            if (!insertedCard) {
              throw new AppError(
                i18next.t("quiz.api.errors.createCardFailed"),
                500,
                ErrorCodes.SYSTEM_INTERNAL_ERROR,
              );
            }

            // 2. Delete old quiz_set_card association
            await client.query(
              `DELETE FROM quiz_set_cards WHERE card_id = $1`,
              [cardId],
            );

            // 3. Delete old study_card
            await client.query(`DELETE FROM study_cards WHERE id = $1`, [
              cardId,
            ]);

            // 4. Insert new quiz_set_card association
            await client.query(
              `INSERT INTO quiz_set_cards (quiz_set_id, card_id, display_order) VALUES ($1, $2, $3)`,
              [quizSetId, insertedCard.id, displayOrder],
            );

            return insertedCard;
          },
        );

        return {
          success: true,
          card: newCard as unknown as Record<string, unknown>,
          message: i18next.t("quiz.api.messages.cardRegenerated"),
        };
      }

      logger.warn(
        "transactionExecutor not available, falling back to non-transactional processing for regenerateCard",
      );

      // Fallback: non-transactional path (original logic)
      const newCard = await studyService.createCard(supabase, {
        userId,
        knowledgePointId: oldCard.knowledge_point_id,
        sourceGraphId: quizSet.graph_id,
        question: newCardData.question,
        answer: newCardData.answer,
        explanation: newCardData.explanation,
        cardType,
        options: newCardData.options,
        difficulty: cardDifficultyNumber,
        focusTopic,
      });

      await supabase.from("quiz_set_cards").delete().eq("card_id", cardId);

      await studyService.deleteCard(supabase, cardId);

      await supabase.from("quiz_set_cards").insert({
        quiz_set_id: quizSetId,
        card_id: newCard.id,
        display_order: displayOrder,
      });

      return {
        success: true,
        card: newCard as unknown as Record<string, unknown>,
        message: i18next.t("quiz.api.messages.cardRegenerated"),
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error regenerating card:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.regenerateCardFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }
}
