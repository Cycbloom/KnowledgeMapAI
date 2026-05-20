import { request } from "../../client";
import type {
  CreateReviewTaskData,
  UpdateReviewTaskData,
} from "@shared/types";

export type {
  ReviewTask,
  CreateReviewTaskData,
  UpdateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
} from "@shared/types";

export const studyReviewApi = {
  createFirstReviewTask: (data: CreateReviewTaskData) =>
    request("/scheduler/review-tasks", { method: "POST", body: JSON.stringify(data) }),

  updateReviewTask: (knowledgePointId: string, data: UpdateReviewTaskData) =>
    request(`/scheduler/review-tasks/${knowledgePointId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getPendingReviewTasks: (limit?: number) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append("limit", limit.toString());
    const queryString = params.toString();
    return request(`/scheduler/review-tasks/pending${queryString ? `?${queryString}` : ""}`);
  },

  getReviewTaskStats: () => request("/scheduler/review-tasks/stats"),

  getReviewTaskByKnowledgePoint: (knowledgePointId: string) =>
    request(`/scheduler/review-tasks/${knowledgePointId}`),

  deleteReviewTask: (knowledgePointId: string) =>
    request(`/scheduler/review-tasks/${knowledgePointId}`, { method: "DELETE" }),
};
