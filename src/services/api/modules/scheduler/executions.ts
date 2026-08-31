import { requestData } from "../../client";
import type { ActivityKind, TaskExecution } from "@shared/types";
import type { ExecutionFilters } from "./tasks";

export interface StartActivityData {
  task_id?: string;
  subtask_id?: string;
  knowledge_point_id?: string;
  stage?: ActivityKind;
  kind: ActivityKind;
}

export interface AppendActivityData {
  execution_id: string;
  task_id?: string;
  subtask_id?: string;
  knowledge_point_id?: string;
  stage?: ActivityKind;
  kind: ActivityKind;
}

export interface EndActivityData {
  execution_id: string;
}

export type { ActivityKind } from "@shared/types";

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

  /** 会话：进入学习/答题即计时。返回新建或延续的会话（无关联任务时为 null）。 */
  startSession: (data: StartActivityData) =>
    requestData<TaskExecution | null>("/scheduler/executions/session/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 会话：会话内追加活动片段（切知识点 / 学习↔做题）。 */
  appendSessionActivity: (data: AppendActivityData) =>
    requestData<TaskExecution>("/scheduler/executions/session/append", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 会话：离开学习/答题界面时结束会话并结算时长。 */
  endSession: (executionId: string) =>
    requestData<TaskExecution>("/scheduler/executions/session/end", {
      method: "POST",
      body: JSON.stringify({ execution_id: executionId }),
    }),
};
