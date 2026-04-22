import { request } from "../../client";
import type { ActivityEventType } from "../../../../types/calendar";

export interface RecordActivityData {
  activity_type: ActivityEventType;
  title: string;
  description?: string;
  started_at?: string;
  ended_at?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  knowledge_point_id?: string;
  graph_id?: string;
  task_id?: string;
}

export interface GetActivitiesOptions {
  from_date?: string;
  to_date?: string;
  activity_type?: ActivityEventType;
  knowledge_point_id?: string;
  graph_id?: string;
  limit?: number;
  offset?: number;
}

export interface AutoGenerateTaskData {
  type: "focus_study" | "review" | "path_progress";
  knowledge_point_id: string;
  graph_id?: string;
  path_node_id?: string;
  parent_task_id?: string;
  title?: string;
  interval_days?: number;
  estimated_time?: number;
}

export const activitiesApi = {
  recordActivity: (data: RecordActivityData) =>
    request("/scheduler/activities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getActivities: (options?: GetActivitiesOptions) => {
    const params = new URLSearchParams();
    if (options?.from_date) params.append("from_date", options.from_date);
    if (options?.to_date) params.append("to_date", options.to_date);
    if (options?.activity_type)
      params.append("activity_type", options.activity_type);
    if (options?.knowledge_point_id)
      params.append("knowledge_point_id", options.knowledge_point_id);
    if (options?.graph_id) params.append("graph_id", options.graph_id);
    if (options?.limit) params.append("limit", String(options.limit));
    if (options?.offset) params.append("offset", String(options.offset));
    const queryString = params.toString();
    return request(
      `/scheduler/activities${queryString ? `?${queryString}` : ""}`,
    );
  },

  getDailyActivities: (date: string) =>
    request(`/scheduler/activities/daily/${date}`),

  getActivityStats: (startDate: string, endDate: string) =>
    request(
      `/scheduler/activities/stats?start_date=${startDate}&end_date=${endDate}`,
    ),

  endActivity: (id: string, endedAt?: string, duration?: number) =>
    request(`/scheduler/activities/${id}/end`, {
      method: "PUT",
      body: JSON.stringify({ ended_at: endedAt, duration }),
    }),

  autoGenerateTask: (data: AutoGenerateTaskData) =>
    request("/scheduler/activities/auto-generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  linkTask: (knowledgePointId: string, title?: string, graphId?: string) => {
    const params = new URLSearchParams();
    params.append("knowledge_point_id", knowledgePointId);
    if (title) params.append("title", encodeURIComponent(title));
    if (graphId) params.append("graph_id", graphId);
    return request(`/scheduler/activities/link-task?${params.toString()}`);
  },

  linkTaskForGraph: (graphId: string) => {
    const params = new URLSearchParams();
    params.append("graph_id", graphId);
    return request(`/scheduler/activities/link-task?${params.toString()}`);
  },
};
