import { withClient } from "../utils/clientHelper";
import type { TaskDependency } from "@shared/types";

export const getTaskDependencies = async (taskId: string): Promise<TaskDependency[]> => {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("task_dependencies")
      .select("*")
      .eq("task_id", taskId);

    if (error) {
      throw new Error(error.message);
    }

    return (data as TaskDependency[] | null) ?? [];
  });
};

export const addTaskDependency = async (
  taskId: string,
  data: { depends_on_task_id: string; dependency_type?: "strict" | "soft" },
): Promise<TaskDependency> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_dependencies")
      .insert({
        task_id: taskId,
        depends_on_task_id: data.depends_on_task_id,
        dependency_type: data.dependency_type ?? "soft",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskDependency;
  });
};

export const removeTaskDependency = async (_taskId: string, dependencyId: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("task_dependencies").delete().eq("id", dependencyId);

    if (error) {
      throw new Error(error.message);
    }
  });
};
