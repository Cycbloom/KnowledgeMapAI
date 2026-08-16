import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from '../common/softDeleteHelper';

export interface HourlyEfficiency {
  [hour: number]: number;
}

export interface TagEfficiencyData {
  avgDuration: number;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
}

export interface QueueEfficiencyData {
  avgDuration: number;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
}

export interface UserEfficiencyProfile {
  id: string;
  user_id: string;
  hourly_efficiency: HourlyEfficiency;
  tag_efficiency: Record<string, TagEfficiencyData>;
  queue_efficiency: Record<string, QueueEfficiencyData>;
  peak_hours: number[];
  low_hours: number[];
  last_updated: string;
}

export interface TaskCompletionData {
  taskId: string;
  userId: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  tags: string[];
  queueLevel: number;
}

export class EfficiencyService {
  async recordTaskCompletion(
    client: SupabaseClient,
    data: TaskCompletionData,
  ): Promise<void> {
    await this.updateHourlyEfficiency(client, data.userId);

    for (const tag of data.tags) {
      await this.updateTagEfficiency(client, data.userId, tag);
    }

    await this.updateQueueEfficiency(client, data.userId, data.queueLevel);

    await this.updateUserEfficiencyProfile(client, data.userId);
  }

  private async updateHourlyEfficiency(
    client: SupabaseClient,
    userId: string,
  ): Promise<void> {
    const { data: executions, error } = await client
      .from("task_executions")
      .select("started_at, ended_at")
      .eq("user_id", userId)
      .not("ended_at", "is", null);

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    const hourStats: Record<number, { started: number; completed: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourStats[h] = { started: 0, completed: 0 };
    }

    for (const exec of executions) {
      const startHour = new Date(exec.started_at).getHours();
      hourStats[startHour].started++;
      
      if (exec.ended_at) {
        const endHour = new Date(exec.ended_at).getHours();
        hourStats[endHour].completed++;
      }
    }

    const hourlyEfficiency: HourlyEfficiency = {};
    for (let h = 0; h < 24; h++) {
      const stats = hourStats[h];
      hourlyEfficiency[h] = stats.started > 0 
        ? stats.completed / stats.started 
        : 0;
    }

    const { data: profile } = await client
      .from("user_efficiency_profile")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (profile) {
      await client
        .from("user_efficiency_profile")
        .update({
          hourly_efficiency: hourlyEfficiency,
          last_updated: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await client.from("user_efficiency_profile").insert({
        user_id: userId,
        hourly_efficiency: hourlyEfficiency,
        tag_efficiency: {},
        queue_efficiency: {},
        peak_hours: [],
        low_hours: [],
        last_updated: new Date().toISOString(),
      });
    }
  }

  private async updateTagEfficiency(
    client: SupabaseClient,
    userId: string,
    tag: string,
  ): Promise<void> {
    const { data: tasks, error } = await notDeleted(client
      .from("user_tasks")
      .select("id, status, tags, completed_at")
      .eq("user_id", userId)
      .contains("tags", [tag])
      );

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    const taskIds = tasks.map((t) => t.id);
    let avgDuration = 0;

    if (taskIds.length > 0) {
      const { data: executions } = await client
        .from("task_executions")
        .select("duration")
        .in("task_id", taskIds)
        .not("duration", "is", null);

      if (executions && executions.length > 0) {
        const totalDuration = executions.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        );
        avgDuration = totalDuration / executions.length;
      }
    }

    const tagEfficiency: TagEfficiencyData = {
      avgDuration,
      completionRate,
      totalTasks,
      completedTasks,
    };

    const { data: profile } = await client
      .from("user_efficiency_profile")
      .select("id, tag_efficiency")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const currentTagEfficiency = profile.tag_efficiency as Record<string, TagEfficiencyData> || {};
      currentTagEfficiency[tag] = tagEfficiency;

      await client
        .from("user_efficiency_profile")
        .update({
          tag_efficiency: currentTagEfficiency,
          last_updated: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      const tagEfficiencyMap: Record<string, TagEfficiencyData> = {};
      tagEfficiencyMap[tag] = tagEfficiency;

      await client.from("user_efficiency_profile").insert({
        user_id: userId,
        hourly_efficiency: {},
        tag_efficiency: tagEfficiencyMap,
        queue_efficiency: {},
        peak_hours: [],
        low_hours: [],
        last_updated: new Date().toISOString(),
      });
    }
  }

  private async updateQueueEfficiency(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
  ): Promise<void> {
    const { data: tasks, error } = await notDeleted(client
      .from("user_tasks")
      .select("id, status, queue_level, completed_at")
      .eq("user_id", userId)
      .eq("queue_level", queueLevel)
      );

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    const taskIds = tasks.map((t) => t.id);
    let avgDuration = 0;

    if (taskIds.length > 0) {
      const { data: executions } = await client
        .from("task_executions")
        .select("duration")
        .in("task_id", taskIds)
        .not("duration", "is", null);

      if (executions && executions.length > 0) {
        const totalDuration = executions.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        );
        avgDuration = totalDuration / executions.length;
      }
    }

    const queueEfficiency: QueueEfficiencyData = {
      avgDuration,
      completionRate,
      totalTasks,
      completedTasks,
    };

    const { data: profile } = await client
      .from("user_efficiency_profile")
      .select("id, queue_efficiency")
      .eq("user_id", userId)
      .single();

    const queueKey = String(queueLevel);

    if (profile) {
      const currentQueueEfficiency = profile.queue_efficiency as Record<string, QueueEfficiencyData> || {};
      currentQueueEfficiency[queueKey] = queueEfficiency;

      await client
        .from("user_efficiency_profile")
        .update({
          queue_efficiency: currentQueueEfficiency,
          last_updated: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      const queueEfficiencyMap: Record<string, QueueEfficiencyData> = {};
      queueEfficiencyMap[queueKey] = queueEfficiency;

      await client.from("user_efficiency_profile").insert({
        user_id: userId,
        hourly_efficiency: {},
        tag_efficiency: {},
        queue_efficiency: queueEfficiencyMap,
        peak_hours: [],
        low_hours: [],
        last_updated: new Date().toISOString(),
      });
    }
  }

  async calculateHourlyEfficiency(
    client: SupabaseClient,
    userId: string,
  ): Promise<HourlyEfficiency> {
    const { data: executions, error } = await client
      .from("task_executions")
      .select("started_at, ended_at")
      .eq("user_id", userId)
      .not("ended_at", "is", null);

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    const hourStats: Record<number, { started: number; completed: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourStats[h] = { started: 0, completed: 0 };
    }

    for (const exec of executions) {
      const startHour = new Date(exec.started_at).getHours();
      hourStats[startHour].started++;

      if (exec.ended_at) {
        const endHour = new Date(exec.ended_at).getHours();
        hourStats[endHour].completed++;
      }
    }

    const hourlyEfficiency: HourlyEfficiency = {};
    for (let h = 0; h < 24; h++) {
      const stats = hourStats[h];
      hourlyEfficiency[h] = stats.started > 0 ? stats.completed / stats.started : 0;
    }

    return hourlyEfficiency;
  }

  async calculateQueueEfficiency(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
  ): Promise<QueueEfficiencyData> {
    const { data: tasks, error } = await notDeleted(client
      .from("user_tasks")
      .select("id, status, queue_level")
      .eq("user_id", userId)
      .eq("queue_level", queueLevel)
      );

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    const taskIds = tasks.map((t) => t.id);
    let avgDuration = 0;

    if (taskIds.length > 0) {
      const { data: executions } = await client
        .from("task_executions")
        .select("duration")
        .in("task_id", taskIds)
        .not("duration", "is", null);

      if (executions && executions.length > 0) {
        const totalDuration = executions.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        );
        avgDuration = totalDuration / executions.length;
      }
    }

    return {
      avgDuration,
      completionRate,
      totalTasks,
      completedTasks,
    };
  }

  async getUserEfficiencyProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<UserEfficiencyProfile | null> {
    const { data, error } = await client
      .from("user_efficiency_profile")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return data as UserEfficiencyProfile | null;
  }

  async updateUserEfficiencyProfile(
    client: SupabaseClient,
    userId: string,
  ): Promise<UserEfficiencyProfile> {
    const hourlyEfficiency = await this.calculateHourlyEfficiency(client, userId);

    const { data: allTasks } = await notDeleted(client
      .from("user_tasks")
      .select("id, status, tags")
      .eq("user_id", userId)
      );

    const uniqueTags = new Set<string>();
    const tasksByTag = new Map<string, Array<{ id: string; status: string }>>();
    const allTaskIds: string[] = [];

    for (const task of allTasks ?? []) {
      allTaskIds.push(task.id);
      if (task.tags && Array.isArray(task.tags)) {
        for (const tag of task.tags) {
          uniqueTags.add(tag);
          const list = tasksByTag.get(tag) ?? [];
          list.push({ id: task.id, status: task.status });
          tasksByTag.set(tag, list);
        }
      }
    }

    // 单次批量查询所有任务执行时长，替代逐 tag 查询（O(T) 次 → 1 次），再内存分组计算
    const durationByTaskId = new Map<string, number[]>();
    if (allTaskIds.length > 0) {
      const { data: executions } = await client
        .from("task_executions")
        .select("task_id, duration")
        .in("task_id", allTaskIds)
        .not("duration", "is", null);

      for (const exec of executions ?? []) {
        const list = durationByTaskId.get(exec.task_id) ?? [];
        list.push(exec.duration ?? 0);
        durationByTaskId.set(exec.task_id, list);
      }
    }

    const tagEfficiency: Record<string, TagEfficiencyData> = {};
    for (const tag of uniqueTags) {
      const tasks = tasksByTag.get(tag) ?? [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "completed").length;
      const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

      const durations = tasks.flatMap((t) => durationByTaskId.get(t.id) ?? []);
      const avgDuration =
        durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0;

      tagEfficiency[tag] = {
        avgDuration,
        completionRate,
        totalTasks,
        completedTasks,
      };
    }

    const queueEfficiency: Record<string, QueueEfficiencyData> = {};
    for (let q = 0; q <= 2; q++) {
      queueEfficiency[String(q)] = await this.calculateQueueEfficiency(
        client,
        userId,
        q,
      );
    }

    const sortedHours = Object.entries(hourlyEfficiency)
      .filter(([, efficiency]) => efficiency > 0)
      .sort((a, b) => b[1] - a[1]);

    const peakHours = sortedHours.slice(0, 3).map(([hour]) => parseInt(hour, 10));
    const lowHours = sortedHours
      .slice(-3)
      .reverse()
      .map(([hour]) => parseInt(hour, 10));

    const { data: existingProfile } = await client
      .from("user_efficiency_profile")
      .select("id")
      .eq("user_id", userId)
      .single();

    let profile: UserEfficiencyProfile;

    if (existingProfile) {
      const { data, error } = await client
        .from("user_efficiency_profile")
        .update({
          hourly_efficiency: hourlyEfficiency,
          tag_efficiency: tagEfficiency,
          queue_efficiency: queueEfficiency,
          peak_hours: peakHours,
          low_hours: lowHours,
          last_updated: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
          details: { originalError: error.message },
        });
      }
      profile = data as UserEfficiencyProfile;
    } else {
      const { data, error } = await client
        .from("user_efficiency_profile")
        .insert({
          user_id: userId,
          hourly_efficiency: hourlyEfficiency,
          tag_efficiency: tagEfficiency,
          queue_efficiency: queueEfficiency,
          peak_hours: peakHours,
          low_hours: lowHours,
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
          details: { originalError: error.message },
        });
      }
      profile = data as UserEfficiencyProfile;
    }

    return profile;
  }
}

export const efficiencyService = new EfficiencyService();
