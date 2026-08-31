/** @schedule decision - 单知识点学习流程统一编排（S1） */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type {
  LearningState,
  StateHistoryEntry,
} from "../../../shared/types/scheduler";
import { subtaskStateMachine } from "./subtaskStateMachine";
import { subtaskKnowledgeSyncService } from "./subtaskKnowledgeSync";
import { subtaskQuizIntegrationService } from "./subtaskQuizIntegration";
import { reviewTaskService } from "./reviewTaskService";
import { masteryCalculationService } from "../study/masteryCalculationService";
import { notDeleted } from "../common/softDeleteHelper";
import type { CreateReviewTaskData } from "../../../shared/types/reviewTask";

export type NextActivityType = "practice" | "quiz" | "review";

export interface NextActivity {
  type: NextActivityType;
  reason: string;
  availableCards: number;
}

export interface CompleteLearningInput {
  knowledgePointId: string;
  userId: string;
  graphId?: string;
  taskId?: string;
  /** @schedule decision - 材料阅读耗时（秒），用于计时结算（S4） */
  materialDurationSeconds?: number;
}

export interface CompleteLearningResult {
  subtaskId?: string;
  nextState: LearningState;
  mastery: number;
  nextActivity: NextActivity;
  reviewCardCreated: boolean;
}

export interface CompleteReviewInput {
  userId: string;
  subtaskId: string;
}

export interface CompleteReviewResult {
  subtaskId: string;
  currentState: LearningState;
  nextState: LearningState;
  mastery: number;
  nextActivity: NextActivity;
}

/**
 * 学习流程统一编排服务（S1）。
 *
 * 权威状态来源：task_subtasks.learning_state + knowledge_points.mastery_level
 * （mastery_level 单一写源为 knowledge_points，subtask 通过 JOIN 读取）。
 *
 * 补齐了两处此前「通路未打通」的缺口：
 *  1. completeLearning —— 读完材料后把 subtask 从 learning 推进到首个非 learning 阶段；
 *  2. completeReview   —— 复习阶段完成后推进到练习阶段。
 * 练习/测验完成后的推进由 subtaskQuizIntegrationService.completePractice/completeQuiz
 * 已经承担，本节统一编排并复用同一套状态机与同步工具。
 */
class LearningFlowService {
  /**
   * 纯决策：依据掌握度规划「学习完成」后进入的首个非 learning 阶段。
   * 复用已有的 subtaskStateMachine.getRecommendedNextState，保证与练习/测验推进逻辑一致。
   */
  planInitialStage(mastery: number, stateHistory: StateHistoryEntry[] = []): LearningState {
    return subtaskStateMachine.getRecommendedNextState("learning", mastery, stateHistory);
  }

  async completeLearning(
    supabase: SupabaseClient,
    input: CompleteLearningInput,
  ): Promise<CompleteLearningResult> {
    const { knowledgePointId, userId } = input;

    // 1. 解析子任务（若学习流程尚未挂载到调度子任务，subtaskId 为 undefined）
    const subtask = await this.resolveSubtask(supabase, knowledgePointId);

    // 2. 计算掌握度（单一权威源 knowledge_points，基于 FSRS 卡片）
    const mastery = await masteryCalculationService.updateKnowledgePointMastery(
      supabase,
      knowledgePointId,
    );

    // 3. 规划首个非 learning 阶段
    const stateHistory: StateHistoryEntry[] = subtask?.state_history ?? [];
    const nextState = this.planInitialStage(mastery, stateHistory);

    // 4. 同步子任务状态 + 写入 state_history + 触达学习进度事件
    if (subtask && subtask.learning_state === "learning") {
      await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
        supabase,
        subtask.id,
        nextState,
        mastery,
      );
    }

    // 5. 创建首次复习卡片（幂等，已存在时静默跳过）
    const reviewCardCreated = await this.ensureFirstReviewCard(
      supabase,
      userId,
      knowledgePointId,
      input.taskId,
    );

    // 6. 返回下一步推荐活动
    const nextActivity = subtask
      ? await this.buildNextActivity(supabase, subtask.id)
      : this.buildDefaultNextActivity(mastery);

    logger.info("[LearningFlow] completeLearning", {
      knowledgePointId,
      subtaskId: subtask?.id,
      mastery: Math.round(mastery * 100),
      nextState,
    });

