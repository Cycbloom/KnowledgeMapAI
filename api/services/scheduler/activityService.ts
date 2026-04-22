import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export type ActivityType = "focus_study" | "review" | "path_progress";

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  title: string;
  description?: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  knowledge_point_id?: string;
  graph_id?: string;
  task_id?: string;
  created_at: string;
}

export interface RecordActivityData {
  activity_type: ActivityType;
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

export interface DailyActivityStats {
  date: string;
  total_duration: number;
  activity_count: number;
  activities_by_type: Record<string, number>;
}

class ActivityService {
  async recordActivity(
    client: SupabaseClient,
    userId: string,
    data: RecordActivityData,
  ): Promise<UserActivity> {
    const { data: activity, error } = await client
      .from("user_activities")
      .insert({
        user_id: userId,
        activity_type: data.activity_type,
        title: data.title,
        description: data.description,
        started_at: data.started_at || new Date().toISOString(),
        ended_at: data.ended_at,
        duration: data.duration,
        metadata: data.metadata || {},
        knowledge_point_id: data.knowledge_point_id,
        graph_id: data.graph_id,
        task_id: data.task_id,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to record activity:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return activity as UserActivity;
  }

  async getActivities(
    client: SupabaseClient,
    userId: string,
    options?: {
      from_date?: string;
      to_date?: string;
      activity_type?: ActivityType;
      knowledge_point_id?: string;
      graph_id?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: UserActivity[]; total: number }> {
    let query = client
      .from("user_activities")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (options?.from_date) {
      query = query.gte("started_at", options.from_date);
    }
    if (options?.to_date) {
      query = query.lte("started_at", options.to_date);
    }
    if (options?.activity_type) {
      query = query.eq("activity_type", options.activity_type);
    }
    if (options?.knowledge_point_id) {
      query = query.eq("knowledge_point_id", options.knowledge_point_id);
    }
    if (options?.graph_id) {
      query = query.eq("graph_id", options.graph_id);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to get activities:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return { data: (data || []) as UserActivity[], total: count || 0 };
  }

  async getDailyActivities(
    client: SupabaseClient,
    userId: string,
    date: string,
  ): Promise<UserActivity[]> {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data, error } = await client
      .from("user_activities")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", startOfDay)
      .lte("started_at", endOfDay)
      .order("started_at", { ascending: true });

    if (error) {
      logger.error("Failed to get daily activities:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return (data || []) as UserActivity[];
  }

  async getActivityStats(
    client: SupabaseClient,
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyActivityStats[]> {
    const { data, error } = await client
      .from("user_activities")
      .select("started_at, activity_type, duration")
      .eq("user_id", userId)
      .gte("started_at", `${startDate}T00:00:00.000Z`)
      .lte("started_at", `${endDate}T23:59:59.999Z`);

    if (error) {
      logger.error("Failed to get activity stats:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    const statsMap = new Map<string, DailyActivityStats>();

    for (const activity of data || []) {
      const date = (activity.started_at as string).split("T")[0];
      const existing = statsMap.get(date) || {
        date,
        total_duration: 0,
        activity_count: 0,
        activities_by_type: {},
      };

      existing.total_duration += activity.duration || 0;
      existing.activity_count += 1;
      existing.activities_by_type[activity.activity_type] =
        (existing.activities_by_type[activity.activity_type] || 0) + 1;

      statsMap.set(date, existing);
    }

    return Array.from(statsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  async endActivity(
    client: SupabaseClient,
    userId: string,
    activityId: string,
    endedAt?: string,
    duration?: number,
  ): Promise<UserActivity> {
    const endTime = endedAt || new Date().toISOString();

    const updateData: Record<string, unknown> = { ended_at: endTime };
    if (duration !== undefined) {
      updateData.duration = duration;
    }

    const { data, error } = await client
      .from("user_activities")
      .update(updateData)
      .eq("id", activityId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to end activity:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return data as UserActivity;
  }
}

export const activityService = new ActivityService();
