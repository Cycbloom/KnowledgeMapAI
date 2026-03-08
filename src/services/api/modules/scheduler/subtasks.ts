import { request } from "../../client.js";

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
  created_at: string;
  updated_at: string;
}

export const subtasksApi = {
  getSubtasks: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/subtasks`),

  createSubtask: (
    taskId: string,
    data: {
      title: string;
      description?: string;
      priority?: number;
      estimated_duration?: number;
      due_date?: string;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSubtask: (
    taskId: string,
    subtaskId: string,
    data: {
      title?: string;
      description?: string;
      status?: "pending" | "in_progress" | "completed";
      priority?: number;
      estimated_duration?: number;
      actual_duration?: number;
      due_date?: string | null;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSubtask: (taskId: string, subtaskId: string) =>
    request(`/scheduler/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    }),
};
