import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import i18next from "i18next";

interface DependencyRecord {
  id: string;
  dependency_type: string;
  created_at: string;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    queue_level: number;
    priority: number;
  };
}

interface CreateDependencyData {
  depends_on_task_id: string;
  dependency_type?: string;
}

class TaskDependencyService {
  async listDependencies(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
  ): Promise<DependencyRecord[]> {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .maybeSingle();

    if (!task) {
      throw new AppError(i18next.t("scheduler.dependency.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: dependencies, error } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, depends_on_task_id, user_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("task_id", taskId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Get dependencies error:", error);
      throw new AppError(i18next.t("scheduler.dependency.errors.fetchDependenciesFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return (dependencies || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: Array.isArray(dep.user_tasks) ? dep.user_tasks[0] : dep.user_tasks,
    }));
  }

  async listDependents(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
  ): Promise<DependencyRecord[]> {
    const { data: task } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .maybeSingle();

    if (!task) {
      throw new AppError(i18next.t("scheduler.dependency.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: dependents, error } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, task_id, user_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("depends_on_task_id", taskId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Get dependents error:", error);
      throw new AppError(i18next.t("scheduler.dependency.errors.fetchDependentsFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return (dependents || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: Array.isArray(dep.user_tasks) ? dep.user_tasks[0] : dep.user_tasks,
    }));
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    data: CreateDependencyData,
  ) {
    if (taskId === data.depends_on_task_id) {
      throw new AppError(i18next.t("scheduler.dependency.errors.selfDependency"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data: tasks, error: tasksError } = await notDeleted(supabase
      .from("user_tasks")
      .select("id")
      .in("id", [taskId, data.depends_on_task_id])
      .eq("user_id", userId)
      );

    if (tasksError) {
      throw new AppError(i18next.t("scheduler.dependency.errors.queryFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!tasks || tasks.length !== 2) {
      throw new AppError(i18next.t("scheduler.dependency.errors.tasksNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: existingDep } = await supabase
      .from("task_dependencies")
      .select("id")
      .eq("task_id", taskId)
      .eq("depends_on_task_id", data.depends_on_task_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingDep) {
      throw new AppError(i18next.t("scheduler.dependency.errors.dependencyExists"), 409, ErrorCodes.DATABASE_DUPLICATE_ENTRY);
    }

    const hasCircular = await this.checkCircularDependency(
      supabase,
      taskId,
      data.depends_on_task_id,
      userId,
    );

    if (hasCircular) {
      throw new AppError(i18next.t("scheduler.dependency.errors.cycleDetected"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data: dependency, error } = await supabase
      .from("task_dependencies")
      .insert({
        task_id: taskId,
        depends_on_task_id: data.depends_on_task_id,
        dependency_type: data.dependency_type ?? "strict",
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create dependency error:", error);
      throw new AppError(i18next.t("scheduler.dependency.errors.createFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return dependency;
  }

  async delete(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    dependencyId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("task_dependencies")
      .delete()
      .eq("id", dependencyId)
      .eq("task_id", taskId)
      .eq("user_id", userId);

    if (error) {
      throw new AppError(i18next.t("scheduler.dependency.errors.deleteFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async checkCircularDependency(
    supabase: SupabaseClient,
    taskId: string,
    dependsOnTaskId: string,
    userId: string,
  ): Promise<boolean> {
    const visited = new Set<string>();
    const queue: string[] = [dependsOnTaskId];

    while (queue.length > 0) {
      const currentTaskId = queue.shift();

      if (!currentTaskId) {
        break;
      }

      if (currentTaskId === taskId) {
        return true;
      }

      if (visited.has(currentTaskId)) {
        continue;
      }
      visited.add(currentTaskId);

      const { data: dependencies } = await supabase
        .from("task_dependencies")
        .select("depends_on_task_id")
        .eq("task_id", currentTaskId)
        .eq("user_id", userId);

      for (const dep of dependencies || []) {
        if (!visited.has(dep.depends_on_task_id)) {
          queue.push(dep.depends_on_task_id);
        }
      }
    }

    return false;
  }
}

export const taskDependencyService = new TaskDependencyService();
