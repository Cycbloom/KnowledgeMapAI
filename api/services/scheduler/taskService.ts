import { SupabaseClient } from "@supabase/supabase-js";
import {
  getPaginationParams,
  PaginationOptions,
} from "../../utils/pagination.js";
import type {
  ScheduledTask,
  TaskExecution,
  TaskSettings,
  CreateTaskData,
  TaskFilters,
} from "../../../shared/types/index.js";

export type {
  ScheduledTask,
  TaskExecution,
  TaskSettings,
  CreateTaskData,
  TaskFilters,
};

export class TaskService {
  async createTask(
    client: SupabaseClient,
    userId: string,
    taskData: CreateTaskData,
  ): Promise<ScheduledTask> {
    const { data: maxPosResult } = await client
      .from("scheduled_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("queue_level", 0)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const { data, error } = await client
      .from("scheduled_tasks")
      .insert({
        user_id: userId,
        title: taskData.title,
        description: taskData.description,
        queue_level: 0,
        position: nextPosition,
        estimated_duration: taskData.estimated_duration,
        deadline: taskData.deadline,
        tags: taskData.tags || [],
        knowledge_point_id: taskData.knowledge_point_id,
        priority: taskData.priority ?? 0,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data as ScheduledTask;
  }

  async updateTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    updates: Partial<
      Omit<ScheduledTask, "id" | "user_id" | "created_at" | "updated_at">
    >,
  ): Promise<ScheduledTask> {
    const { data, error } = await client
      .from("scheduled_tasks")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw new Error(`Failed to update task: ${error.message}`);
    if (!data) throw new Error("Task not found");
    return data as ScheduledTask;
  }

  async deleteTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await client
      .from("scheduled_tasks")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }

  async getTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<ScheduledTask | null> {
    const { data, error } = await client
      .from("scheduled_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch task: ${error.message}`);
    }
    return data as ScheduledTask | null;
  }

  async getTasks(
    client: SupabaseClient,
    userId: string,
    filters?: TaskFilters,
    options?: PaginationOptions,
  ): Promise<{ tasks: ScheduledTask[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from("scheduled_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("queue_level", { ascending: true })
      .order("position", { ascending: true })
      .range(offset, end);

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.queue_level !== undefined) {
      query = query.eq("queue_level", filters.queue_level);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains("tags", filters.tags);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return { tasks: data as ScheduledTask[], total: count ?? 0 };
  }

  async getTasksByQueue(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
  ): Promise<ScheduledTask[]> {
    const { data, error } = await client
      .from("scheduled_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("queue_level", queueLevel)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (error)
      throw new Error(`Failed to fetch tasks by queue: ${error.message}`);
    return data as ScheduledTask[];
  }

  async startTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<{ task: ScheduledTask; execution: TaskExecution }> {
    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError)
      throw new Error(`Failed to start task: ${taskError.message}`);

    const { data: execution, error: execError } = await client
      .from("task_executions")
      .insert({
        task_id: taskId,
        user_id: userId,
        started_at: new Date().toISOString(),
        queue_level: task.queue_level,
        status: "completed",
      })
      .select()
      .single();

    if (execError)
      throw new Error(`Failed to create execution: ${execError.message}`);

    return {
      task: task as ScheduledTask,
      execution: execution as TaskExecution,
    };
  }

  async pauseTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<ScheduledTask> {
    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError)
      throw new Error(`Failed to pause task: ${taskError.message}`);
    return task as ScheduledTask;
  }

  async completeTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<ScheduledTask> {
    const { data: executions, error: execError } = await client
      .from("task_executions")
      .select("*")
      .eq("task_id", taskId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (execError)
      throw new Error(`Failed to fetch executions: ${execError.message}`);

    if (executions && executions.length > 0) {
      const execution = executions[0];
      const endedAt = new Date();
      const startedAt = new Date(execution.started_at);
      const duration = Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000,
      );

      await client
        .from("task_executions")
        .update({
          ended_at: endedAt.toISOString(),
          duration,
        })
        .eq("id", execution.id);
    }

    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError)
      throw new Error(`Failed to complete task: ${taskError.message}`);
    return task as ScheduledTask;
  }

  async moveTaskToQueue(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    targetQueue: number,
  ): Promise<ScheduledTask> {
    const { data: maxPosResult } = await client
      .from("scheduled_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("queue_level", targetQueue)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const { data, error } = await client
      .from("scheduled_tasks")
      .update({
        queue_level: targetQueue,
        position: nextPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw new Error(`Failed to move task: ${error.message}`);
    return data as ScheduledTask;
  }

  async reorderTasks(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
    taskIds: string[],
  ): Promise<void> {
    for (let i = 0; i < taskIds.length; i++) {
      const { error } = await client
        .from("scheduled_tasks")
        .update({
          position: i,
          queue_level: queueLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskIds[i])
        .eq("user_id", userId);

      if (error) throw new Error(`Failed to reorder tasks: ${error.message}`);
    }
  }

  async demoteTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<ScheduledTask> {
    const { data: task } = await client
      .from("scheduled_tasks")
      .select("queue_level")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (!task) throw new Error("Task not found");

    const newQueue = Math.min(task.queue_level + 1, 2);
    return this.moveTaskToQueue(client, taskId, userId, newQueue);
  }

  async getTimeSlice(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
  ): Promise<number> {
    const { data: settings, error } = await client
      .from("task_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !settings) {
      return 25 * 60;
    }

    switch (queueLevel) {
      case 0:
        return settings.q0_time_slice;
      case 1:
        return settings.q1_time_slice;
      case 2:
        return settings.q2_time_slice;
      default:
        return settings.q0_time_slice;
    }
  }
}

export const taskService = new TaskService();
