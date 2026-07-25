import { requestData } from "../../client";
import type {
  ActivityRecord,
  DailyActivityStats,
  RecordActivityData,
  GetActivitiesOptions,
  AutoGenerateTaskData,
  AutoTaskResult,
  LinkedTaskResult,
  GraphTaskInfo,
} from "@shared/types";

export type {
  RecordActivityData,
  GetActivitiesOptions,
  AutoGenerateTaskData,
} from "@shared/types";

export const activitiesApi = {
  recordActivity: (data: RecordActivityData) =>
    requestData<ActivityRecord>("/scheduler/activities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getActivities: (options?: GetActivitiesOptions) => {
    const params = new URLSearchParams();
    if (options?.from_date) params.append("from_date", options.from_date);
    if (options?.to_date) params.append("to_date", options.to_date);
    if (options?.activity_type)
      {params.append("activity_type", options.activity_type);}
    if (options?.knowledge_point_id)
      {params.append("knowledge_point_id", options.knowledge_point_id);}
    if (options?.graph_id) params.append("graph_id", options.graph_id);
    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.offset) params.append("offset", String(options.offset));
    const queryString = params.toString();
    return requestData<ActivityRecord[]>(
      `/scheduler/activities${queryString ? `?${queryString}` : ""}`,
    );
  },

  getDailyActivities: (date: string) =>
    requestData<ActivityRecord[]>(`/scheduler/activities/daily/${date}`),

  getActivityStats: (startDate: string, endDate: string) =>
    requestData<DailyActivityStats[]>(
      `/scheduler/activities/stats?start_date=${startDate}&end_date=${endDate}`,
    ),

  endActivity: (id: string, endedAt?: string, duration?: number) =>
    requestData<ActivityRecord>(`/scheduler/activities/${id}/end`, {
      method: "PUT",
      body: JSON.stringify({ ended_at: endedAt, duration }),
    }),

  autoGenerateTask: (data: AutoGenerateTaskData) =>
    requestData<AutoTaskResult>("/scheduler/activities/auto-generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  linkTask: (knowledgePointId: string, title?: string, graphId?: string) => {
    const params = new URLSearchParams();
    params.append("knowledge_point_id", knowledgePointId);
    if (title) params.append("title", encodeURIComponent(title));
    if (graphId) params.append("graph_id", graphId);
    return requestData<LinkedTaskResult | GraphTaskInfo>(`/scheduler/activities/link-task?${params.toString()}`);
  },

  linkTaskForGraph: (graphId: string) => {
    const params = new URLSearchParams();
    params.append("graph_id", graphId);
    return requestData<GraphTaskInfo>(`/scheduler/activities/link-task?${params.toString()}`);
  },
};
