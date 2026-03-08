import { request } from "../../client.js";

export const dependenciesApi = {
  addTaskDependency: (
    taskId: string,
    data: { depends_on_task_id: string; dependency_type?: "strict" | "soft" },
  ) =>
    request(`/scheduler/tasks/${taskId}/dependencies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeTaskDependency: (taskId: string, dependencyId: string) =>
    request(`/scheduler/tasks/${taskId}/dependencies/${dependencyId}`, {
      method: "DELETE",
    }),

  getTaskDependencies: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dependencies`),

  getTaskDependents: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dependents`),
};
