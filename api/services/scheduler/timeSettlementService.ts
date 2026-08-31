/** @schedule decision - S4 计时与进展统一结算：专注时长 → 子任务/路径/任务 actual_duration + time_spent */
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
}

/**
 * 专注时长统一结算服务。
 *
 * 当一次 focus session 结束时，把耗时分钟数：
 *  1. 累加到关联 task_subtasks.actual_duration（子任务实际耗时）
 *  2. 累加到关联 learning_path_progress.time_spent（学习路径节点耗时，分钟）
 *  3. 累加到关联 user_tasks.actual_duration（任务实际耗时，分钟）
 *
 * 通过 task_id 关联（focus session 的 taskId），并向下解析：
 *  - task_subtasks 通过 task_id 找到（优先进行中的子任务，其次最近创建）
 *  - learning_path_progress 通过子任务的 learning_path_node_id → path_id 找到
 */
class TimeSettlementService {
  async settleFocusSession(
    supabase: SupabaseClient,
    userId: string,
    payload: { taskId?: string; duration: number },
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

    const now = new Date().toISOString();

    // 1. 累加 task.actual_duration
    try {
      const { data: task } = await notDeleted(
        supabase
          .from("user_tasks")
          .select("actual_duration, graph_id")
          .eq("id", payload.taskId)
          .eq("user_id", userId),
      )
        .single();

      if (task) {
        const current = (task.actual_duration as number) || 0;
        const { error } = await supabase
          .from("user_tasks")
          .update({ actual_duration: current + minutes, updated_at: now })
          .eq("id", payload.taskId)
          .eq("user_id", userId);
        if (!error) result.taskUpdated = true;
      }
    } catch (error) {
      logger.warn("[TimeSettlement] task actual_duration update failed", {
        taskId: payload.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 2. 找到该任务下进行中的子任务（用于累加 + 解析学习路径）
    const subtask = await this.findActiveSubtask(supabase, payload.taskId);
    if (subtask) {
      result.subtaskId = subtask.id;

      // 累加 subtask.actual_duration
      const currentSubtask = (subtask.actual_duration as number) || 0;
      const { error: subtaskError } = await supabase
        .from("task_subtasks")
        .update({ actual_duration: currentSubtask + minutes, updated_at: now })
        .eq("id", subtask.id);
      if (!subtaskError) result.subtaskUpdated = true;

      // 3. 若子任务绑定了学习路径节点 → 累加 learning_path_progress.time_spent
      if (subtask.learning_path_node_id) {
        await this.settlePathProgress(
          supabase,
          userId,
          subtask.learning_path_node_id,
          minutes,
          result,
        );
      }
    }

    logger.info("[TimeSettlement] focus session settled", {
      userId,
      taskId: payload.taskId,
      minutes,
      subtaskUpdated: result.subtaskUpdated,
      pathProgressUpdated: result.pathProgressUpdated,
      taskUpdated: result.taskUpdated,
    });

    return result;
  }

  /** 找到任务下进行中的子任务（优先 in_progress，其次 pending 中 position 最小） */
  private async findActiveSubtask(
    supabase: SupabaseClient,
    taskId: string,
  ): Promise<
    | {
        id: string;
        actual_duration: number | null;
        learning_path_node_id: string | null;
      }
    | null
  > {
    const { data: inProgress } = await supabase
      .from("task_subtasks")
      .select("id, actual_duration, learning_path_node_id")
      .eq("task_id", taskId)
      .eq("status", "in_progress")
      .order("position", { ascending: true })
      .limit(1);

    if (inProgress && inProgress.length > 0) return inProgress[0] as never;

    const { data: pending } = await supabase
      .from("task_subtasks")
      .select("id, actual_duration, learning_path_node_id")
      .eq("task_id", taskId)
      .eq("status", "pending")
      .order("position", { ascending: true })
      .limit(1);

    if (pending && pending.length > 0) return pending[0] as never;

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
      // 由 learning_path_nodes 反查 path_id
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