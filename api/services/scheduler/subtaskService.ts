import { SupabaseClient } from "@supabase/supabase-js";
import { subtaskStateMachine } from "./subtaskStateMachine";
import { subtaskKnowledgeSyncService } from "./subtaskKnowledgeSync";
import { logger } from "../../utils/logger";
import type { LearningState, StateHistoryEntry } from "../../../shared/types/scheduler";
import { notDeleted } from '../common/softDeleteHelper';
import { resolveLocalizedText } from "../../../shared/utils/localization";
import i18next from "i18next";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface CreateSubtaskData {
  title: string;
  description?: string;
  knowledge_point_id: string;
  priority?: number;
  estimated_duration?: number;
  due_date?: string;
}

interface UpdateSubtaskData {
  title?: string;
  description?: string;
  status?: "pending" | "in_progress" | "completed";
  priority?: number;
  estimated_duration?: number;
  actual_duration?: number;
  due_date?: string | null;
  learning_state?: LearningState;
  mastery_level?: number;
}

interface ValidTransitionsResult {
  current_state: LearningState;
  mastery_level: number;
  valid_transitions: LearningState[];
  recommended_next: LearningState;
}

export class SubtaskService {
  async list(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
  ) {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(i18next.t("scheduler.subtask.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: subtasks, error } = await supabase
      .from("task_subtasks")
      .select("*, knowledge_points(mastery_level)")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get subtasks error:", error);
      throw new AppError(i18next.t("scheduler.subtask.errors.fetchListFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return (subtasks ?? []).map((s) => this.flattenSubtaskMastery(s));
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    data: CreateSubtaskData,
  ) {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(i18next.t("scheduler.subtask.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: existingSubtask } = await supabase
      .from("task_subtasks")
      .select("id")
      .eq("task_id", taskId)
      .eq("knowledge_point_id", data.knowledge_point_id)
      .maybeSingle();

    if (existingSubtask) {
      throw new AppError(i18next.t("scheduler.subtask.errors.knowledgeAlreadyLinked"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { count } = await supabase
      .from("task_subtasks")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId);

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: taskId,
        title: data.title,
        description: data.description,
        knowledge_point_id: data.knowledge_point_id,
        priority: data.priority ?? 0,
        position: count ?? 0,
        estimated_duration: data.estimated_duration,
        due_date: data.due_date,
        status: "pending",
        learning_state: "learning",
        last_state_change_at: new Date().toISOString(),
        state_history: [],
      })
      .select("*, knowledge_points(mastery_level)")
      .single();

    if (error) {
      logger.error("Create subtask error:", error);
      throw new AppError(i18next.t("scheduler.subtask.errors.createFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return this.flattenSubtaskMastery(subtask);
  }

  async update(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    subtaskId: string,
    updates: UpdateSubtaskData,
  ) {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(i18next.t("scheduler.subtask.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // mastery_level 单一来源：从 task_subtasks 更新中剥离，重定向到 knowledge_points
    const { mastery_level, ...subtaskUpdates } = updates;

    if (subtaskUpdates.status === "completed") {
      (subtaskUpdates as Record<string, unknown>).completed_at =
        new Date().toISOString();
    }

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({ ...subtaskUpdates, updated_at: new Date().toISOString() })
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .select("*, knowledge_points(mastery_level)")
      .single();

    if (error) {
      logger.error("Update subtask error:", error);
      throw new AppError(i18next.t("scheduler.subtask.errors.updateFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!subtask) {
      throw new AppError(i18next.t("scheduler.subtask.errors.subtaskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // 如果显式提供了 mastery_level，写入 knowledge_points（单一来源）
    if (mastery_level !== undefined && subtask.knowledge_point_id) {
      const { error: kpError } = await supabase
        .from("knowledge_points")
        .update({
          mastery_level,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subtask.knowledge_point_id);

      if (kpError) {
        logger.error("Failed to update knowledge point mastery:", kpError);
      }
    }

    if (subtask.learning_path_node_id && subtaskUpdates.status === "completed") {
      try {
        await supabase
          .from("learning_path_nodes")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", subtask.learning_path_node_id);

        logger.info(
          `Synced subtask ${subtaskId} completion with learning path node ${subtask.learning_path_node_id}`,
        );
      } catch (syncError) {
        logger.error("Failed to sync with learning path node:", syncError);
      }
    }

    if (subtaskUpdates.learning_state || mastery_level !== undefined) {
      try {
        const currentMastery = this.readMasteryFromJoin(subtask);
        await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
          supabase,
          subtaskId,
          subtaskUpdates.learning_state || subtask.learning_state,
          mastery_level ?? currentMastery,
        );
      } catch (syncError) {
        logger.error("Failed to sync with knowledge point:", syncError);
      }
    }

    return this.flattenSubtaskMastery(subtask);
  }

  async delete(
    supabase: SupabaseClient,
    _userId: string,
    taskId: string,
    subtaskId: string,
  ) {
    const { error } = await supabase
      .from("task_subtasks")
      .delete()
      .eq("id", subtaskId)
      .eq("task_id", taskId);

    if (error) {
      logger.error("Delete subtask error:", error);
      throw new AppError(i18next.t("scheduler.subtask.errors.deleteFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async transition(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    subtaskId: string,
    toState: LearningState,
    masteryLevel: number,
    reason?: string,
  ) {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(i18next.t("scheduler.subtask.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: subtask, error: fetchError } = await supabase
      .from("task_subtasks")
      .select("*, knowledge_points(mastery_level)")
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .single();

    if (fetchError || !subtask) {
      throw new AppError(i18next.t("scheduler.subtask.errors.subtaskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const currentState = subtask.learning_state as LearningState;

    if (!subtaskStateMachine.canTransition(currentState, toState)) {
      const validTransitions =
        subtaskStateMachine.getValidTransitions(currentState);
      const error = new AppError(
        i18next.t("scheduler.subtask.errors.invalidTransition", { from: currentState, to: toState }),
        400,
        ErrorCodes.VALIDATION_ERROR,
      ) as AppError & { validTransitions?: LearningState[] };
      error.validTransitions = validTransitions;
      throw error;
    }

    const result = await subtaskStateMachine.transition(
      supabase,
      subtaskId,
      toState,
      masteryLevel,
      reason,
    );

    if (!result.success) {
      throw new AppError(result.error || i18next.t("scheduler.subtask.errors.transitionFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    // subtaskStateMachine.transition 已统一完成 状态流转 + 掌握度写入 + 阶段 pending 回写，
    // 此处不再重复 syncSubtaskStateToKnowledgePoint，避免 state_history / mastery 双写不一致。
    return result.subtask;
  }

  async updateMastery(
    supabase: SupabaseClient,
    _userId: string,
    taskId: string,
    subtaskId: string,
    masteryLevel: number,
  ) {
    const { data: subtask, error: fetchError } = await supabase
      .from("task_subtasks")
      .select("id, task_id, knowledge_point_id, learning_state, knowledge_points(mastery_level)")
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .single();

    if (fetchError || !subtask) {
      throw new AppError(i18next.t("scheduler.subtask.errors.updateMasteryFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    // mastery_level 单一来源：写入 knowledge_points（不再写入 task_subtasks）
    if (subtask.knowledge_point_id) {
      const { error: kpError } = await supabase
        .from("knowledge_points")
        .update({
          mastery_level: masteryLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subtask.knowledge_point_id);

      if (kpError) {
        throw new AppError(i18next.t("scheduler.subtask.errors.updateMasteryFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }
    }

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      subtask.learning_state as LearningState,
      masteryLevel,
    );

    return this.flattenSubtaskMastery(subtask);
  }

  async getValidTransitions(
    supabase: SupabaseClient,
    _userId: string,
    taskId: string,
    subtaskId: string,
  ): Promise<ValidTransitionsResult> {
    const { data: subtask } = await supabase
      .from("task_subtasks")
      .select("learning_state, state_history, knowledge_points(mastery_level)")
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .single();

    if (!subtask) {
      throw new AppError(i18next.t("scheduler.subtask.errors.subtaskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const currentState = subtask.learning_state as LearningState;
    const masteryLevel = this.readMasteryFromJoin(subtask);
    const validTransitions =
      subtaskStateMachine.getValidTransitions(currentState);
    const recommendedNext = subtaskStateMachine.getRecommendedNextState(
      currentState,
      masteryLevel,
      (subtask as { state_history: StateHistoryEntry[] }).state_history || [],
    );

    return {
      current_state: currentState,
      mastery_level: masteryLevel,
      valid_transitions: validTransitions,
      recommended_next: recommendedNext,
    };
  }

  /**
   * 刷新/重建子任务：
   *  1. 自动对齐：按任务挂靠的知识点（图任务的图内全部知识点 / 单知识点任务）自动补齐缺失子任务
   *  2. 路径编排：指定 pathId 时，将子任务重排为「该路径包含的知识点子集（按路径顺序）」，
   *     不在路径内的知识点子任务置为未绑定（learning_path_node_id=null）并排到末尾
   *  3. 重置：mode=reset 仅重置 status 为 pending、清空完成时间（保留学习阶段/掌握度）
   *  4. 持久化：图任务回写 active_learning_path_id，作为详情页默认编排来源
   */
  async refreshSubtasksForTask(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    opts: { mode?: "sync" | "reset"; pathId?: string } = {},
  ) {
    const mode = opts.mode ?? "sync";
    const pathId = opts.pathId || undefined;

    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id, graph_id, knowledge_point_id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(i18next.t("scheduler.subtask.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const graphId = task.graph_id as string | null;
    const kpId = task.knowledge_point_id as string | null;

    // 1. 确定目标知识点序列（自动补齐的来源）
    let targetKps: Array<{ id: string; title: string }> = [];
    if (graphId) {
      targetKps = await this.getGraphKps(supabase, graphId);
    } else if (kpId) {
      const { data: kp } = await supabase
        .from("knowledge_points")
        .select("id, title")
        .eq("id", kpId)
        .maybeSingle();
      if (kp) {
        targetKps = [
          {
            id: (kp as { id: string }).id,
            title: resolveLocalizedText(
              (kp as { title: string | Record<string, string> | null }).title,
            ),
          },
        ];
      }
    }

    // 2. 校验并加载目标学习路径（按 order_index 排序）
    const fullPathNodes: Array<{
      id: string;
      knowledge_point_id: string | null;
      order_index: number;
    }> = [];
    const kpToPathNode = new Map<
      string,
      { id: string; orderIndex: number }
    >();
    if (pathId) {
      const { data: path } = await supabase
        .from("learning_paths")
        .select("id")
        .eq("id", pathId)
        .eq("user_id", userId)
        .maybeSingle();
      if (path) {
        const { data: nodes } = await supabase
          .from("learning_path_nodes")
          .select("id, knowledge_point_id, order_index")
          .eq("path_id", pathId)
          .order("order_index", { ascending: true });
        if (nodes) {
          for (const n of nodes as Array<{
            id: string;
            knowledge_point_id: string | null;
            order_index: number;
          }>) {
            fullPathNodes.push(n);
            if (n.knowledge_point_id) {
              kpToPathNode.set(n.knowledge_point_id, {
                id: n.id,
                orderIndex: n.order_index,
              });
            }
          }
        }
      }
    }

    // 3. 自动补齐缺失子任务（按知识点数量）
    const { data: existingSubtasks, error: existingError } = await supabase
      .from("task_subtasks")
      .select("id, knowledge_point_id")
      .eq("task_id", taskId);
    if (existingError) {
      logger.error("Refresh subtasks: fetch existing error:", existingError);
      throw new AppError(i18next.t("scheduler.subtask.errors.fetchListFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const existingKps = new Set(
      (existingSubtasks || []).map((s) => s.knowledge_point_id),
    );
    const missing = targetKps.filter((kp) => !existingKps.has(kp.id));
    if (missing.length > 0) {
      const inserts = missing.map((kp, index) => ({
        task_id: taskId,
        title: kp.title,
        status: "pending",
        priority: 0,
        position: (existingSubtasks?.length || 0) + index,
        estimated_duration: 15,
        knowledge_point_id: kp.id,
        learning_state: "learning",
        last_state_change_at: new Date().toISOString(),
        state_history: [],
      }));
      const { error: insertError } = await supabase
        .from("task_subtasks")
        .insert(inserts);
      if (insertError) {
        logger.error("Refresh subtasks: insert error:", insertError);
        throw new AppError(i18next.t("scheduler.subtask.errors.createFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }
    }

    // 4. 重取全量子任务并按目标编排位置
    const { data: subtasks } = await supabase
      .from("task_subtasks")
      .select(
        "id, knowledge_point_id, learning_path_node_id, position",
      )
      .eq("task_id", taskId);

    const inPath = pathId && fullPathNodes.length > 0;
    const fallbackStart = inPath ? fullPathNodes.length : 0;
    const now = new Date().toISOString();

    for (const s of subtasks || []) {
      const kp = s.knowledge_point_id as string | null;
      const pathNode = inPath && kp ? kpToPathNode.get(kp) : undefined;
      const baseIndex = kp ? targetKps.findIndex((t) => t.id === kp) : -1;

      const position = pathNode
        ? pathNode.orderIndex
        : fallbackStart + Math.max(0, baseIndex);
      const learningPathNodeId = pathNode ? pathNode.id : null;

      await supabase
        .from("task_subtasks")
        .update({
          position,
          priority: position,
          learning_path_node_id: learningPathNodeId,
          updated_at: now,
        })
        .eq("id", s.id);
    }

    // 5. 重置模式：仅重置完成状态
    if (mode === "reset") {
      await supabase
        .from("task_subtasks")
        .update({ status: "pending", completed_at: null, updated_at: now })
        .eq("task_id", taskId);
    }

    // 6. 持久化当前编排的学习路径（图任务）
    if (graphId) {
      await supabase
        .from("user_tasks")
        .update({
          active_learning_path_id: pathId ?? null,
          updated_at: now,
        })
        .eq("id", taskId);
    }

    const subtaskList = await this.list(supabase, userId, taskId);
    return { subtasks: subtaskList, activePathId: pathId ?? null };
  }

  /**
   * 查询图谱内全部知识点（含可读标题），按 graph_nodes.created_at 排序作为默认编排来源
   */
  private async getGraphKps(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<Array<{ id: string; title: string }>> {
    const { data, error } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points!inner(id, title)
      `,
      )
      .eq("graph_id", graphId)
      .order("created_at", { ascending: true })
      );

    if (error) {
      logger.error("Refresh subtasks: getGraphKps error:", error);
      return [];
    }

    return (data || [])
      .filter((gn) => gn.knowledge_points)
      .map((gn) => {
        const kp = gn.knowledge_points as unknown as {
          id: string;
          title: string | Record<string, string> | null;
        };
        return {
          id: gn.knowledge_point_id,
          title: resolveLocalizedText(kp.title),
        };
      });
  }

  /**
   * 从 JOIN 查询结果中读取 mastery_level（单一来源：knowledge_points）
   */
  private readMasteryFromJoin(raw: unknown): number {
    const r = raw as { knowledge_points?: { mastery_level: number | null }[] | null };
    return r.knowledge_points?.[0]?.mastery_level ?? 0;
  }

  /**
   * 将 JOIN 查询结果扁平化，把 knowledge_points.mastery_level 提升到顶层
   * 保持 task_subtasks 返回结构与原有 API 契约一致
   */
  private flattenSubtaskMastery<T extends Record<string, unknown>>(
    raw: T | null,
  ): T & { mastery_level: number } {
    const r = (raw ?? {}) as T & {
      knowledge_points?: { mastery_level: number | null }[] | null;
    };
    const { knowledge_points, ...rest } = r;
    return {
      ...rest,
      mastery_level: knowledge_points?.[0]?.mastery_level ?? 0,
    } as T & { mastery_level: number };
  }
}

export const subtaskService = new SubtaskService();