    return {
      subtaskId: subtask?.id,
      nextState,
      mastery,
      nextActivity,
      reviewCardCreated,
    };
  }

  async completeReview(
    supabase: SupabaseClient,
    input: CompleteReviewInput,
  ): Promise<CompleteReviewResult> {
    const { subtaskId } = input;
    const subtask = await this.fetchSubtask(supabase, subtaskId);

    // 复习后重算掌握度
    const mastery = await masteryCalculationService.updateKnowledgePointMastery(
      supabase,
      subtask.knowledge_point_id,
    );

    const currentState = subtask.learning_state;
    const nextState = currentState === "learning" ? "review" : "practice";

    if (currentState === "review" && nextState !== currentState) {
      await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
        supabase,
        subtaskId,
        nextState,
        mastery,
      );
    }

    const nextActivity = await this.buildNextActivity(supabase, subtaskId);

    logger.info("[LearningFlow] completeReview", {
      subtaskId,
      currentState,
      nextState,
      mastery: Math.round(mastery * 100),
    });

    return {
      subtaskId,
      currentState,
      nextState,
      mastery,
      nextActivity,
    };
  }

  /** 复习完成后按 FSRS 到期复习推进状态（供调度决策器复用） */
  reconcileToPractice(supabase: SupabaseClient, subtaskId: string): Promise<LearningState> {
    return this.completeReview(supabase, { userId: "", subtaskId }).then(
      (r) => r.nextState,
    );
  }

  private async resolveSubtask(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<ResolvedSubtask | null> {
    const { data } = await notDeleted(
      supabase
        .from("task_subtasks")
        .select("id, task_id, knowledge_point_id, learning_state, state_history")
        .eq("knowledge_point_id", knowledgePointId),
    )
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      task_id: data.task_id,
      knowledge_point_id: data.knowledge_point_id,
      learning_state: data.learning_state as LearningState,
      state_history: (data.state_history ?? []) as StateHistoryEntry[],
    };
  }

  private async fetchSubtask(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<ResolvedSubtask> {
    const { data, error } = await supabase
      .from("task_subtasks")
      .select("id, task_id, knowledge_point_id, learning_state, state_history")
      .eq("id", subtaskId)
      .single();

    if (error || !data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        details: { subtaskId, originalError: error?.message },
      });
    }

    return {
      id: data.id,
      task_id: data.task_id,
      knowledge_point_id: data.knowledge_point_id,
      learning_state: data.learning_state as LearningState,
      state_history: (data.state_history ?? []) as StateHistoryEntry[],
    };
  }

  private async ensureFirstReviewCard(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    taskId?: string,
  ): Promise<boolean> {
    try {
      const reviewData: CreateReviewTaskData = {
        knowledge_point_id: knowledgePointId,
        task_id: taskId ?? "",
      };
      await reviewTaskService.createFirstReviewTask(supabase, userId, reviewData);
      return true;
    } catch (err) {
      // 已存在 → 视为已创建
      if (err instanceof AppError && err.code === ErrorCodes.DATABASE_DUPLICATE_ENTRY) {
        return false;
      }
      logger.warn("[LearningFlow] first review card creation skipped", {
        knowledgePointId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  private async buildNextActivity(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<NextActivity> {
    try {
      const activity = await subtaskQuizIntegrationService.getRecommendedActivity(
        supabase,
        subtaskId,
      );
      return { type: activity.type, reason: activity.reason, availableCards: activity.availableCards };
    } catch (err) {
      logger.warn("[LearningFlow] next activity lookup failed", {
        subtaskId,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.buildDefaultNextActivity(0);
    }
  }

  private buildDefaultNextActivity(mastery: number): NextActivity {
    if (mastery >= 0.5) {
      return { type: "quiz", reason: "进入测验阶段", availableCards: 0 };
    }
    if (mastery >= 0.3) {
      return { type: "practice", reason: "进入练习巩固", availableCards: 0 };
    }
    return { type: "review", reason: "需要复习巩固", availableCards: 0 };
  }
}

interface ResolvedSubtask {
  id: string;
  task_id?: string;
  knowledge_point_id: string;
  learning_state: LearningState;
  state_history: StateHistoryEntry[];
}

export const learningFlowService = new LearningFlowService();
export { LearningFlowService };
export type { ResolvedSubtask };