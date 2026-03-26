import { SupabaseClient } from "@supabase/supabase-js";
import {
  getPaginationParams,
  PaginationOptions,
} from "../../utils/pagination";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export interface TaskExecution {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  queue_level: number;
  status: "completed" | "interrupted" | "time_slice_ended";
}

export interface ExecutionFilters {
  task_id?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
}

export class ExecutionService {
  async createExecution(
    client: SupabaseClient,
    executionData: Omit<TaskExecution, "id">,
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from("task_executions")
      .insert(executionData)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return data as TaskExecution;
  }

  async updateExecution(
    client: SupabaseClient,
    executionId: string,
    updates: Partial<Omit<TaskExecution, "id" | "task_id" | "user_id">>,
  ): Promise<TaskExecution> {
    const { data, error } = await client
      .from("task_executions")
      .update(updates)
      .eq("id", executionId)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    if (!data) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    return data as TaskExecution;
  }

  async getExecutions(
    client: SupabaseClient,
    userId: string,
    filters?: ExecutionFilters,
    options?: PaginationOptions,
  ): Promise<{ executions: TaskExecution[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from("task_executions")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .range(offset, end);

    if (filters?.task_id) {
      query = query.eq("task_id", filters.task_id);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.from_date) {
      query = query.gte("started_at", filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte("started_at", filters.to_date);
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return { executions: data as TaskExecution[], total: count || 0 };
  }
}

export const executionService = new ExecutionService();
