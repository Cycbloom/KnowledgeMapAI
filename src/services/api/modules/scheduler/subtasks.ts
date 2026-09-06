import { requestData } from "../../client";
import type {
  TaskSubtask,
  CreateSubtaskData,
  UpdateSubtaskData,
  TransitionSubtaskData,
} from "@shared/types";
import type { LearningState, StateHistoryEntry } from "@shared/types/scheduler";

// Re-export for backwards compatibility with existing imports.
export type { TaskSubtask, CreateSubtaskData, UpdateSubtaskData, TransitionSubtaskData };

export interface ValidTransitionsResult {
  current_state: LearningState;
  mastery_level: number;
  valid_transitions: LearningState[];
  recommended_next: LearningState;
}

// StateHistoryEntry is re-exported for consumers that already import it from
// this module; the canonical type lives in @shared/types/scheduler.
export type { StateHistoryEntry };

export const subtasksApi = {
  getSubtasks: (taskId: string): Promise<TaskSubtask[]> =>
    requestData<TaskSubtask[]>(`/scheduler/tasks/${taskId}/subtasks`),

  /**
   * 刷新/重建子任务：自动补齐缺失子任务 + 按学习路径重排 +（可选）重置完成状态。
   * pathId 不传=不按路径（展示全部知识点子任务）。
   */
  refreshSubtasks: (
    taskId: string,
    data: { mode?: "sync" | "reset"; path_id?: string | null },
  ): Promise<{ subtasks: TaskSubtask[]; activePathId: string | null }> =>
    requestData<{ subtasks: TaskSubtask[]; activePathId: string | null }>(
      `/scheduler/tasks/${taskId}/subtasks/refresh`,
      { method: "POST", body: JSON.stringify(data) },
    ),

  createSubtask: (taskId: string, data: CreateSubtaskData): Promise<TaskSubtask> =>
    requestData<TaskSubtask>(`/scheduler/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSubtask: (
    taskId: string,
    subtaskId: string,
    data: UpdateSubtaskData,
  ): Promise<TaskSubtask> =>
    requestData<TaskSubtask>(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSubtask: (taskId: string, subtaskId: string): Promise<void> =>
    requestData<void>(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    }),

  transitionSubtask: (
    taskId: string,
    subtaskId: string,
    data: TransitionSubtaskData,
  ): Promise<TaskSubtask> =>
    requestData<TaskSubtask>(
      `/scheduler/tasks/${taskId}/subtasks/${subtaskId}/transition`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  updateMastery: (
    taskId: string,
    subtaskId: string,
    masteryLevel: number,
  ): Promise<TaskSubtask> =>
    requestData<TaskSubtask>(
      `/scheduler/tasks/${taskId}/subtasks/${subtaskId}/mastery`,
      {
        method: "PATCH",
        body: JSON.stringify({ mastery_level: masteryLevel }),
      },
    ),

  getValidTransitions: (
    taskId: string,
    subtaskId: string,
  ): Promise<ValidTransitionsResult> =>
    requestData<ValidTransitionsResult>(
      `/scheduler/tasks/${taskId}/subtasks/${subtaskId}/valid-transitions`,
    ),
};
