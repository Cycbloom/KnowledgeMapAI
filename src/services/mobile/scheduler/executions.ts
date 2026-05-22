import { withClientAndUser, withClientOptionalUser } from "../utils/clientHelper";
import type { TaskExecution } from "@shared/types";

export const getExecutions = async (filters?: {
  task_id?: string;
  from_date?: string;
  to_date?: string;
}): Promise<TaskExecution[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    let query = client
      .from("task_executions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (filters?.task_id) {
      query = query.eq("task_id", filters.task_id);
    }
    if (filters?.from_date) {
      query = query.gte("started_at", filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte("started_at", filters.to_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data as TaskExecution[] | null) ?? [];
  });
};

export const createExecution = async (data: {
  task_id: string;
  started_at: string;
  queue_level: number;
}): Promise<TaskExecution> => {
  return withClientAndUser(async (client, userId) => {
    const { data: result, error } = await client
      .from("task_executions")
      .insert({
        user_id: userId,
        task_id: data.task_id,
        started_at: data.started_at,
        queue_level: data.queue_level,
        status: "completed",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskExecution;
  });
};
