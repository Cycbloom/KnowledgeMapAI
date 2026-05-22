import { withClientOptionalUser } from "../utils/clientHelper";
import type { UserTaskStats, HeatmapData } from "@shared/types";
import type { TaskExecutionRow } from "@shared/types/database";

interface TaskStatsRow {
  status: string;
  queue_level: number;
  actual_duration: number | null;
}

export const getStats = async (): Promise<UserTaskStats> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return {
        total_tasks: 0,
        completed_tasks: 0,
        total_duration: 0,
        avg_duration: 0,
        completion_rate: 0,
        tasks_by_queue: { q0: 0, q1: 0, q2: 0 },
        tasks_by_status: {},
      };
    }

    const { data: tasks } = await client
      .from("user_tasks")
      .select("status, queue_level, actual_duration")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const taskRows = (tasks as TaskStatsRow[] | null) ?? [];
    const totalTasks = taskRows.length;
    const completedTasks = taskRows.filter((t) => t.status === "completed").length;
    const totalDuration = taskRows.reduce((sum, t) => sum + (t.actual_duration ?? 0), 0);

    const tasksByQueue = { q0: 0, q1: 0, q2: 0 };
    const tasksByStatus: Record<string, number> = {};

    taskRows.forEach((t) => {
      if (t.queue_level === 0) tasksByQueue.q0++;
      else if (t.queue_level === 1) tasksByQueue.q1++;
      else if (t.queue_level === 2) tasksByQueue.q2++;

      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_duration: totalDuration,
      avg_duration: totalTasks > 0 ? totalDuration / totalTasks : 0,
      completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      tasks_by_queue: tasksByQueue,
      tasks_by_status: tasksByStatus,
    };
  });
};

export const getHeatmap = async (): Promise<HeatmapData[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    const { data: executions } = await client
      .from("task_executions")
      .select("started_at, duration")
      .eq("user_id", userId);

    const executionRows = (executions as Pick<TaskExecutionRow, "started_at" | "duration">[] | null) ?? [];
    const heatmapMap = new Map<string, { count: number; duration: number }>();

    executionRows.forEach((e) => {
      const date = e.started_at?.split("T")[0];
      if (date) {
        const existing = heatmapMap.get(date) || { count: 0, duration: 0 };
        heatmapMap.set(date, {
          count: existing.count + 1,
          duration: existing.duration + (e.duration ?? 0),
        });
      }
    });

    return Array.from(heatmapMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      duration: data.duration,
    }));
  });
};
