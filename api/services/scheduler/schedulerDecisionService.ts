/** @schedule decision - S3 调度决策器：拆分为「大循环(挑图谱大任务) + 小循环(挑子任务)」两段，事件驱动按需决策 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { spacedRepetitionBridge } from "../study/spacedRepetitionBridge";
import { taskRecommendationService } from "./taskRecommendationService";
import { learningFlowService } from "./learningFlowService";
import { subtaskStateMachine } from "./subtaskStateMachine";
import { executionService } from "./executionService";
import { smartTaskLinker } from "./smartTaskLinker";
import { crossGraphLearningPathService } from "../study/crossGraphLearningPathService";
import { resolveLocalizedText } from "../../../shared/utils/localization";
import type { StateHistoryEntry } from "../../../shared/types/scheduler";
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

/**
 * 大循环决策 —— 此刻「该推进哪个学习图谱大任务」。
 * 规则：到期复习 ≥ 阈值 → 记忆打断返回复习；否则挑得分最高的进行中图谱大任务；都没有 → empty。
 * 只负责「挑哪个图谱大任务」，不关心该图内选哪个知识点/子任务（那是小循环的职责）。
 */
export interface BigLoopDecision {
  type: "review" | "graph" | "empty";
  /** 是否记忆打断（review 时必为 true） */
  interrupted: boolean;
  /** 大循环推出的目标图谱大任务（不含子任务详情） */
  graphTask?: {
    taskId: string;
    taskTitle: string;
    graphId?: string;
    queueLevel: number;
    priority: number;
    deadline?: string;
    score: number;
  };
  /** 到期复习建议（若 type=review） */
  review?: DueReviewItem;
  /** 决策理由 */
  reason: string;
  /** 当前待复习数量 */
  overdueReviewCount: number;
}

/**
 * 小循环决策 —— 在指定图谱大任务内「下一个该做哪个知识点子任务」。
 * 在挑出子任务的基础上，依据当前阶段 + 掌握度阈值给出该子任务的「下一步动作」与推荐过渡阶段。
 */
export interface SmallLoopDecision {
  taskId: string;
  nextSubtask?: QueueTaskItem["nextSubtask"];
  subtaskProgress?: { total: number; completed: number };
  /** 下一步动作建议（基于掌握度阈值自动推进阶段） */
  nextAction?: {
    subtaskId: string;
    knowledgePointId?: string;
    /** 当前阶段 */
    currentState?: "learning" | "review" | "practice" | "quiz";
    /** 立即该做的动作（learning=读材料 / 其余=执行该阶段活动） */
    activity: "learning" | "review" | "practice" | "quiz";
    /** 完成后应过渡到的推荐阶段（掌握度阈值推导） */
    recommendedState: "learning" | "review" | "practice" | "quiz";
    mastery: number;
    reason: string;
  };
  reason: string;
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
   * 大循环：决定此刻该推进哪个图谱大任务（或先记忆打断复习）。
   */
  async decideBigLoop(
    supabase: SupabaseClient,
    userId: string,
    options?: { overdueThreshold?: number; now?: Date },
  ): Promise<BigLoopDecision> {
    const now = options?.now ?? new Date();
    const overdueThreshold =
      options?.overdueThreshold ?? REVIEW_INTERRUPT_OVERDUE_THRESHOLD;

    // 1. 记忆打断判断（到期复习，含图谱上下文）
    const reviewItems = await this.getDueReviewsWithGraph(supabase, userId, now);
    const overdueReviews = reviewItems.filter((i) => i.urgency === "overdue");

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

    // 2. 大循环：从队列挑进行中的图谱大任务
    const topTask = await this.pickQueueGraphTask(supabase, userId, now);
    if (!topTask) {
      return {
        type: "empty",
        interrupted: false,
        reason: "当前没有到期复习，也没有进行中的学习大任务",
        overdueReviewCount: overdueReviews.length,
      };
    }

    return {
      type: "graph",
      interrupted: false,
      graphTask: topTask,
      reason: `大循环选中「${topTask.taskTitle}」`,
      overdueReviewCount: overdueReviews.length,
    };
  }

