import { request } from "../../client.js";
import type { Queue, CreateQueueData, UpdateQueueData } from "@shared/types";

export type { Queue, CreateQueueData, UpdateQueueData };

export const queuesApi = {
  getQueues: () => request("/scheduler/queues"),

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
