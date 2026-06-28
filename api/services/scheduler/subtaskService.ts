import { SupabaseClient } from "@supabase/supabase-js";
import { subtaskStateMachine } from "./subtaskStateMachine";
import { subtaskKnowledgeSyncService } from "./subtaskKnowledgeSync";
import { logger } from "../../utils/logger";
import type { LearningState } from "../../../shared/types/scheduler";
import { notDeleted } from '../common/softDeleteHelper';

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
      throw new Error("任务不存在");
    }

    const { data: subtasks, error } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get subtasks error:", error);
      throw new Error("获取子任务列表失败");
    }

    return subtasks;
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
      throw new Error("任务不存在");
    }

    const { data: existingSubtask } = await supabase
      .from("task_subtasks")
      .select("id")
      .eq("task_id", taskId)
      .eq("knowledge_point_id", data.knowledge_point_id)
      .maybeSingle();

    if (existingSubtask) {
      throw new Error("该知识点已关联到此任务");
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
        mastery_level: 0,
        last_state_change_at: new Date().toISOString(),
        state_history: [],
      })
      .select()
      .single();

    if (error) {
      logger.error("Create subtask error:", error);
      throw new Error("创建子任务失败");
    }

    return subtask;
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
      throw new Error("任务不存在");
    }

    if (updates.status === "completed") {
      (updates as Record<string, unknown>).completed_at =
        new Date().toISOString();
    }

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .select()
      .single();

    if (error) {
      logger.error("Update subtask error:", error);
      throw new Error("更新子任务失败");
    }

    if (!subtask) {
      throw new Error("子任务不存在");
    }

    if (subtask.learning_path_node_id && updates.status === "completed") {
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

    if (updates.learning_state || updates.mastery_level !== undefined) {
      try {
        await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
          supabase,
          subtaskId,
          updates.learning_state || subtask.learning_state,
          updates.mastery_level ?? subtask.mastery_level,
        );
      } catch (syncError) {
        logger.error("Failed to sync with knowledge point:", syncError);
      }
    }

    return subtask;
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
      throw new Error("删除子任务失败");
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
      throw new Error("任务不存在");
    }

    const { data: subtask, error: fetchError } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .single();

    if (fetchError || !subtask) {
      throw new Error("子任务不存在");
    }

    const currentState = subtask.learning_state as LearningState;

    if (!subtaskStateMachine.canTransition(currentState, toState)) {
      const validTransitions =
        subtaskStateMachine.getValidTransitions(currentState);
      const error = new Error(
        `无效的状态转换: ${currentState} → ${toState}`,
      ) as Error & { validTransitions?: LearningState[] };
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
      throw new Error(result.error || "状态转换失败");
    }

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      toState,
      masteryLevel,
    );

    return result.subtask;
  }

  async updateMastery(
    supabase: SupabaseClient,
    _userId: string,
    taskId: string,
    subtaskId: string,
    masteryLevel: number,
  ) {
    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({
        mastery_level: masteryLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .select()
      .single();

    if (error || !subtask) {
      throw new Error("更新掌握度失败");
    }

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      subtask.learning_state,
      masteryLevel,
    );

    return subtask;
  }

  async getValidTransitions(
    supabase: SupabaseClient,
    _userId: string,
    taskId: string,
    subtaskId: string,
  ): Promise<ValidTransitionsResult> {
    const { data: subtask } = await supabase
      .from("task_subtasks")
      .select("learning_state, mastery_level, state_history")
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .single();

    if (!subtask) {
      throw new Error("子任务不存在");
    }

    const currentState = subtask.learning_state as LearningState;
    const validTransitions =
      subtaskStateMachine.getValidTransitions(currentState);
    const recommendedNext = subtaskStateMachine.getRecommendedNextState(
      currentState,
      subtask.mastery_level,
      subtask.state_history || [],
    );

    return {
      current_state: currentState,
      mastery_level: subtask.mastery_level,
      valid_transitions: validTransitions,
      recommended_next: recommendedNext,
    };
  }
}

export const subtaskService = new SubtaskService();
