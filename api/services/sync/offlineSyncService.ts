import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export interface OfflineSyncOperation {
  clientOpId: string;
  table: string;
  action: "create" | "update";
  recordId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface OfflineSyncResult {
  clientOpId: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/** study_cards 离线复习可回传的白名单字段（仅 FSRS 进度，不覆盖题目内容） */
const FSRS_UPDATE_FIELDS = [
  "last_reviewed",
  "next_review",
  "review_count",
  "fsrs_state",
  "fsrs_stability",
  "fsrs_difficulty",
  "fsrs_elapsed_days",
  "fsrs_scheduled_days",
  "fsrs_retrievability",
  "fsrs_last_review",
  "last_rating",
];

const DEVICE_ID = "offline-mobile";

export class OfflineSyncService {
  /**
   * 应用一批离线操作（学习进度/答题记录回传）。
   * 幂等：以 client_op_id 记录到 sync_operations 表，重复提交自动跳过。
   */
  async applyOfflineOps(
    supabase: SupabaseClient,
    userId: string,
    operations: OfflineSyncOperation[],
  ): Promise<OfflineSyncResult[]> {
    if (!Array.isArray(operations)) {
      throw new AppError(
        "Invalid request: operations array is required",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const results: OfflineSyncResult[] = [];
    for (const op of operations) {
      try {
        if (await this.isAlreadyApplied(supabase, userId, op.clientOpId)) {
          results.push({ clientOpId: op.clientOpId, success: true, skipped: true });
          continue;
        }

        if (op.table === "study_cards" && op.action === "update") {
          await this.applyStudyCardUpdate(supabase, userId, op);
        } else if (op.table === "quiz_sessions" && op.action === "create") {
          await this.applyQuizSessionCreate(supabase, userId, op);
        } else {
          results.push({
            clientOpId: op.clientOpId,
            success: false,
            error: `Unsupported operation: ${op.table}/${op.action}`,
          });
          continue;
        }

        await this.recordApplied(supabase, userId, op);
        results.push({ clientOpId: op.clientOpId, success: true });
      } catch (error) {
        logger.warn("Offline sync op failed", {
          clientOpId: op.clientOpId,
          message: error instanceof Error ? error.message : String(error),
        });
        results.push({
          clientOpId: op.clientOpId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }

  private async isAlreadyApplied(
    supabase: SupabaseClient,
    userId: string,
    clientOpId: string,
  ): Promise<boolean> {
    const { data } = await supabase
      .from("sync_operations")
      .select("id")
      .eq("client_op_id", clientOpId)
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  }

  private async recordApplied(
    supabase: SupabaseClient,
    userId: string,
    op: OfflineSyncOperation,
  ): Promise<void> {
    const { error } = await supabase.from("sync_operations").insert({
      client_op_id: op.clientOpId,
      user_id: userId,
      table_name: op.table,
      record_id: op.recordId,
      action: op.action,
      device_id: DEVICE_ID,
      applied_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  private async applyStudyCardUpdate(
    supabase: SupabaseClient,
    userId: string,
    op: OfflineSyncOperation,
  ): Promise<void> {
    const { data: card, error: fetchError } = await supabase
      .from("study_cards")
      .select("user_id, last_reviewed")
      .eq("id", op.recordId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!card || card.user_id !== userId) {
      throw new AppError(
        "Access denied",
        403,
        ErrorCodes.RESOURCE_CARD_NOT_FOUND,
      );
    }

    // 回滚守卫：仅当本次复习时间不早于服务器已记录的复习时间才应用
    const opReviewed = op.data.last_reviewed as string | undefined;
    if (
      opReviewed &&
      card.last_reviewed &&
      new Date(opReviewed).getTime() < new Date(card.last_reviewed).getTime()
    ) {
      throw new Error("Stale review update, skipping");
    }

    const update: Record<string, unknown> = {};
    for (const field of FSRS_UPDATE_FIELDS) {
      if (op.data[field] !== undefined) {
        update[field] = op.data[field];
      }
    }
    if (Object.keys(update).length === 0) return;

    const { error } = await supabase
      .from("study_cards")
      .update(update)
      .eq("id", op.recordId);
    if (error) throw error;
  }

  private async applyQuizSessionCreate(
    supabase: SupabaseClient,
    userId: string,
    op: OfflineSyncOperation,
  ): Promise<void> {
    const data = op.data;
    const rawResults = Array.isArray(data.results)
      ? (data.results as Array<{
          card_id: string;
          correct: boolean;
          user_answer?: string;
          time_spent?: number;
        }>)
      : [];

    // 校验答题卡归属：确保 results 中的卡片都属于该用户
    if (rawResults.length > 0) {
      const cardIds = Array.from(
        new Set(rawResults.map((r) => r.card_id).filter(Boolean)),
      );
      if (cardIds.length > 0) {
        const { data: ownedCards, error: cardError } = await supabase
          .from("study_cards")
          .select("id")
          .in("id", cardIds)
          .eq("user_id", userId);
        if (cardError) throw cardError;
        if (!ownedCards || ownedCards.length !== cardIds.length) {
          throw new AppError(
            "Some cards do not belong to this user",
            403,
            ErrorCodes.RESOURCE_CARD_NOT_FOUND,
          );
        }
      }
    }

    const timestamp = op.timestamp || new Date().toISOString();
    const toFiniteNumber = (value: unknown): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    const { data: session, error: sessionError } = await supabase
      .from("learning_sessions")
      .insert({
        session_type: "quiz",
        quiz_set_id: (data.quiz_set_id as string | null) ?? null,
        user_id: userId,
        card_ids: rawResults.map((r) => r.card_id),
        started_at: timestamp,
        completed_at: timestamp,
        status: "completed",
        score: toFiniteNumber(data.score),
        correct_count: toFiniteNumber(data.correct_count),
        total_count: toFiniteNumber(data.total_count),
        total_time_spent: rawResults.reduce(
          (sum, r) => sum + (r.time_spent ?? 0),
          0,
        ),
      })
      .select("id")
      .single();
    if (sessionError) throw sessionError;

    if (rawResults.length > 0 && session) {
      const rows = rawResults.map((r) => ({
        session_id: session.id,
        card_id: r.card_id,
        correct: !!r.correct,
        user_answer: r.user_answer ?? null,
        time_spent: r.time_spent ?? null,
      }));
      const { error: resultsError } = await supabase
        .from("learning_session_results")
        .insert(rows);
      if (resultsError) throw resultsError;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
