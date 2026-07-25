import { requestData } from "../../client";
import type {
  CreateReviewTaskData,
  ReviewTask,
  ReviewTaskStats,
  PendingReviewTask,
} from "@shared/types";

export type {
  ReviewTask,
  CreateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
} from "@shared/types";

export const studyReviewApi = {
  createFirstReviewTask: (data: CreateReviewTaskData) =>
    requestData<ReviewTask>("/scheduler/review-tasks", { method: "POST", body: JSON.stringify(data) }),

  updateReviewTask: (knowledgePointId: string, data: { quality: number }) =>
    requestData<ReviewTask>(`/scheduler/review-tasks/${knowledgePointId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getPendingReviewTasks: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append("limit", limit.toString());
    const queryString = params.toString();
    return requestData<PendingReviewTask[]>(`/scheduler/review-tasks/pending${queryString ? `?${queryString}` : ""}`);
  },

  getReviewTaskStats: () => requestData<ReviewTaskStats>("/scheduler/review-tasks/stats"),

  getReviewTaskByKnowledgePoint: (knowledgePointId: string) =>
    requestData<ReviewTask | null>(`/scheduler/review-tasks/${knowledgePointId}`),

  deleteReviewTask: (knowledgePointId: string) =>
    requestData<void>(`/scheduler/review-tasks/${knowledgePointId}`, { method: "DELETE" }),
};
