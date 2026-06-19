import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export class TaskLinkService {
  async list(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
  ) {
    const { data: task } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (!task) {
      throw new AppError("任务不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: links, error } = await supabase
      .from("task_links")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get links error:", error);
      throw new AppError("获取链接列表失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return links;
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    data: {
      link_type?: string;
      title?: string;
      url: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const { data: task } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (!task) {
      throw new AppError("任务不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { count } = await supabase
      .from("task_links")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId);

    const { data: link, error } = await supabase
      .from("task_links")
      .insert({
        task_id: taskId,
        link_type: data.link_type,
        title: data.title || data.url,
        url: data.url,
        description: data.description,
        icon: data.icon,
        metadata: data.metadata || {},
        position: count ?? 0,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create link error:", error);
      throw new AppError("创建链接失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return link;
  }

  async update(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    linkId: string,
    updates: {
      title?: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const { data: task } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (!task) {
      throw new AppError("任务不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: link, error } = await supabase
      .from("task_links")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("task_id", taskId)
      .select()
      .single();

    if (error) {
      logger.error("Update link error:", error);
      throw new AppError("更新链接失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!link) {
      throw new AppError("链接不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return link;
  }

  async delete(
    supabase: SupabaseClient,
    _userId: string,
    taskId: string,
    linkId: string,
  ) {
    const { error } = await supabase
      .from("task_links")
      .delete()
      .eq("id", linkId)
      .eq("task_id", taskId);

    if (error) {
      logger.error("Delete link error:", error);
      throw new AppError("删除链接失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const taskLinkService = new TaskLinkService();
