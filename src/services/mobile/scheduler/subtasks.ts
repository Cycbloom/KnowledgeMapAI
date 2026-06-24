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

export const createSubtask = async (
  taskId: string,
  data: { title: string; description?: string },
): Promise<TaskSubtask> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_subtasks")
      .insert({
        task_id: taskId,
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
  _taskId: string,
  subtaskId: string,
  data: { title?: string; status?: string },
): Promise<TaskSubtask> => {
  return withClient(async (client) => {
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: result, error } = await client
      .from("task_subtasks")
      .update(updateData)
      .eq("id", subtaskId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSubtask;
  });
};

export const deleteSubtask = async (
  _taskId: string,
  subtaskId: string,
): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client
      .from("task_subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      throw new Error(error.message);
    }
  });
};
