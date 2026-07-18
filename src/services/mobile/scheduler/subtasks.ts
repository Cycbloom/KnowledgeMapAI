import { withClient } from "../utils/clientHelper";
import type { TaskSubtask } from "@shared/types";
import { AppError, SharedErrorCodes } from "@/utils/errors";

type SubtaskWithJoin = Omit<TaskSubtask, "mastery_level"> & {
  knowledge_points: { mastery_level: number | null }[] | null;
};

function flattenSubtask(raw: SubtaskWithJoin): TaskSubtask {
  const { knowledge_points, ...rest } = raw;
  return {
    ...rest,
    mastery_level: knowledge_points?.[0]?.mastery_level ?? 0,
  } as TaskSubtask;
}

export const getSubtasks = async (taskId: string): Promise<TaskSubtask[]> => {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("task_subtasks")
      .select("*, knowledge_points(mastery_level)")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return ((data ?? []) as SubtaskWithJoin[]).map(flattenSubtask);
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
      .select("*, knowledge_points(mastery_level)")
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return flattenSubtask(result as SubtaskWithJoin);
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
      .select("*, knowledge_points(mastery_level)")
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return flattenSubtask(result as SubtaskWithJoin);
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
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }
  });
};