  /**
   * 小循环：在大循环选出的图谱大任务内，挑下一个待执行知识点子任务并汇总进度，
   * 同时按掌握度阈值给出该子任务的「下一步动作」与推荐过渡阶段。
   */
  async decideSmallLoop(
    supabase: SupabaseClient,
    graphTask: NonNullable<BigLoopDecision["graphTask"]> | QueueTaskItem,
    now?: Date,
    userId?: string,
  ): Promise<SmallLoopDecision> {
    void now;
    const picked = await this.pickSubtaskPreferringActive(
      supabase,
      userId,
      graphTask.taskId,
    );

    const nextSubtask: QueueTaskItem["nextSubtask"] = picked
      ? {
          id: picked.id,
          title: picked.title,
          knowledgePointId: picked.knowledgePointId,
          learningState: picked.learningState,
          position: picked.position,
          masteryLevel: picked.mastery,
        }
      : undefined;
    const nextAction = picked
      ? this.computeNextAction(picked)
      : undefined;

    const { data: allSubtasks } = await supabase
      .from("task_subtasks")
      .select("status")
      .eq("task_id", graphTask.taskId);
    const total = allSubtasks?.length ?? 0;
    const completed =
      allSubtasks?.filter((s) => s.status === "completed").length ?? 0;

    const taskTitle = graphTask.taskTitle;
    let reason = `继续推进「${taskTitle}」`;
    if (nextSubtask?.title) reason += `：${nextSubtask.title}`;

    return {
      taskId: graphTask.taskId,
      nextSubtask,
      subtaskProgress: total > 0 ? { total, completed } : undefined,
      nextAction,
      reason,
    };
  }

  /**
   * 小循环：取指定图谱大任务的下一个待执行子任务（pending / in_progress），返回详细字段供阶段推进推导。
   * 若存在活跃会话（当前执行焦点），优先返回该会话所在子任务——用户手动绕过调度器直接学习时，由会话接管焦点。
   */
  private async pickSubtaskPreferringActive(
    supabase: SupabaseClient,
    userId: string | undefined,
    taskId: string,
  ): Promise<
    | {
        id: string;
        title?: string;
        knowledgePointId?: string;
        learningState?: "learning" | "review" | "practice" | "quiz";
        position?: number;
        mastery: number;
        stateHistory?: StateHistoryEntry[];
      }
    | undefined
  > {
    if (userId) {
      const open = await executionService.findOpen(supabase, userId);
      if (open) {
        // 优先按 subtask_id 精确命中，其次按 knowledge_point_id
        const tries: Array<{ id?: string; kp?: string }> = [];
        if (open.subtask_id) tries.push({ id: open.subtask_id as string });
        if (open.knowledge_point_id) tries.push({ kp: open.knowledge_point_id as string });

        for (const t of tries) {
          let query = supabase
            .from("task_subtasks")
            .select(
              "id, title, knowledge_point_id, learning_state, position, state_history, knowledge_points(mastery_level)",
            )
            .eq("task_id", taskId)
            .in("status", ["pending", "in_progress"])
            .order("position", { ascending: true })
            .limit(1);
          if (t.id) query = query.eq("id", t.id);
          else if (t.kp) query = query.eq("knowledge_point_id", t.kp);

          const { data } = await query;
          const raw = (Array.isArray(data) ? data : data ? [data] : [])[0];
          if (raw) return this.mapSubtask(raw);
        }
      }
    }
    return this.pickSubtask(supabase, taskId);
  }

