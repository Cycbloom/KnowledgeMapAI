import { requestData } from "../../client";
import type { Queue, CreateQueueData, UpdateQueueData, QueueData } from "@shared/types";

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
    return requestData<QueueData>(`/scheduler/queues${queryString ? `?${queryString}` : ""}`);
  },

  createQueue: (data: CreateQueueData) =>
    requestData<Queue>("/scheduler/queues", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQueue: (id: string, data: UpdateQueueData) =>
    requestData<Queue>(`/scheduler/queues/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteQueue: (id: string, targetQueueId?: string) =>
    requestData<void>(`/scheduler/queues/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ target_queue_id: targetQueueId }),
    }),

  reorderQueues: (queueIds: string[]) =>
    requestData<void>("/scheduler/queues/reorder", {
      method: "PUT",
      body: JSON.stringify({ queue_ids: queueIds }),
    }),
};
