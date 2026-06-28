import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from '../common/softDeleteHelper';

export interface CreateTaskKPData {
  knowledge_point_id: string;
  relevance_score?: number;
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateTaskKPData {
  relevance_score?: number;
  is_primary?: boolean;
  notes?: string;
}

class TaskKnowledgePointService {
  async list(client: SupabaseClient, userId: string, taskId: string) {
    const { data: task } = await notDeleted(client
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND);
    }

    const { data: taskKPs, error } = await client
      .from("task_knowledge_points")
      .select(
        `
        *,
        knowledge_point:knowledge_points(id, title, content, visibility, owner_id)
      `,
      )
      .eq("task_id", taskId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Get task KPs error:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return taskKPs;
  }

  async create(
    client: SupabaseClient,
    userId: string,
    taskId: string,
    data: CreateTaskKPData,
  ) {
    const { data: task } = await notDeleted(client
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND);
    }

    const { data: kp } = await client
      .from("knowledge_points")
      .select("id, title, content")
      .eq("id", data.knowledge_point_id)
      .or(`visibility.eq.public,owner_id.eq.${userId}`)
      .single();

    if (!kp) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        details: { message: "知识点不存在或无权访问" },
      });
    }

    if (data.is_primary) {
      await client
        .from("task_knowledge_points")
        .update({ is_primary: false })
        .eq("task_id", taskId);
    }

    const { data: taskKP, error } = await client
      .from("task_knowledge_points")
      .insert({
        task_id: taskId,
        knowledge_point_id: data.knowledge_point_id,
        relevance_score: data.relevance_score ?? 100,
        is_primary: data.is_primary ?? false,
        notes: data.notes,
      })
      .select(
        `
        *,
        knowledge_point:knowledge_points(id, title, content, visibility)
      `,
      )
      .single();

    if (error) {
      logger.error("Create task KP error:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    return taskKP;
  }

  async update(
    client: SupabaseClient,
    userId: string,
    taskId: string,
    kpId: string,
    updates: UpdateTaskKPData,
  ) {
    const { data: task } = await notDeleted(client
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (!task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND);
    }

    if (updates.is_primary) {
      await client
        .from("task_knowledge_points")
        .update({ is_primary: false })
        .eq("task_id", taskId);
    }

    const { data: taskKP, error } = await client
      .from("task_knowledge_points")
      .update(updates)
      .eq("id", kpId)
      .eq("task_id", taskId)
      .select(
        `
        *,
        knowledge_point:knowledge_points(id, title, content, visibility)
      `,
      )
      .single();

    if (error) {
      logger.error("Update task KP error:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }

    if (!taskKP) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        details: { message: "知识点关联不存在" },
      });
    }

    return taskKP;
  }

  async delete(client: SupabaseClient, _userId: string, taskId: string, kpId: string) {
    const { error } = await client
      .from("task_knowledge_points")
      .delete()
      .eq("id", kpId)
      .eq("task_id", taskId);

    if (error) {
      logger.error("Delete task KP error:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: error.message },
      });
    }
  }
}

export const taskKnowledgePointService = new TaskKnowledgePointService();
