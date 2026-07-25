import { requestData } from "../../client";
import type { TaskExecution } from "@shared/types";
import type { ExecutionFilters } from "./tasks";

export const executionsApi = {
  getExecutions: (filters?: ExecutionFilters) => {
    const params = new URLSearchParams();
    if (filters?.task_id) params.append("task_id", filters.task_id);
    if (filters?.from_date) params.append("from_date", filters.from_date);
    if (filters?.to_date) params.append("to_date", filters.to_date);
    if (filters?.status) params.append("status", filters.status);
    const queryString = params.toString();
    return requestData<TaskExecution[]>(
      `/scheduler/executions${queryString ? `?${queryString}` : ""}`,
    );
  },

  getTaskExecutions: (taskId: string) =>
    requestData<TaskExecution[]>(`/scheduler/tasks/${taskId}/executions`),
};