  /**
   * 小循环：默认按 position 挑任务下第一个待执行子任务。
   */
  private async pickSubtask(
    supabase: SupabaseClient,
    taskId: string,
  ): Promise<
    | {
        id: string;
        title?: string;
        knowledgePointId?: string;
        learningState?: "learning" | "review" | "practice" | "quiz";
        position?: number;
        mastery: number;
        stateHistory?: StateHistoryEntry[];
      }
    | undefined
  > {
    const { data } = await supabase
      .from("task_subtasks")
      .select(
        "id, title, knowledge_point_id, learning_state, position, state_history, knowledge_points(mastery_level)",
      )
      .eq("task_id", taskId)
      .not("learning_path_node_id", "is", null)
      .in("status", ["pending", "in_progress"])
      .order("position", { ascending: true })
      .limit(1);

    const raw = data?.[0];
    return raw ? this.mapSubtask(raw) : undefined;
  }

  private mapSubtask(
    raw: {
      id: string;
      title?: string;
      knowledge_point_id?: string;
      learning_state?: string;
      position?: number;
      state_history?: StateHistoryEntry[] | null;
      knowledge_points?: { mastery_level: number | null }[] | null;
    },
  ): {
    id: string;
    title?: string;
    knowledgePointId?: string;
    learningState?: "learning" | "review" | "practice" | "quiz";
    position?: number;
    mastery: number;
    stateHistory?: StateHistoryEntry[];
  } {
    const rawLearningState = raw.learning_state;
    const learningState = ["learning", "review", "practice", "quiz"].includes(
      rawLearningState ?? "",
    )
      ? (rawLearningState as "learning" | "review" | "practice" | "quiz")
      : undefined;

    return {
      id: raw.id,
      title: raw.title,
      knowledgePointId: raw.knowledge_point_id,
      learningState,
      position: raw.position,
      mastery: raw.knowledge_points?.[0]?.mastery_level ?? 0,
      stateHistory: raw.state_history ?? [],
    };
  }

