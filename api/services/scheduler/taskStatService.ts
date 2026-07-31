import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import i18next from "i18next";

interface StatsResult {
  total_tasks: number;
  total_duration: number;
  queue_stats: {
    q0: number;
    q1: number;
    q2: number;
  };
  period: string;
  start_date: string;
  end_date: string;
}

interface HeatmapEntry {
  date: string;
  count: number;
  total_duration: number;
}

class TaskStatService {
  async getStats(
    supabase: SupabaseClient,
    userId: string,
    period: "day" | "week" | "month",
  ): Promise<StatsResult> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const { data: completedTasks, error: tasksError } = await supabase
      .from("user_tasks")
      .select("id, actual_duration, queue_level, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", startDate.toISOString());

    if (tasksError) {
      throw new AppError(i18next.t("scheduler.api.errors.getStatsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { data: executions, error: execError } = await supabase
      .from("task_executions")
      .select("duration, status")
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString());

    if (execError) {
      throw new AppError(i18next.t("scheduler.api.errors.getExecutionStatsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const totalTasks = completedTasks?.length ?? 0;
    const totalDuration =
      executions?.reduce((sum, e) => sum + (e.duration ?? 0), 0) ?? 0;

    const queueStats = {
      q0: completedTasks?.filter((t) => t.queue_level === 0).length ?? 0,
      q1: completedTasks?.filter((t) => t.queue_level === 1).length ?? 0,
      q2: completedTasks?.filter((t) => t.queue_level === 2).length ?? 0,
    };

    return {
      total_tasks: totalTasks,
      total_duration: totalDuration,
      queue_stats: queueStats,
      period,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
    };
  }

  async getHeatmap(
    supabase: SupabaseClient,
    userId: string,
    year?: number,
    month?: number,
  ): Promise<HeatmapEntry[]> {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = month
      ? new Date(targetYear, month - 1, 1)
      : new Date(targetYear, 0, 1);
    const endDate = month
      ? new Date(targetYear, month, 0)
      : new Date(targetYear, 11, 31);

    const { data: executions, error } = await supabase
      .from("task_executions")
      .select("started_at, duration")
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString())
      .lte("started_at", endDate.toISOString());

    if (error) {
      throw new AppError(i18next.t("scheduler.api.errors.getHeatmapFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const heatmapData: Record<
      string,
      { count: number; total_duration: number }
    > = {};

    for (const exec of executions ?? []) {
      const date = new Date(exec.started_at).toISOString().split("T")[0];
      if (!heatmapData[date]) {
        heatmapData[date] = { count: 0, total_duration: 0 };
      }
      heatmapData[date].count++;
      heatmapData[date].total_duration += exec.duration ?? 0;
    }

    return Object.entries(heatmapData).map(([date, data]) => ({
      date,
      count: data.count,
      total_duration: data.total_duration,
    }));
  }
}

export const taskStatService = new TaskStatService();
