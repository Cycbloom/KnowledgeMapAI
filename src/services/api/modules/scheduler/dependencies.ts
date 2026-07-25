import { requestData } from "../../client";
import type { TaskDependency } from "@shared/types";

export const dependenciesApi = {
  addTaskDependency: (
    taskId: string,
    data: { depends_on_task_id: string; dependency_type?: "strict" | "soft" },
  ) =>
    requestData<TaskDependency>(`/scheduler/tasks/${taskId}/dependencies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeTaskDependency: (taskId: string, dependencyId: string) =>
    requestData<void>(`/scheduler/tasks/${taskId}/dependencies/${dependencyId}`, {
      method: "DELETE",
    }),

  getTaskDependencies: (taskId: string) =>
    requestData<TaskDependency[]>(`/scheduler/tasks/${taskId}/dependencies`),

  getTaskDependents: (taskId: string) =>
    requestData<TaskDependency[]>(`/scheduler/tasks/${taskId}/dependents`),
};
