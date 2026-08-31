/** @schedule decision - S4 计时与进展统一结算：学习会话为主、番茄钟独立时段兜底（去重防双算） */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { notDeleted } from "../common/softDeleteHelper";

export interface TimeSettlementResult {
  subtaskUpdated: boolean;
  pathProgressUpdated: boolean;
  taskUpdated: boolean;
  subtaskId?: string;
  pathId?: string;
  nodeId?: string;
  taskId?: string;
  /** 本次结算的时长（分钟） */
  settledMinutes: number;
  /** true 表示本次番茄钟被去重跳过（该时段已由执行会话接管） */
  skippedFallback?: boolean;
}

/**
 * 计时统一结算服务。
 *
 * 结算来源分两档：
 *  1. 执行会话（execution session）为权威来源：一次会话结束时 `settleSession` 把真实学习时长
 *     写入 user_tasks.actual_duration / task_subtasks.actual_duration / learning_path_progress.time_spent。
 *  2. 番茄钟（focus_session）仅兜底：当某番茄钟窗口内没有对应的执行会话（直学未开会话的独立时段、
 *     普通任务的番茄钟）才调用 `settleFocusSession` 结算；若已被会话接管则 `skippedFallback=true` 跳过，
 *     避免学习内双算。
 */
class TimeSettlementService {
  /**
   * 会话统一结算（权威）：一次 execution session 结束时调用，直接按会话绑定上下文写入。
   */
  async settleSession(
    supabase: SupabaseClient,
    userId: string,
    input: { taskId: string; subtaskId?: string; minutes: number },
  ): Promise<TimeSettlementResult> {
    return this.applyTime(supabase, userId, {
      taskId: input.taskId,
      subtaskId: input.subtaskId,
      minutes: input.minutes,
    });
  }

