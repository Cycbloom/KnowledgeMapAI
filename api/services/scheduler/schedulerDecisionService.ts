/** @schedule decision - S3 调度决策器：决定「下一步该学什么」并实现记忆打断跳转 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { spacedRepetitionBridge } from "../study/spacedRepetitionBridge";
import { taskRecommendationService } from "./taskRecommendationService";
import { learningFlowService } from "./learningFlowService";
import { notDeleted } from "../common/softDeleteHelper";

/** 记忆打断阈值：到期复习队列里 overdue 卡片达到该数量时，优先中断当前学习去复习 */
export const REVIEW_INTERRUPT_OVERDUE_THRESHOLD = 3;

export interface DueReviewItem {
  cardId: string;
  knowledgePointId: string;
  graphId?: string;
  nextReviewDate?: string;
  urgency: "overdue" | "today" | "upcoming" | "future";
  masteryLevel: number;
  title?: string;
}

export interface QueueTaskItem {
  taskId: string;
  taskTitle: string;
  graphId?: string;
  queueLevel: number;
  priority: number;
  deadline?: string;
  score: number;
  nextSubtask?: {
    id: string;
    title?: string;
    knowledgePointId?: string;
    learningState?: string;
    position?: number;
    masteryLevel?: number;
  };
  subtaskProgress?: { total: number; completed: number };
}

export interface NextStepDecision {
  /** 决策类型：review（记忆打断复习）| progress（继续推进学习进度）| empty */
  type: "review" | "progress" | "empty";
  /** 是否发生了记忆打断（本应在 progress 上继续，但被到期复习抢占） */
  interrupted: boolean;
  /** 到期复习建议（若 type=review） */
  review?: DueReviewItem;
  /** 队列推进建议（若 type=progress） */
  progress?: QueueTaskItem;
  /** 决策理由 */
  reason: string;
  /** 当前待复习数量 */
  overdueReviewCount: number;
}

class SchedulerDecisionService {
  /**
   * 核心决策：返回「现在最该做的下一步」。
   *
   * 规则（记忆打断模型）：
   *  1. 若到期复习（overdue）卡片数 ≥ 阈值 → 记忆打断，返回最高优先级复习项
   *     （逾期越久 / 掌握度越低 优先级越高）
   *  2. 否则 → 从队列中选得分最高的进行中图谱任务，返回其下一个待执行子任务
   *  3. 都没有 → empty
   */
  async getNextStep(
    supabase: SupabaseClient,
    userId: string,
    options?: {
      /** 打断阈值覆盖（默认 REVIEW_INTERRUPT_OVERDUE_THRESHOLD） */
      overdueThreshold?: number;
      now?: Date;
    },
  ): Promise<NextStepDecision> {
    const now = options?.now ?? new Date();
    const overdueThreshold = options?.overdueThreshold ?? REVIEW_INTERRUPT_OVERDUE_THRESHOLD;

    // 1. 到期复习队列（含图谱上下文）
    const reviewItems = await this.getDueReviewsWithGraph(supabase, userId, now);
    const overdueReviews = reviewItems.filter(
      (item) => item.urgency === "overdue",
    );

    if (overdueReviews.length >= overdueThreshold) {
      const topReview = this.pickTopReview(overdueReviews);
      return {
        type: "review",
        interrupted: true,
        review: topReview,
        reason: `有 ${overdueReviews.length} 个知识点逾期未复习，记忆已下降，建议先复习「${topReview.title ?? topReview.knowledgePointId}」`,
        overdueReviewCount: overdueReviews.length,
      };
    }

    // 2. 队列推进（进行中的图谱学习任务）
    const topTask = await this.pickTopQueueTask(supabase, userId, now);

    if (!topTask) {
      return {
        type: "empty",
        interrupted: false,
        reason: "当前没有到期复习，也没有进行中的学习任务",
        overdueReviewCount: overdueReviews.length,
      };
    }

    return {
      type: "progress",
      interrupted: false,
      progress: topTask,
      reason: `继续推进「${topTask.taskTitle}」${topTask.nextSubtask ? `：${topTask.nextSubtask.title}` : ""}`,
      overdueReviewCount: overdueReviews.length,
    };
  }

  /**
   * 到期复习列表（FSRS），并补充知识点的图谱上下文，供「跳转到哪个图复习」使用。
   */
  private async getDueReviewsWithGraph(
    supabase: SupabaseClient,
    userId: string,
    now: Date,
  ): Promise<DueReviewItem[]> {
    const items = await spacedRepetitionBridge.getUnifiedReviewQueue(
      supabase,
      userId,
    );

    if (items.length === 0) return [];

    // 批量取知识点 → 图谱映射
    const kpIds = Array.from(
      new Set(items.map((i) => i.knowledgePointId).filter(Boolean)),
    );
    const kpToGraph = new Map<string, string>();
    if (kpIds.length > 0) {
      const { data: nodes } = await notDeleted(
        supabase
          .from("graph_nodes")
          .select("knowledge_point_id, graph_id")
          .in("knowledge_point_id", kpIds),
      );
      for (const n of nodes ?? []) {
        if (!kpToGraph.has(n.knowledge_point_id)) {
          kpToGraph.set(n.knowledge_point_id, n.graph_id);
        }
      }
    }

    const { data: kpRows } = await supabase
      .from("knowledge_points")
      .select("id, title")
      .in("id", kpIds);

    const titleById = new Map<string, string>();
    for (const kp of kpRows ?? []) {
      titleById.set(kp.id, kp.title);
    }

    const nowMs = now.getTime();
    return items
      .filter((item) => {
        if (!item.nextReviewDate) return true;
        // 只看今天/逾期（不含 future 远期项），避免决策噪声
        return item.urgency !== "future";
      })
      .map((item): DueReviewItem & { _nextMs?: number } => ({
        cardId: item.id,
        knowledgePointId: item.knowledgePointId,
        graphId: kpToGraph.get(item.knowledgePointId),
        nextReviewDate: item.nextReviewDate,
        urgency: item.urgency,
        masteryLevel: item.masteryLevel,
        title: titleById.get(item.knowledgePointId),
        // 保留原始值用于排序
        _nextMs: item.nextReviewDate ? new Date(item.nextReviewDate).getTime() : nowMs,
      }))
      .sort((a, b) => {
        // 逾期在前，其次掌握度低的在前
        if (a.urgency !== b.urgency) {
          return a.urgency === "overdue" ? -1 : 1;
        }
        return a.masteryLevel - b.masteryLevel;
      });
  }

