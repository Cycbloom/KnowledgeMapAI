import { request } from "../../client";
import type { Queue, CreateQueueData, UpdateQueueData } from "@shared/types";

export type { Queue, CreateQueueData, UpdateQueueData };

export interface GetQueuesOptions {
  includeCompleted?: boolean;
  includeCancelled?: boolean;
}

export const queuesApi = {
  getQueues: (options?: GetQueuesOptions) => {
    const params = new URLSearchParams();
    if (options?.includeCompleted) {
      params.append("include_completed", "true");
    }
    if (options?.includeCancelled) {
      params.append("include_cancelled", "true");
    }
    const queryString = params.toString();
    return request(`/scheduler/queues${queryString ? `?${queryString}` : ""}`);
  },

  createQueue: (data: CreateQueueData) =>
    request("/scheduler/queues", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQueue: (id: string, data: UpdateQueueData) =>
    request(`/scheduler/queues/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteQueue: (id: string, targetQueueId?: string) =>
    request(`/scheduler/queues/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ target_queue_id: targetQueueId }),
    }),

  reorderQueues: (queueIds: string[]) =>
    request("/scheduler/queues/reorder", {
      method: "PUT",
      body: JSON.stringify({ queue_ids: queueIds }),
    }),
};
