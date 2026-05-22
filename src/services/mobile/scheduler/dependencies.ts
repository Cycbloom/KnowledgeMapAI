import { withClient } from "../utils/clientHelper";
import type { TaskDependency } from "@shared/types";

export const getDependencies = async (taskId: string): Promise<TaskDependency[]> => {
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

export const createDependency = async (data: {
  task_id: string;
  depends_on_task_id: string;
  dependency_type?: string;
}): Promise<TaskDependency> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_dependencies")
      .insert({
        task_id: data.task_id,
        depends_on_task_id: data.depends_on_task_id,
        dependency_type: data.dependency_type || "soft",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskDependency;
  });
};

export const deleteDependency = async (id: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("task_dependencies").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  });
};
