import { withClient } from "../utils/clientHelper";
import type { TaskLink } from "@shared/types";
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const getLinks = async (taskId: string): Promise<TaskLink[]> => {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("task_links")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data as TaskLink[] | null) ?? [];
  });
};

export const createLink = async (
  _taskId: string,
  data: {
    link_type?: string;
    title?: string;
    url: string;
    description?: string;
    icon?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<TaskLink> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_links")
      .insert({
        task_id: _taskId,
        link_type: data.link_type || "web",
        title: data.title,
        url: data.url,
        description: data.description,
        icon: data.icon,
        metadata: data.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as TaskLink;
  });
};

export const updateLink = async (
  _taskId: string,
  linkId: string,
  data: {
    title?: string;
    description?: string;
    icon?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<TaskLink> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_links")
      .update(data)
      .eq("id", linkId)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as TaskLink;
  });
};

export const deleteLink = async (_taskId: string, linkId: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("task_links").delete().eq("id", linkId);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }
  });
};
