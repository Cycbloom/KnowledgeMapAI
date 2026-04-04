import { request } from "../../client";

export interface SyncStudyDurationData {
  taskId: string;
  duration: number;
  date?: string;
}

export interface SyncTaskCompletionData {
  taskId: string;
  completed: boolean;
  completedAt?: string;
}

export interface BatchSyncStudyDurationItem {
  taskId: string;
  duration: number;
  date?: string;
}

export interface TaskProgressSummary {
  taskId: string;
  totalDuration: number;
  completedDates: string[];
  streak: number;
  lastStudyDate: string | null;
}

export const progressSyncApi = {
  syncStudyDuration: (data: SyncStudyDurationData) =>
    request("/scheduler/progress/sync-duration", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  syncTaskCompletion: (data: SyncTaskCompletionData) =>
    request("/scheduler/progress/sync-completion", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTaskProgressSummary: (taskId: string) =>
    request(`/scheduler/progress/summary/${taskId}`),

  batchSyncStudyDuration: (items: BatchSyncStudyDurationItem[]) =>
    request("/scheduler/progress/batch-sync-duration", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
