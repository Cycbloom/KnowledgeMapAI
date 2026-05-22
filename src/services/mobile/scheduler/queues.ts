import { withClient, withClientAndUser, withClientOptionalUser } from "../utils/clientHelper";
import type {
  Queue,
  CreateQueueData,
  UpdateQueueData,
  QueueData,
  UserTask,
} from "@shared/types";

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
      throw new Error(error.message);
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
      throw new Error(error.message);
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
      throw new Error(error.message);
    }

    return result as Queue;
  });
};

export const deleteQueue = async (id: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("queues").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
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
      throw new Error(error.message);
    }

    const tasks = (data as UserTask[] | null) ?? [];
    return {
      q0: tasks.filter((t) => t.queue_level === 0),
      q1: tasks.filter((t) => t.queue_level === 1),
      q2: tasks.filter((t) => t.queue_level === 2),
    };
  });
};
