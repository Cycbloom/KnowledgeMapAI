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
        throw new AppError("获取测验集合失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return data || [];
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error fetching quiz sets:", error);
      throw new AppError(
        err.message || "获取测验集合失败",
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
          "未找到测验集合",
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
        throw new AppError("获取测验卡片失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
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
        err.message || "获取测验集合失败",
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
        throw new AppError("创建测验集合失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error creating quiz set:", error);
      throw new AppError(
        err.message || "创建测验集合失败",
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
          "未找到测验集合",
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
        throw new AppError("更新测验集合失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error updating quiz set:", error);
      throw new AppError(
        err.message || "更新测验集合失败",
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
          "未找到测验集合",
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
            "删除测验卡片关联失败",
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
          throw new AppError("删除测验集合失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }
      }

      return { success: true, message: "测验集合已删除" };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error deleting quiz set:", error);
      throw new AppError(
        err.message || "删除测验集合失败",
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
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      await supabase
        .from("quiz_sets")
        .update({ status: "generating", updated_at: new Date().toISOString() })
        .eq("id", quizSetId);

      const task = await asyncTaskService.createTask(userId, "generate_quiz", {
        quiz_set_id: quizSetId,
        node_ids,
        config,
      });

      return {
        success: true,
        task_id: task.id,
        message: "测验生成任务已创建",
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
        err.message || "生成测验失败",
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
          "未找到测验集合",
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
          "未找到测验卡片",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const oldCard = cardLink.card as StudyCard;
      const displayOrder = cardLink.display_order;

      if (!oldCard?.knowledge_point_id) {
        throw new AppError(
          "卡片缺少知识点关联",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: graphNode } = await notDeleted(supabase
        .from("graph_nodes")
        .select("title, content")
        .eq("knowledge_point_id", oldCard.knowledge_point_id)
        )
        .single();

      if (!graphNode) {
        throw new AppError(
          "未找到关联的知识点",
          404,
          ErrorCodes.RESOURCE_NODE_NOT_FOUND,
        );
      }

      const config = quizSet.config || {};
      const types = config.types || [oldCard.card_type || "qa"];
      const difficulty = config.difficulty || "medium";
      const count = 1;

      const aiResult = await aiService.generateCards(
        graphNode.title || "",
        graphNode.content || "",
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
        throw new AppError("AI 未能生成新卡片", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      const newCardData = newCards[0] as {
        question: string;
        answer: string;
        explanation?: string;
        type?: StudyCard["card_type"];
        card_type?: StudyCard["card_type"];
        options?: string[];
      };

      const cardType =
        newCardData.type || newCardData.card_type || oldCard.card_type;

      if (transactionExecutor.isAvailable()) {
        const newCard = await transactionExecutor.executeInTransaction(
          async (client) => {
            // 1. Create new study_card
            const insertResult = await client.query(
              `INSERT INTO study_cards (user_id, knowledge_point_id, graph_id, source_graph_id, question, answer, explanation, card_type, options, next_review, difficulty, fsrs_state, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_retrievability)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 1, 'New', 0, 0, 0, 0, 0) RETURNING *`,
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
              ],
            );

            const insertedCard = insertResult.rows[0];
            if (!insertedCard) {
              throw new AppError(
                "创建新卡片失败",
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
          message: "卡片已重新生成",
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
        message: "卡片已重新生成",
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error regenerating card:", error);
      throw new AppError(
        err.message || "重新生成卡片失败",
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
          "未找到测验集合",
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
          "该卡片已在测验集合中",
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
            "添加卡片到测验集合失败",
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
        message: "卡片已添加到测验集合",
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error adding card to quiz set:", error);
      throw new AppError(
        err.message || "添加卡片到测验集合失败",
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
          "未找到测验集合",
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
            "从测验集合移除卡片失败",
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
        message: "卡片已从测验集合移除",
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error removing card from quiz set:", error);
      throw new AppError(
        err.message || "从测验集合移除卡片失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }
}

export const quizSetsService = new QuizSetsService();
