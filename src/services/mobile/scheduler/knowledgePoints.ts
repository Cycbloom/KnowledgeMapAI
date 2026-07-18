import { withClient } from "../utils/clientHelper";
import type { TaskKnowledgePoint } from "@shared/types";
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const getTaskKnowledgePoints = async (taskId: string): Promise<TaskKnowledgePoint[]> => {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("task_knowledge_points")
      .select("*")
      .eq("task_id", taskId);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data as TaskKnowledgePoint[] | null) ?? [];
  });
};

export const addTaskKnowledgePoint = async (
  _taskId: string,
  data: {
    knowledge_point_id: string;
    relevance_score?: number;
    is_primary?: boolean;
    notes?: string;
  }
): Promise<TaskKnowledgePoint> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_knowledge_points")
      .insert({
        task_id: _taskId,
        knowledge_point_id: data.knowledge_point_id,
        relevance_score: data.relevance_score || 0,
        is_primary: data.is_primary || false,
        notes: data.notes,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as TaskKnowledgePoint;
  });
};

export const updateTaskKnowledgePoint = async (
  _taskId: string,
  kpId: string,
  data: {
    relevance_score?: number;
    is_primary?: boolean;
    notes?: string;
  }
): Promise<TaskKnowledgePoint> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("task_knowledge_points")
      .update(data)
      .eq("id", kpId)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as TaskKnowledgePoint;
  });
};

export const removeTaskKnowledgePoint = async (_taskId: string, kpId: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client.from("task_knowledge_points").delete().eq("id", kpId);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }
  });
};