  /**
   * 大循环：若存在活跃学习会话（当前执行焦点），返回其所在任务，供「接管焦点」使用。
   * 仅在用户真实处于学习/答题会话时接管；会话结束回到普通调度。
   */
  private async findActiveFocusTask(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<{ taskId: string; taskTitle: string; graphId?: string } | null> {
    const open = await executionService.findOpen(supabase, userId);
    if (!open?.task_id) return null;

    const { data: task } = await supabase
      .from("user_tasks")
      .select("id, title, graph_id, status")
      .eq("id", open.task_id)
      .single();

    if (!task) return null;
    if (
      task.status === "completed" ||
      task.status === "cancelled" ||
      task.status === "paused"
    ) {
      return null;
    }
    return {
      taskId: task.id,
      taskTitle: (task.title as string) ?? task.id,
      graphId: task.graph_id ?? undefined,
    };
  }

  /**
   * 小循环：按当前阶段 + 掌握度阈值推导该子任务「下一步该做什么」。
   * 只返回建议，不自动落库（事件驱动、按需决策）。
   */
  private computeNextAction(
    picked: NonNullable<Awaited<ReturnType<SchedulerDecisionService["pickSubtask"]>>>,
  ): SmallLoopDecision["nextAction"] {
    const currentState = picked.learningState;
    const mastery = picked.mastery || 0;
    const history = picked.stateHistory ?? [];
    if (!currentState) return undefined;

    const recommendedState = this.normalizeState(
      subtaskStateMachine.getRecommendedNextState(
        currentState,
        mastery,
        history,
      ),
    );

    const learningNotCompleted =
      currentState === "learning" &&
      !subtaskStateMachine.isLearningCompleted(history);

    let activity: "learning" | "review" | "practice" | "quiz";
    let reason: string;
    if (learningNotCompleted) {
      activity = "learning";
      reason = `尚未完成学习，先阅读「${picked.title ?? "该知识点"}」的材料`;
    } else if (currentState === "quiz") {
      activity = "quiz";
      reason = `掌握度达到测验线，可进行「测验」验证（完成后推荐进入 ${recommendedState}）`;
    } else if (currentState === "review") {
      activity = "review";
      reason = `有到期复习，先「复习」该知识点（完成后过渡到练习）`;
    } else {
      activity = currentState;
      reason = `执行「${currentState}」阶段，掌握度达阈值后建议进入 ${recommendedState}`;
    }

    return {
      subtaskId: picked.id,
      knowledgePointId: picked.knowledgePointId,
      currentState,
      activity,
      recommendedState,
      mastery,
      reason,
    };
  }

  private normalizeState(s: string): "learning" | "review" | "practice" | "quiz" {
    if (["learning", "review", "practice", "quiz"].includes(s)) {
      return s as "learning" | "review" | "practice" | "quiz";
    }
    return "review";
  }

  /**
   * 执行动作：给定图谱大任务，返回小循环「下一步动作」对应的直接跳转（把推荐喂给跳转）。
   */
  async getNextActionForTask(
    supabase: SupabaseClient,
    taskId: string,
    userId?: string,
  ): Promise<{
    action:
      | (NonNullable<SmallLoopDecision["nextAction"]> & {
          graphId?: string;
          url?: string;
          taskTitle?: string;
        })
      | null;
  }> {
    const { data: task } = await supabase
      .from("user_tasks")
      .select("id, title, graph_id")
      .eq("id", taskId)
      .maybeSingle();

    const picked = userId
      ? await this.pickSubtaskPreferringActive(supabase, userId, taskId)
      : await this.pickSubtask(supabase, taskId);
    const nextAction = picked ? this.computeNextAction(picked) : undefined;
    if (!nextAction || !nextAction.knowledgePointId) {
      return { action: null };
    }

    const graphId = task?.graph_id ?? undefined;
    const url = this.buildActionUrl(
      nextAction.activity,
      nextAction.knowledgePointId,
      graphId,
    );

    return {
      action: { ...nextAction, graphId, url, taskTitle: task?.title ?? "" },
    };
  }

  /** 将小循环阶段动作映射为前端可跳转的 URL */
  private buildActionUrl(
    activity: "learning" | "review" | "practice" | "quiz",
    knowledgePointId: string,
    graphId?: string,
  ): string {
    const search = new URLSearchParams({ node_id: knowledgePointId });
    if (graphId) search.set("graph_id", graphId);
    if (activity === "quiz") search.set("mode", "quiz");
    const base = activity === "learning" ? "/learning" : "/study";
    return `${base}?${search.toString()}`;
  }

  /**
   * 完整决策 = 大循环 + 小循环（兼容对外输出结构）。
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

    // 大循环：复习打断 or 挑图谱大任务
    const big = await this.decideBigLoop(supabase, userId, { ...options, now });

    if (big.type === "review") {
      return {
        type: "review",
        interrupted: true,
        review: big.review,
        reason: big.reason,
        overdueReviewCount: big.overdueReviewCount,
      };
    }
    if (big.type === "empty" && !big.graphTask) {
      return {
        type: "empty",
        interrupted: false,
        reason: big.reason,
        overdueReviewCount: big.overdueReviewCount,
      };
    }

    // 会话接管焦点：若用户正处在一次活跃学习/答题会话中，优先继续该会话所在任务
    const focus = await this.findActiveFocusTask(supabase, userId);
    const graphTask = focus
      ? {
          taskId: focus.taskId,
          taskTitle: focus.taskTitle,
          graphId: focus.graphId,
          queueLevel: big.graphTask?.queueLevel ?? 0,
          priority: big.graphTask?.priority ?? 0,
          deadline: big.graphTask?.deadline,
          score: big.graphTask?.score ?? 100,
        }
      : big.graphTask;

    if (!graphTask) {
      return {
        type: "empty",
        interrupted: false,
        reason: big.reason,
        overdueReviewCount: big.overdueReviewCount,
      };
    }

    // 小循环：在该大任务内挑下一个子任务（优先当前会话所在的子任务）
    const small = await this.decideSmallLoop(supabase, graphTask, now, userId);

    return {
      type: "progress",
      interrupted: false,
      progress: {
        taskId: graphTask.taskId,
        taskTitle: graphTask.taskTitle,
        graphId: graphTask.graphId,
        queueLevel: graphTask.queueLevel,
        priority: graphTask.priority,
        deadline: graphTask.deadline,
        score: graphTask.score,
        nextSubtask: small.nextSubtask,
        subtaskProgress: small.subtaskProgress,
      },
      reason: small.reason,
      overdueReviewCount: big.overdueReviewCount,
    };
  }

  /**
   * 大循环：从队列挑得分最高的进行中图谱学习大任务（不含子任务详情）。
   * 优先按 active 跨图谱学习路径推进（路径中下一个未完成的图谱）；
   * 无跨图路径时回退到推荐队列。
   */
  private async pickQueueGraphTask(
    supabase: SupabaseClient,
    userId: string,
    now: Date,
  ): Promise<NonNullable<BigLoopDecision["graphTask"]> | null> {
    // 1. 若存在 active 跨图谱学习路径，大循环按路径推进
    const crossGraphTask = await this.pickFromCrossGraphPath(
      supabase,
      userId,
    );
    if (crossGraphTask) return crossGraphTask;

    // 2. 回退：推荐队列
    const recommendations =
      await taskRecommendationService.getTaskRecommendations(supabase, userId, {
        currentTime: now,
      });

    const progressCandidates = recommendations.filter(
      (rec) => rec.task.task_type === "graph_learning",
    );
    const topRec = progressCandidates[0] ?? recommendations[0];
    if (!topRec) return null;

    const task = topRec.task;
    return {
      taskId: task.id,
      taskTitle: task.title,
      graphId: task.graph_id ?? undefined,
      queueLevel: task.queue_level,
      priority: task.priority,
      deadline: task.deadline ?? undefined,
      score: topRec.score,
    };
  }

  /**
   * 大循环：优先按「跨图谱学习路径」推进——取路径中下一个未完成的图谱，
   * 确保其 graph_learning 大任务存在后作为大循环目标返回。
   */
  private async pickFromCrossGraphPath(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<NonNullable<BigLoopDecision["graphTask"]> | null> {
    const next = await crossGraphLearningPathService.getNextGraphInPath(
      supabase,
      userId,
    );
    if (!next) return null;

    try {
      const info = await smartTaskLinker.getOrCreateTaskForGraph(
        supabase,
        userId,
        next.graphId,
      );
      return {
        taskId: info.mainTaskId,
        taskTitle: info.graphName,
        graphId: next.graphId,
        queueLevel: 1,
        priority: 1,
        deadline: undefined,
        score: 100,
      };
    } catch (error) {
      logger.warn("[SchedulerDecision] pickFromCrossGraphPath failed", {
        graphId: next.graphId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
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
      // knowledge_points.title 为 JSONB 本地化对象，需解析为可读文本再展示
      titleById.set(kp.id, resolveLocalizedText(kp.title));
    }

    const nowMs = now.getTime();
    return items
      .filter((item) => {
        if (!item.nextReviewDate) return true;
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
        _nextMs: item.nextReviewDate
          ? new Date(item.nextReviewDate).getTime()
          : nowMs,
      }))
      .sort((a, b) => {
        if (a.urgency !== b.urgency) {
          return a.urgency === "overdue" ? -1 : 1;
        }
        return a.masteryLevel - b.masteryLevel;
      });
  }

  private pickTopReview(
    items: Array<DueReviewItem & { _nextMs?: number }>,
  ): DueReviewItem {
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
   * 完成一次决策后的推进辅助：复习完成时推进子任务状态（review → practice）。
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
    const items = await this.getDueReviewsWithGraph(
      supabase,
      userId,
      new Date(),
    );
    const overdueCount = items.filter((i) => i.urgency === "overdue").length;
    return {
      overdueCount,
      shouldInterrupt: overdueCount >= REVIEW_INTERRUPT_OVERDUE_THRESHOLD,
    };
  }
}

export const schedulerDecisionService = new SchedulerDecisionService();
export { SchedulerDecisionService };