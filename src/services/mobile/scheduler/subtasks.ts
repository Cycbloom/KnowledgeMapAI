import { withClient } from "../utils/clientHelper";
import type { TaskSubtask } from "@shared/types";

export const getSubtasks = async (taskId: string): Promise<TaskSubtask[]> => {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("task_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as TaskSubtask[] | null) ?? [];
  });
};

export const createSubtask = async (data: {
  task_id: string;
  title: string;
  description?: string;
}): Promise<TaskSubtask> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_subtasks")
      .insert({
        task_id: data.task_id,
        title: data.title,
        description: data.description,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSubtask;
  });
};

export const updateSubtask = async (
  id: string,
  data: { title?: string; status?: string }
): Promise<TaskSubtask> => {
  return withClient(async (client) => {
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: result, error } = await client
      .from("task_subtasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSubtask;
  });
};

export const deleteSubtask = async (id: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("task_subtasks").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  });
};
