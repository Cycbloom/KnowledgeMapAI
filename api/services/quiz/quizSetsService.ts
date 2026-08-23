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
import i18next from "i18next";

interface EmbeddedKnowledgePoint {
  id: string;
  title: string;
  content: string | null;
}

interface GraphNodeWithKnowledgePoint {
  knowledge_point_id: string;
  knowledge_points: EmbeddedKnowledgePoint | EmbeddedKnowledgePoint[] | null;
}

interface CreateQuizSetData {
  title: string;
  description?: string;
  config?: Record<string, unknown>;
  graph_id?: string;
}

interface UpdateQuizSetData {
  title?: string;
  description?: string;
  config?: Record<string, unknown>;
}

interface GenerateCardsOptions {
  quiz_set_id: string;
  node_ids?: string[];
  config?: Record<string, unknown>;
}

class QuizSetsService {
  async list(
    supabase: SupabaseClient,
    userId: string,
    graphId?: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      let query = supabase
        .from("quiz_sets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (graphId) {
        query = query.eq("graph_id", graphId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error("Error fetching quiz sets:", error);
        throw new AppError(i18next.t("quiz.api.errors.fetchSetsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return data || [];
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error fetching quiz sets:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.fetchSetsFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async get(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
  ): Promise<Record<string, unknown>> {
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

      const { data: quizSetCards, error: cardsError } = await supabase
        .from("quiz_set_cards")
        .select(
          `
          display_order,
          card:study_cards (
            id,
            question,
            answer,
            explanation,
            card_type,
            options,
            difficulty,
            knowledge_point_id,
            last_reviewed,
            next_review,
            review_count
          )
        `,
        )
        .eq("quiz_set_id", quizSetId)
        .order("display_order", { ascending: true });

      if (cardsError) {
        logger.error("Error fetching quiz set cards:", cardsError);
        throw new AppError(i18next.t("quiz.api.errors.fetchCardsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      const cards = (quizSetCards || []).map((qsc: Record<string, unknown>) => {
        const card = Array.isArray(qsc.card) ? qsc.card[0] : qsc.card;
        return {
          ...card,
          display_order: qsc.display_order,
        };
      });

      return {
        ...quizSet,
        cards,
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error fetching quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.fetchSetsFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    data: CreateQuizSetData,
  ): Promise<Record<string, unknown>> {
    const { title, description, config, graph_id } = data;

    try {
      const { data: result, error } = await supabase
        .from("quiz_sets")
        .insert({
          user_id: userId,
          title,
          description,
          config: config || {},
          graph_id,
          status: "draft",
          card_count: 0,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating quiz set:", error);
        throw new AppError(i18next.t("quiz.api.errors.createSetFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error creating quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.createSetFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async update(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    data: UpdateQuizSetData,
  ): Promise<Record<string, unknown>> {
    const { title, description, config } = data;

    try {
      const { data: existing, error: fetchError } = await supabase
        .from("quiz_sets")
        .select("id")
        .eq("id", quizSetId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !existing) {
        throw new AppError(
          i18next.t("quiz.api.errors.quizSetNotFound"),
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (config !== undefined) updateData.config = config;

      const { data: result, error } = await supabase
        .from("quiz_sets")
        .update(updateData)
        .eq("id", quizSetId)
        .select()
        .single();

      if (error) {
        logger.error("Error updating quiz set:", error);
        throw new AppError(i18next.t("quiz.api.errors.updateSetFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error updating quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.updateSetFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async delete(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("quiz_sets")
        .select("id")
        .eq("id", quizSetId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !existing) {
        throw new AppError(
          i18next.t("quiz.api.errors.quizSetNotFound"),
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      if (transactionExecutor.isAvailable()) {
        await transactionExecutor.executeInTransaction(async (client) => {
          await client.query(
            `DELETE FROM quiz_set_cards WHERE quiz_set_id = $1`,
            [quizSetId],
          );
          await client.query(`DELETE FROM quiz_sets WHERE id = $1`, [
            quizSetId,
          ]);
        });
      } else {
        logger.warn(
          "transactionExecutor not available, falling back to non-transactional processing for delete",
        );

        const { error: deleteCardsError } = await supabase
          .from("quiz_set_cards")
          .delete()
          .eq("quiz_set_id", quizSetId);

        if (deleteCardsError) {
          logger.error("Error deleting quiz set cards:", deleteCardsError);
          throw new AppError(
            i18next.t("quiz.api.errors.deleteCardAssociationFailed"),
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }

        const { error } = await supabase
          .from("quiz_sets")
          .delete()
          .eq("id", quizSetId);

        if (error) {
          logger.error("Error deleting quiz set:", error);
          throw new AppError(i18next.t("quiz.api.errors.deleteSetFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }
      }

      return { success: true, message: i18next.t("quiz.api.messages.setDeleted") };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error deleting quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.deleteSetFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

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
      };

      const cardType =
        newCardData.type || newCardData.card_type || oldCard.card_type;

      // AI 自评难度转数值落库（1=易 / 2=中 / 3=难），缺失时回退卷面配置难度，
      // 避免重新生成的卡片难度被硬编码为 1（简单）导致“越生成越简单”。
      const cardDifficultyNumber = cardDifficultyToNumber(
        newCardData.difficulty,
        difficulty,
      );

      if (transactionExecutor.isAvailable()) {
        const newCard = await transactionExecutor.executeInTransaction(
          async (client) => {
            // 1. Create new study_card
            const insertResult = await client.query(
              `INSERT INTO study_cards (user_id, knowledge_point_id, graph_id, source_graph_id, question, answer, explanation, card_type, options, next_review, difficulty, fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_retrievability)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, 'New', 0, 0, 0, 0, 0) RETURNING *`,
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

  async addCard(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> {
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

      const { data: existingLink } = await supabase
        .from("quiz_set_cards")
        .select("id")
        .eq("quiz_set_id", quizSetId)
        .eq("card_id", cardId)
        .single();

      if (existingLink) {
        throw new AppError(
          i18next.t("quiz.api.errors.cardAlreadyInSet"),
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: maxOrder } = await supabase
        .from("quiz_set_cards")
        .select("display_order")
        .eq("quiz_set_id", quizSetId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const displayOrder = (maxOrder?.display_order || 0) + 1;

      if (transactionExecutor.isAvailable()) {
        await transactionExecutor.executeInTransaction(async (client) => {
          await client.query(
            `INSERT INTO quiz_set_cards (quiz_set_id, card_id, display_order) VALUES ($1, $2, $3)`,
            [quizSetId, cardId, displayOrder],
          );
          await client.query(
            `UPDATE quiz_sets SET card_count = card_count + 1, updated_at = NOW() WHERE id = $1`,
            [quizSetId],
          );
        });
      } else {
        logger.warn(
          "transactionExecutor not available, falling back to non-transactional processing for addCard",
        );

        const { error: insertError } = await supabase
          .from("quiz_set_cards")
          .insert({
            quiz_set_id: quizSetId,
            card_id: cardId,
            display_order: displayOrder,
          });

        if (insertError) {
          logger.error("Error adding card to quiz set:", insertError);
          throw new AppError(
            i18next.t("quiz.api.errors.addCardFailed"),
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }

        await supabase
          .from("quiz_sets")
          .update({
            card_count: (quizSet.card_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quizSetId);
      }

      return {
        success: true,
        message: i18next.t("quiz.api.messages.cardAdded"),
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error adding card to quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.addCardFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async addCardsBatch(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardIds: string[],
  ): Promise<{ success: boolean; added: number; skipped: number; message: string }> {
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

      const uniqueIds = [...new Set(cardIds)].filter(Boolean);
      if (uniqueIds.length === 0) {
        return {
          success: true,
          added: 0,
          skipped: 0,
          message: i18next.t("quiz.api.messages.cardsAdded"),
        };
      }

      // 已关联的卡片跳过（同一张卡片可复用到多个测验集合，但一个集合内不重复）
      const { data: existingLinks } = await supabase
        .from("quiz_set_cards")
        .select("card_id")
        .eq("quiz_set_id", quizSetId)
        .in("card_id", uniqueIds);

      const existingIdSet = new Set((existingLinks || []).map((l) => l.card_id));
      const candidateIds = uniqueIds.filter((id) => !existingIdSet.has(id));

      if (candidateIds.length === 0) {
        return {
          success: true,
          added: 0,
          skipped: uniqueIds.length,
          message: i18next.t("quiz.api.messages.cardsAdded"),
        };
      }

      // 校验卡片归属当前用户
      const { data: ownedCards } = await supabase
        .from("study_cards")
        .select("id")
        .eq("user_id", userId)
        .in("id", candidateIds);

      const ownedIdSet = new Set((ownedCards || []).map((c) => c.id));
      const validIds = candidateIds.filter((id) => ownedIdSet.has(id));
      const skippedCount = uniqueIds.length - validIds.length;

      if (validIds.length === 0) {
        return {
          success: true,
          added: 0,
          skipped: uniqueIds.length,
          message: i18next.t("quiz.api.messages.cardsAdded"),
        };
      }

      const { data: maxOrder } = await supabase
        .from("quiz_set_cards")
        .select("display_order")
        .eq("quiz_set_id", quizSetId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const startOrder = (maxOrder?.display_order || 0) + 1;

      if (transactionExecutor.isAvailable()) {
        await transactionExecutor.executeInTransaction(async (client) => {
          const rows = validIds.map((cardId, index) => [
            quizSetId,
            cardId,
            startOrder + index,
          ]);
          const placeholders = rows
            .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
            .join(", ");
          const params = rows.flat();
          await client.query(
            `INSERT INTO quiz_set_cards (quiz_set_id, card_id, display_order) VALUES ${placeholders}`,
            params,
          );
          await client.query(
            `UPDATE quiz_sets SET card_count = card_count + $1, updated_at = NOW() WHERE id = $2`,
            [validIds.length, quizSetId],
          );
        });
      } else {
        logger.warn(
          "transactionExecutor not available, falling back to non-transactional processing for addCardsBatch",
        );

        const insertRows = validIds.map((cardId, index) => ({
          quiz_set_id: quizSetId,
          card_id: cardId,
          display_order: startOrder + index,
        }));

        const { error: insertError } = await supabase
          .from("quiz_set_cards")
          .insert(insertRows);

        if (insertError) {
          logger.error("Error adding cards batch to quiz set:", insertError);
          throw new AppError(
            i18next.t("quiz.api.errors.addCardFailed"),
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }

        await supabase
          .from("quiz_sets")
          .update({
            card_count: (quizSet.card_count || 0) + validIds.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quizSetId);
      }

      return {
        success: true,
        added: validIds.length,
        skipped: skippedCount,
        message: i18next.t("quiz.api.messages.cardsAdded"),
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error adding cards batch to quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.addCardFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async removeCard(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> {
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

      if (transactionExecutor.isAvailable()) {
        await transactionExecutor.executeInTransaction(async (client) => {
          await client.query(
            `DELETE FROM quiz_set_cards WHERE quiz_set_id = $1 AND card_id = $2`,
            [quizSetId, cardId],
          );
          await client.query(
            `UPDATE quiz_sets SET card_count = GREATEST(card_count - 1, 0), updated_at = NOW() WHERE id = $1`,
            [quizSetId],
          );
        });
      } else {
        logger.warn(
          "transactionExecutor not available, falling back to non-transactional processing for removeCard",
        );

        const { error: deleteError } = await supabase
          .from("quiz_set_cards")
          .delete()
          .eq("quiz_set_id", quizSetId)
          .eq("card_id", cardId);

        if (deleteError) {
          logger.error("Error removing card from quiz set:", deleteError);
          throw new AppError(
            i18next.t("quiz.api.errors.removeCardFailed"),
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }

        await supabase
          .from("quiz_sets")
          .update({
            card_count: Math.max(0, (quizSet.card_count || 1) - 1),
            updated_at: new Date().toISOString(),
          })
          .eq("id", quizSetId);
      }

      return {
        success: true,
        message: i18next.t("quiz.api.messages.cardRemoved"),
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error removing card from quiz set:", error);
      throw new AppError(
        err.message || i18next.t("quiz.api.errors.removeCardFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }
}

export const quizSetsService = new QuizSetsService();
