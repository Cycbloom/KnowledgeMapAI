import { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from '../common/softDeleteHelper';

export interface UserTaskSchedulerStats {
  total_tasks: number;
  completed_tasks: number;
  total_duration: number;
  by_queue: {
    q0: { count: number; duration: number };
    q1: { count: number; duration: number };
    q2: { count: number; duration: number };
  };
  by_status: Record<string, number>;
  daily: Array<{
    date: string;
    completed: number;
    duration: number;
  }>;
}

export interface HeatmapData {
  date: string;
  count: number;
  duration: number;
}

export class StatsService {
  async getStats(
    client: SupabaseClient,
    userId: string,
    period: "day" | "week" | "month" = "week",
  ): Promise<UserTaskSchedulerStats> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    const { data: tasks, error: tasksError } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      )
      .gte("created_at", startDate.toISOString());

    if (tasksError)
      {throw new Error(`Failed to fetch tasks: ${tasksError.message}`);}

    const { data: executions, error: execError } = await client
      .from("task_executions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString());

    if (execError)
      {throw new Error(`Failed to fetch executions: ${execError.message}`);}

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const totalDuration = executions.reduce(
      (sum, e) => sum + (e.duration || 0),
      0,
    );

    const byQueue = {
      q0: { count: 0, duration: 0 },
      q1: { count: 0, duration: 0 },
      q2: { count: 0, duration: 0 },
    };

    tasks.forEach((t) => {
      const queueKey = `q${t.queue_level}` as keyof typeof byQueue;
      byQueue[queueKey].count++;
    });

    executions.forEach((e) => {
      const queueKey = `q${e.queue_level}` as keyof typeof byQueue;
      byQueue[queueKey].duration += e.duration || 0;
    });

    const byStatus: Record<string, number> = {};
    tasks.forEach((t) => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    const daily: UserTaskSchedulerStats["daily"] = [];
    const daysCount = period === "day" ? 1 : period === "week" ? 7 : 30;

    // 预建按天索引，避免内层按天 filter 重复扫描（O(days×(tasks+exec)) → O(n)）
    const completedByDate = new Map<string, number>();
    for (const t of tasks) {
      if (t.completed_at) {
        const key = t.completed_at.split("T")[0];
        completedByDate.set(key, (completedByDate.get(key) || 0) + 1);
      }
    }
    const durationByDate = new Map<string, number>();
    for (const e of executions) {
      const key = e.started_at.split("T")[0];
      durationByDate.set(key, (durationByDate.get(key) || 0) + (e.duration || 0));
    }

    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split("T")[0];

      daily.push({
        date: dateStr,
        completed: completedByDate.get(dateStr) || 0,
        duration: durationByDate.get(dateStr) || 0,
      });
    }

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_duration: totalDuration,
      by_queue: byQueue,
      by_status: byStatus,
      daily,
    };
  }

  async getHeatmapData(
    client: SupabaseClient,
    userId: string,
    year?: number,
    month?: number,
  ): Promise<HeatmapData[]> {
    const targetYear = year ?? new Date().getFullYear();
    const targetMonth = month;

    let startDate: Date;
    let endDate: Date;

    if (targetMonth !== undefined) {
      startDate = new Date(targetYear, targetMonth - 1, 1);
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }

    const { data: executions, error } = await client
      .from("task_executions")
      .select("started_at, duration")
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString())
      .lte("started_at", endDate.toISOString());

    if (error)
      {throw new Error(`Failed to fetch heatmap data: ${error.message}`);}

    const groupedByDate: Record<string, { count: number; duration: number }> =
      {};

    executions.forEach((e) => {
      const dateStr = e.started_at.split("T")[0];
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { count: 0, duration: 0 };
      }
      groupedByDate[dateStr].count++;
      groupedByDate[dateStr].duration += e.duration || 0;
    });

    return Object.entries(groupedByDate)
      .map(([date, data]) => ({
        date,
        count: data.count,
        duration: data.duration,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const statsService = new StatsService();
