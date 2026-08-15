import { withClient, withClientAndUser, withClientOptionalUser } from "../utils/clientHelper";
import type {
  Queue,
  CreateQueueData,
  UpdateQueueData,
  QueueData,
  UserTask,
} from "@shared/types";
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const getQueues = async (): Promise<Queue[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    const { data, error } = await client
      .from("queues")
      .select("*")
      .eq("user_id", userId)
      .order("priority", { ascending: true });

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data as Queue[] | null) ?? [];
  });
};

export const createQueue = async (data: CreateQueueData): Promise<Queue> => {
  return withClientAndUser(async (client, userId) => {
    const { data: result, error } = await client
      .from("queues")
      .insert({
        user_id: userId,
        name: data.name,
        color: data.color || "#3b82f6",
        time_slice: data.time_slice || 25,
        priority: data.priority,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as Queue;
  });
};

export const updateQueue = async (id: string, data: UpdateQueueData): Promise<Queue> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("queues")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as Queue;
  });
};

export const deleteQueue = async (id: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("queues").delete().eq("id", id);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }
  });
};

export const getQueueData = async (): Promise<QueueData> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return { q0: [], q1: [], q2: [] };
    }

    const { data, error } = await client
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    const tasks = (data as UserTask[] | null) ?? [];
    // 单趟 for 分组，避免三次 filter 重复扫描同一数组（原为 O(3n)，现 O(n)）
    const q0: UserTask[] = [];
    const q1: UserTask[] = [];
    const q2: UserTask[] = [];
    for (const t of tasks) {
      if (t.queue_level === 0) q0.push(t);
      else if (t.queue_level === 1) q1.push(t);
      else if (t.queue_level === 2) q2.push(t);
    }
    return { q0, q1, q2 };
  });
};
