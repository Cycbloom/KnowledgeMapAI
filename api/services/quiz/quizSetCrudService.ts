import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { transactionExecutor } from "../../database/transactionExecutor";
import i18next from "i18next";
import type {
  CreateQuizSetData,
  UpdateQuizSetData,
} from "./quizSetShared";

/**
 * 测验集 CRUD 服务：列表、详情、创建、更新、删除。
 */
export class QuizSetCrudService {
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
}
