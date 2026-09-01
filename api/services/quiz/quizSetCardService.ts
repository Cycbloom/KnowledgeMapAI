import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { transactionExecutor } from "../../database/transactionExecutor";
import i18next from "i18next";

/**
 * 测验集卡片关联服务：向测验集添加/批量添加/移除卡片，并维护 card_count。
 */
export class QuizSetCardService {
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
