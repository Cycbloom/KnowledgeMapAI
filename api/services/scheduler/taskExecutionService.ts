import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import i18next from "i18next";
import { notDeleted } from '../common/softDeleteHelper';

class TaskExecutionService {
  async listByTask(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
  ) {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(i18next.t("scheduler.api.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: executions, error } = await supabase
      .from("task_executions")
      .select("*")
      .eq("task_id", taskId)
      .order("started_at", { ascending: false });

    if (error) {
      throw new AppError(i18next.t("scheduler.api.errors.getExecutionFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return executions;
  }

  async list(
    supabase: SupabaseClient,
    userId: string,
    options?: { task_id?: string; limit?: number; offset?: number },
  ) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = supabase
      .from("task_executions")
      .select("*, user_tasks(title, queue_level)", { count: "exact" })
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (options?.task_id) {
      query = query.eq("task_id", options.task_id);
    }

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      throw new AppError(i18next.t("scheduler.api.errors.getExecutionHistoryFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return { data: data || [], total: count ?? 0 };
  }

  async get(
    supabase: SupabaseClient,
    userId: string,
    executionId: string,
  ) {
    const { data: execution, error } = await supabase
      .from("task_executions")
      .select("*, user_tasks(title, description, queue_level)")
      .eq("id", executionId)
      .eq("user_id", userId)
      .single();

    if (error || !execution) {
      throw new AppError(i18next.t("scheduler.api.errors.executionNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return execution;
  }
}

export const taskExecutionService = new TaskExecutionService();