  private pickTopReview(items: Array<DueReviewItem & { _nextMs?: number }>): DueReviewItem {
    // 逾期越久（_nextMs 越小）越优先；同逾期时掌握度越低越优先
    const sorted = [...items].sort((a, b) => {
      if (a.urgency === "overdue" && b.urgency === "overdue") {
        const aMs = a._nextMs ?? 0;
        const bMs = b._nextMs ?? 0;
        if (aMs !== bMs) return aMs - bMs;
      }
      return a.masteryLevel - b.masteryLevel;
    });
    const top = sorted[0];
    if (!top) return items[0];
    return {
      cardId: top.cardId,
      knowledgePointId: top.knowledgePointId,
      graphId: top.graphId,
      nextReviewDate: top.nextReviewDate,
      urgency: top.urgency,
      masteryLevel: top.masteryLevel,
      title: top.title,
    };
  }

  /**
   * 从队列中挑得分最高的进行中图谱学习任务，并附上其下一个待执行子任务。
   */
  private async pickTopQueueTask(
    supabase: SupabaseClient,
    userId: string,
    now: Date,
  ): Promise<QueueTaskItem | null> {
    const recommendations = await taskRecommendationService.getTaskRecommendations(
      supabase,
      userId,
      { currentTime: now },
    );

    const progressCandidates = recommendations.filter(
      (rec) => rec.task.task_type === "graph_learning",
    );

    const topRec = progressCandidates[0] ?? recommendations[0];
    if (!topRec) return null;

    const task = topRec.task;

    // 取该任务的下一个待执行子任务
    const { data: subtasks } = await supabase
      .from("task_subtasks")
      .select(
        "id, title, knowledge_point_id, learning_state, position, estimated_duration, knowledge_points(mastery_level)",
      )
      .eq("task_id", task.id)
      .not("learning_path_node_id", "is", null)
      .in("status", ["pending", "in_progress"])
      .order("position", { ascending: true })
      .limit(1);

    const nextSubtaskRaw = subtasks?.[0] as
      | {
          id: string;
          title?: string;
          knowledge_point_id?: string;
          learning_state?: string;
          position?: number;
          estimated_duration?: number;
          knowledge_points?: { mastery_level: number | null }[] | null;
        }
      | undefined;

    let nextSubtask: QueueTaskItem["nextSubtask"];
    if (nextSubtaskRaw) {
      nextSubtask = {
        id: nextSubtaskRaw.id,
        title: nextSubtaskRaw.title,
        knowledgePointId: nextSubtaskRaw.knowledge_point_id,
        learningState: nextSubtaskRaw.learning_state,
        position: nextSubtaskRaw.position,
        masteryLevel:
          nextSubtaskRaw.knowledge_points?.[0]?.mastery_level ?? undefined,
      };
    }

    // 该任务的子任务进度统计
    const { data: allSubtasks } = await supabase
      .from("task_subtasks")
      .select("status")
      .eq("task_id", task.id);
    const total = allSubtasks?.length ?? 0;
    const completed =
      allSubtasks?.filter((s) => s.status === "completed").length ?? 0;

    return {
      taskId: task.id,
      taskTitle: task.title,
      graphId: task.graph_id ?? undefined,
      queueLevel: task.queue_level,
      priority: task.priority,
      deadline: task.deadline ?? undefined,
      score: topRec.score,
      nextSubtask,
      subtaskProgress: total > 0 ? { total, completed } : undefined,
    };
  }

  /**
   * 完成一次决策后的推进辅助：复习完成时推进子任务状态（review → practice），
   * 供调用方在复习提交后调用，让状态机与决策器保持一致。
   */
  async advanceAfterReview(
    supabase: SupabaseClient,
    subtaskId?: string,
  ): Promise<void> {
    if (!subtaskId) return;
    try {
      await learningFlowService.reconcileToPractice(supabase, subtaskId);
    } catch (error) {
      logger.warn("[SchedulerDecision] advanceAfterReview failed", {
        subtaskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 决策配套：报告当前是否需要记忆打断（供 UI 展示「建议先复习」）。
   */
  async needsReviewInterrupt(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<{ overdueCount: number; shouldInterrupt: boolean }> {
    const items = await this.getDueReviewsWithGraph(supabase, userId, new Date());
    const overdueCount = items.filter((i) => i.urgency === "overdue").length;
    return {
      overdueCount,
      shouldInterrupt: overdueCount >= REVIEW_INTERRUPT_OVERDUE_THRESHOLD,
    };
  }
}

export const schedulerDecisionService = new SchedulerDecisionService();
export { SchedulerDecisionService };