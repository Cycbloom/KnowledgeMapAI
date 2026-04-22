import { request } from "../../client";
import type { LearningState, StateHistoryEntry } from "@shared/types/scheduler";

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority: number;
  position: number;
  estimated_duration?: number;
  actual_duration?: number;
  due_date?: string;
  completed_at?: string;
  learning_path_node_id?: string;
  knowledge_point_id: string;
  learning_state: LearningState;
  mastery_level: number;
  last_state_change_at: string;
  state_history: StateHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface CreateSubtaskData {
  title: string;
  description?: string;
  knowledge_point_id: string;
  priority?: number;
  estimated_duration?: number;
  due_date?: string;
}

export interface UpdateSubtaskData {
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

export interface TransitionSubtaskData {
  to_state: LearningState;
  mastery_level: number;
  reason?: string;
}

export interface ValidTransitionsResult {
  current_state: LearningState;
  mastery_level: number;
  valid_transitions: LearningState[];
  recommended_next: LearningState;
}

export const subtasksApi = {
  getSubtasks: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/subtasks`),

  createSubtask: (taskId: string, data: CreateSubtaskData) =>
    request(`/scheduler/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSubtask: (taskId: string, subtaskId: string, data: UpdateSubtaskData) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSubtask: (taskId: string, subtaskId: string) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    }),

  transitionSubtask: (taskId: string, subtaskId: string, data: TransitionSubtaskData) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}/transition`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMastery: (taskId: string, subtaskId: string, masteryLevel: number) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}/mastery`, {
      method: "PATCH",
      body: JSON.stringify({ mastery_level: masteryLevel }),
    }),

  getValidTransitions: (taskId: string, subtaskId: string): Promise<{ success: boolean; data: ValidTransitionsResult }> =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}/valid-transitions`),
};