  /**
   * 番茄钟结算（兜底）：仅当该番茄钟窗口内没有对应执行会话接管时长时才结算。
   */
  async settleFocusSession(
    supabase: SupabaseClient,
    userId: string,
    payload: { taskId?: string; duration: number; sessionId?: string },
  ): Promise<TimeSettlementResult> {
    const result: TimeSettlementResult = {
      subtaskUpdated: false,
      pathProgressUpdated: false,
      taskUpdated: false,
      settledMinutes: Math.round(payload.duration / 60),
    };

    if (!payload.taskId) return result;
    result.taskId = payload.taskId;

    const minutes = result.settledMinutes;
    if (minutes <= 0) return result;

    try {
      const covered = await this.isCoveredByExecutionSession(
        supabase,
        userId,
        payload.taskId,
        payload.sessionId,
      );
      if (covered) {
        result.skippedFallback = true;
        logger.info(
          "[TimeSettlement] focus session skipped (covered by execution session)",
          { userId, taskId: payload.taskId, minutes },
        );
        return result;
      }
    } catch (error) {
      logger.warn("[TimeSettlement] dedup check failed, fall back to settle", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const applied = await this.applyTime(supabase, userId, {
      taskId: payload.taskId,
      minutes,
    });
    return { ...applied, settledMinutes: minutes };
  }

  /** 覆盖检查：该用户+该任务在番茄钟窗口内是否有执行会话（进行中或已完成）接管了时长 */
  private async isCoveredByExecutionSession(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    sessionId?: string,
  ): Promise<boolean> {
    let windowStart: string;
    let windowEnd: string;
    const now = new Date();

    if (sessionId) {
      const { data } = await supabase
        .from("focus_sessions")
        .select("started_at, ended_at")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!data?.started_at) return false;
      windowStart = data.started_at;
      windowEnd = data.ended_at ?? now.toISOString();
    } else {
      // 无窗口信息则无法判断覆盖，保守地继续结算（不误杀普通任务番茄钟）
      return false;
    }

    const { data } = await notDeleted(
      supabase
        .from("task_executions")
        .select("id, started_at, ended_at")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .in("status", ["in_progress", "completed"]),
    );
    if (!data || data.length === 0) return false;

    const winStartMs = new Date(windowStart).getTime();
    const winEndMs = new Date(windowEnd).getTime();
    const execs = data as Array<{
      started_at?: string | null;
      ended_at?: string | null;
    }>;

    return execs.some((e) => {
      const s = new Date(e.started_at ?? windowStart).getTime();
      const en = new Date(e.ended_at ?? now.toISOString()).getTime();
      // 两段区间重叠即视为被接管
      return s <= winEndMs && en >= winStartMs;
    });
  }

  /** 统一把分钟写入任务/子任务/学习路径进度 */
  private async applyTime(
    supabase: SupabaseClient,
    userId: string,
    input: { taskId: string; subtaskId?: string; minutes: number },
  ): Promise<TimeSettlementResult> {
    const result: TimeSettlementResult = {
      subtaskUpdated: false,
      pathProgressUpdated: false,
      taskUpdated: false,
      settledMinutes: input.minutes,
      taskId: input.taskId,
    };

    if (input.minutes <= 0) return result;

    const now = new Date().toISOString();

    // 1. 累加 task.actual_duration
    try {
      const { data: task } = await notDeleted(
        supabase
          .from("user_tasks")
          .select("actual_duration")
          .eq("id", input.taskId)
          .eq("user_id", userId),
      ).single();

      if (task) {
        const current = (task.actual_duration as number) || 0;
        const { error } = await supabase
          .from("user_tasks")
          .update({ actual_duration: current + input.minutes, updated_at: now })
          .eq("id", input.taskId)
          .eq("user_id", userId);
        if (!error) result.taskUpdated = true;
      }
    } catch (error) {
      logger.warn("[TimeSettlement] task actual_duration update failed", {
        taskId: input.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 2. 选择子任务：优先会话绑定的 subtask_id，否则进行中/最近的子任务
    const subtask = input.subtaskId
      ? await this.getSubtaskById(supabase, input.subtaskId)
      : await this.findActiveSubtask(supabase, input.taskId);

    if (subtask) {
      result.subtaskId = subtask.id;
      const currentSubtask = (subtask.actual_duration as number) || 0;
      const { error: subtaskError } = await supabase
        .from("task_subtasks")
        .update({
          actual_duration: currentSubtask + input.minutes,
          updated_at: now,
        })
        .eq("id", subtask.id);
      if (!subtaskError) result.subtaskUpdated = true;

      // 3. 若子任务绑定了学习路径节点 → 累加 learning_path_progress.time_spent
      if (subtask.learning_path_node_id) {
        await this.settlePathProgress(
          supabase,
          userId,
          subtask.learning_path_node_id,
          input.minutes,
          result,
        );
      }
    }

    logger.info("[TimeSettlement] settled", {
      userId,
      taskId: input.taskId,
      minutes: input.minutes,
      subtaskUpdated: result.subtaskUpdated,
      pathProgressUpdated: result.pathProgressUpdated,
      taskUpdated: result.taskUpdated,
    });

    return result;
  }

  /** 按 id 取子任务（会话绑定时更精确） */
  private async getSubtaskById(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<{ id: string; actual_duration: number | null; learning_path_node_id: string | null } | null> {
    const { data } = await supabase
      .from("task_subtasks")
      .select("id, actual_duration, learning_path_node_id")
      .eq("id", subtaskId)
      .maybeSingle();
    return data
      ? (data as { id: string; actual_duration: number | null; learning_path_node_id: string | null })
      : null;
  }

  /** 找到任务下进行中的子任务（优先 in_progress，其次 pending 中 position 最小） */
  private async findActiveSubtask(
    supabase: SupabaseClient,
    taskId: string,
  ): Promise<{ id: string; actual_duration: number | null; learning_path_node_id: string | null } | null> {
    const { data: inProgress } = await supabase
      .from("task_subtasks")
      .select("id, actual_duration, learning_path_node_id")
      .eq("task_id", taskId)
      .eq("status", "in_progress")
      .order("position", { ascending: true })
      .limit(1);

    if (inProgress && inProgress.length > 0) {
      return (inProgress as never)[0];
    }

    const { data: pending } = await supabase
      .from("task_subtasks")
      .select("id, actual_duration, learning_path_node_id")
      .eq("task_id", taskId)
      .eq("status", "pending")
      .order("position", { ascending: true })
      .limit(1);

    if (pending && pending.length > 0) return (pending as never)[0];

    return null;
  }

  private async settlePathProgress(
    supabase: SupabaseClient,
    userId: string,
    learningPathNodeId: string,
    minutes: number,
    result: TimeSettlementResult,
  ): Promise<void> {
    try {
      const { data: node } = await supabase
        .from("learning_path_nodes")
        .select("id, path_id")
        .eq("id", learningPathNodeId)
        .single();

      if (!node?.path_id) return;
      result.pathId = node.path_id;
      result.nodeId = node.id;

      const { data: existing } = await supabase
        .from("learning_path_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("path_id", node.path_id)
        .eq("node_id", node.id)
        .maybeSingle();

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("learning_path_progress")
        .upsert(
          {
            user_id: userId,
            path_id: node.path_id,
            node_id: node.id,
            time_spent: existing ? (existing.time_spent || 0) + minutes : minutes,
            started_at: existing?.started_at ?? now,
            status: existing?.status ?? "in_progress",
            updated_at: now,
          },
          { onConflict: "user_id,path_id,node_id" },
        );

      if (!error) result.pathProgressUpdated = true;
    } catch (error) {
      logger.warn("[TimeSettlement] path progress update failed", {
        learningPathNodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const timeSettlementService = new TimeSettlementService();
export { TimeSettlementService };