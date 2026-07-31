import { SupabaseClient } from "@supabase/supabase-js";
import type {
  SystemTask,
  CreateSystemTaskData,
  SystemTaskStatus,
} from "../../../shared/types/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import i18next from "i18next";

const DEFAULT_PRIORITY = 5;
const DEFAULT_MAX_RETRIES = 3;

export class SystemTaskService {
  async createTask(
    supabase: SupabaseClient,
    userId: string,
    data: CreateSystemTaskData,
  ): Promise<SystemTask> {
    const taskData = {
      user_id: userId,
      task_type: data.task_type,
      title: data.title,
      description: data.description,
      status: "pending" as SystemTaskStatus,
      priority: data.priority ?? DEFAULT_PRIORITY,
      input_data: data.input_data ?? {},
      output_data: {},
      retry_count: 0,
      max_retries: data.max_retries ?? DEFAULT_MAX_RETRIES,
      scheduled_at: data.scheduled_at,
    };

    const { data: task, error } = await supabase
      .from("system_tasks")
      .insert(taskData)
      .select()
      .single();

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
        details: { originalError: error.message },
      });
    }

    logger.info("System task created", {
      userId,
      taskId: task.id,
      taskType: data.task_type,
      priority: taskData.priority,
    });

    return task as SystemTask;
  }

  async getPendingTasks(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<SystemTask[]> {
    const now = new Date().toISOString();

    const { data: tasks, error } = await supabase
      .from("system_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (tasks as SystemTask[]) ?? [];
  }

  async getTasks(
    supabase: SupabaseClient,
    userId: string,
    options?: { status?: SystemTaskStatus; limit?: number },
  ): Promise<SystemTask[]> {
    let query = supabase
      .from("system_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: tasks, error } = await query;

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (tasks as SystemTask[]) ?? [];
  }

  async getTaskById(
    supabase: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<SystemTask | null> {
    const { data: task, error } = await supabase
      .from("system_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return task as SystemTask;
  }

  async startTask(supabase: SupabaseClient, taskId: string): Promise<void> {
    const { data: task, error: fetchError } = await supabase
      .from("system_tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: fetchError.message },
      });
    }

    if (task.status !== "pending") {
      throw new AppError(ErrorCodes.VALIDATION_INVALID_PARAMS, {
        details: {
          message: i18next.t("scheduler.systemTask.errors.cannotStartTask", { current: task.status, expected: "pending" }),
        },
      });
    }

    const { error: updateError } = await supabase
      .from("system_tasks")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateError.message },
      });
    }

    logger.info("System task started", { taskId });
  }

  async completeTask(
    supabase: SupabaseClient,
    taskId: string,
    output?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await supabase
      .from("system_tasks")
      .update({
        status: "completed",
        output_data: output ?? {},
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    logger.info("System task completed", {
      taskId,
      hasOutput: !!output,
    });
  }

  async failTask(
    supabase: SupabaseClient,
    taskId: string,
    error: string,
  ): Promise<void> {
    const { data: task, error: fetchError } = await supabase
      .from("system_tasks")
      .select("retry_count, max_retries")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: fetchError.message },
      });
    }

    const shouldRetry = task.retry_count < task.max_retries;
    const newStatus = shouldRetry ? "pending" : "failed";

    const { error: updateError } = await supabase
      .from("system_tasks")
      .update({
        status: newStatus,
        error_message: error,
        retry_count: shouldRetry ? task.retry_count + 1 : task.retry_count,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateError.message },
      });
    }

    logger.warn("System task failed", {
      taskId,
      error,
      retryCount: task.retry_count,
      maxRetries: task.max_retries,
      willRetry: shouldRetry,
    });
  }

  async retryTask(supabase: SupabaseClient, taskId: string): Promise<void> {
    const { data: task, error: fetchError } = await supabase
      .from("system_tasks")
      .select("status, retry_count, max_retries")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: fetchError.message },
      });
    }

    if (task.status !== "failed") {
      throw new AppError(ErrorCodes.VALIDATION_INVALID_PARAMS, {
        details: {
          message: i18next.t("scheduler.systemTask.errors.cannotRetryTask", { current: task.status }),
        },
      });
    }

    if (task.retry_count >= task.max_retries) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        details: {
          message: i18next.t("scheduler.systemTask.errors.maxRetriesReached"),
        },
      });
    }

    const { error: updateError } = await supabase
      .from("system_tasks")
      .update({
        status: "pending",
        retry_count: task.retry_count + 1,
        error_message: null,
        started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateError.message },
      });
    }

    logger.info("System task retry initiated", {
      taskId,
      retryCount: task.retry_count + 1,
      maxRetries: task.max_retries,
    });
  }

  async cancelTask(supabase: SupabaseClient, taskId: string): Promise<void> {
    const { data: task, error: fetchError } = await supabase
      .from("system_tasks")
      .select("status")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: fetchError.message },
      });
    }

    if (task.status === "completed") {
      throw new AppError(ErrorCodes.VALIDATION_INVALID_PARAMS, {
        details: {
          message: i18next.t("scheduler.systemTask.errors.cannotCancelCompletedTask"),
        },
      });
    }

    const { error: updateError } = await supabase
      .from("system_tasks")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateError.message },
      });
    }

    logger.info("System task cancelled", { taskId });
  }

  async getTasksByType(
    supabase: SupabaseClient,
    userId: string,
    taskType: string,
  ): Promise<SystemTask[]> {
    const { data: tasks, error } = await supabase
      .from("system_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("task_type", taskType)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (tasks as SystemTask[]) ?? [];
  }

  async getTaskStats(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const { data: tasks, error } = await supabase
      .from("system_tasks")
      .select("status")
      .eq("user_id", userId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    const stats = {
      total: tasks?.length ?? 0,
      pending: 0,
      in_progress: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of tasks ?? []) {
      const status = task.status as SystemTaskStatus;
      if (status in stats) {
        stats[status]++;
      }
    }

    return stats;
  }

  async cleanupOldTasks(
    supabase: SupabaseClient,
    userId: string,
    daysToKeep: number = 30,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data: deletedTasks, error } = await supabase
      .from("system_tasks")
      .delete()
      .eq("user_id", userId)
      .in("status", ["completed", "failed", "cancelled"])
      .lt("completed_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    const deletedCount = deletedTasks?.length ?? 0;

    if (deletedCount > 0) {
      logger.info("Cleaned up old system tasks", {
        userId,
        deletedCount,
        daysToKeep,
      });
    }

    return deletedCount;
  }
}

export const systemTaskService = new SystemTaskService();
