import { requestData } from "../../client";
import type {
  SyncStudyDurationData,
  SyncTaskCompletionData,
  BatchSyncStudyDurationItem,
  ProgressSyncResult,
  TaskProgressSummary,
  BatchSyncStudyDurationResult,
} from "@shared/types";

export type {
  SyncStudyDurationData,
  SyncTaskCompletionData,
  BatchSyncStudyDurationItem,
  TaskProgressSummary,
} from "@shared/types";

export const progressSyncApi = {
  syncStudyDuration: (data: SyncStudyDurationData) =>
    requestData<ProgressSyncResult>("/scheduler/progress/sync-duration", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  syncTaskCompletion: (data: SyncTaskCompletionData) =>
    requestData<ProgressSyncResult>("/scheduler/progress/sync-completion", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTaskProgressSummary: (taskId: string) =>
    requestData<TaskProgressSummary>(`/scheduler/progress/summary/${taskId}`),

  batchSyncStudyDuration: (items: BatchSyncStudyDurationItem[]) =>
    requestData<BatchSyncStudyDurationResult>("/scheduler/progress/batch-sync-duration", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
