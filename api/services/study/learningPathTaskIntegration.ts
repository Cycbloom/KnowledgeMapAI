import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type {
  LearningPathProgressSummary,
  LearningPathService,
} from "./learningPathService";
import { notDeleted } from '../common/softDeleteHelper';
import {
  formatLearningPathTaskTitle,
  formatNodeTaskTitle,
} from "../../../shared/constants/taskTitles";

/** 学习路径任务默认描述（后端不加载 locale，不能走 i18next 取 key） */
const PATH_TASK_DEFAULT_DESCRIPTION = "学习路径任务";

export class LearningPathTaskIntegration {
  private learningPathService: LearningPathService;

  constructor(learningPathService: LearningPathService) {
    this.learningPathService = learningPathService;
  }

  async createLearningPathMainTask(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      scheduled_start?: string;
      scheduled_end?: string;
    },
  ): Promise<string> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", 0)
      );

    const { data: nodes } = await supabase
      .from("learning_path_nodes")
      .select("estimated_time")
      .eq("path_id", pathId);

    const totalEstimatedTime =
      nodes?.reduce((sum, n) => sum + (n.estimated_time || 0), 0) || 0;

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: formatLearningPathTaskTitle(path.title),
        description:
          path.description ||
          path.goal ||
          PATH_TASK_DEFAULT_DESCRIPTION,
        queue_level: 0,
        position: count ?? 0,
        estimated_duration: totalEstimatedTime,
        task_type: "learning",
        status: "pending",
        scheduled_start: options?.scheduled_start,
        scheduled_end: options?.scheduled_end,
        context: JSON.stringify({
          type: "learning_path",
          path_id: pathId,
          path_title: path.title,
        }),
      })
      .select("id")
      .single();

    if (taskError) {
      logger.error("createLearningPathMainTask error:", taskError);
      throw new AppError(i18next.t("learningPath.api.errors.createMainTaskFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return task.id;
  }

  async convertNodeToSubtask(
    supabase: SupabaseClient,
    parentTaskId: string,
    nodeId: string,
    userId: string,
    position: number,
  ): Promise<string> {
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select(
        `
        id,
        path_id,
        title,
        description,
        estimated_time,
        knowledge_point_id,
        order_index,
        learning_paths!inner(user_id)
      `,
      )
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      throw new AppError(i18next.t("learningPath.api.errors.nodeNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const pathData = Array.isArray(node.learning_paths)
      ? node.learning_paths[0]
      : node.learning_paths;
    if (!pathData || pathData.user_id !== userId) {
      throw new AppError(i18next.t("learningPath.api.errors.nodeAccessDenied"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    if (!node.knowledge_point_id) {
      throw new AppError(
        i18next.t("learningPath.api.errors.createSubtaskFailed"),
        400,
        ErrorCodes.VALIDATION_MISSING_FIELD,
      );
    }

    const { data: subtask, error: subtaskError } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: parentTaskId,
        title: node.title,
        description: node.description,
        status: "pending",
        priority: node.order_index,
        position,
        estimated_duration: node.estimated_time,
        learning_path_node_id: node.id,
        knowledge_point_id: node.knowledge_point_id,
      })
      .select("id")
      .single();

    if (subtaskError) {
      logger.error("convertNodeToSubtask error:", subtaskError);
      throw new AppError(i18next.t("learningPath.api.errors.createSubtaskFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    return subtask.id;
  }

  async convertNodeToTask(
    supabase: SupabaseClient,
    nodeId: string,
    userId: string,
    options?: {
      queue_level?: number;
      scheduled_start?: string;
      scheduled_end?: string;
    },
  ): Promise<string> {
    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select(
        `
        id,
        path_id,
        title,
        description,
        estimated_time,
        knowledge_point_id,
        order_index,
        learning_paths!inner(user_id)
      `,
      )
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      throw new AppError(i18next.t("learningPath.api.errors.nodeNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const pathData = Array.isArray(node.learning_paths)
      ? node.learning_paths[0]
      : node.learning_paths;
    if (!pathData || pathData.user_id !== userId) {
      throw new AppError(i18next.t("learningPath.api.errors.nodeAccessDenied"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", options?.queue_level ?? 0)
      );

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: formatNodeTaskTitle(node.title),
        description: node.description,
        queue_level: options?.queue_level ?? 0,
        position: count ?? 0,
        estimated_duration: node.estimated_time,
        knowledge_point_id: node.knowledge_point_id,
        task_type: "learning",
        status: "pending",
        scheduled_start: options?.scheduled_start,
        scheduled_end: options?.scheduled_end,
        context: i18next.t("learningPath.api.taskIntegration.nodeTaskContext", { index: node.order_index + 1 }),
      })
      .select("id")
      .single();

    if (taskError) {
      logger.error("convertNodeToTask error:", taskError);
      throw new AppError(i18next.t("learningPath.api.errors.createTaskFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    await supabase.from("task_knowledge_points").insert({
      task_id: task.id,
      knowledge_point_id: node.knowledge_point_id,
      is_primary: true,
      relevance_score: 100,
    });

    return task.id;
  }

  async syncProgressWithTask(
    supabase: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<{
    node_updated: boolean;
    path_progress: LearningPathProgressSummary | null;
    path_completed: boolean;
  }> {
    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (taskError || !task) {
      throw new AppError(i18next.t("learningPath.api.errors.taskNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (task.status !== "completed") {
      return {
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    if (!task.knowledge_point_id) {
      return {
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    const { data: node, error: nodeError } = await supabase
      .from("learning_path_nodes")
      .select(
        `
        id,
        path_id,
        knowledge_point_id,
        status,
        learning_paths!inner(user_id)
      `,
      )
      .eq("knowledge_point_id", task.knowledge_point_id)
      .eq("status", "in_progress")
      .single();

    if (nodeError || !node) {
      const { data: pendingNode } = await supabase
        .from("learning_path_nodes")
        .select(
          `
          id,
          path_id,
          knowledge_point_id,
          status,
          learning_paths!inner(user_id)
        `,
        )
        .eq("knowledge_point_id", task.knowledge_point_id)
        .eq("status", "pending")
        .single();

      if (!pendingNode) {
        return {
          node_updated: false,
          path_progress: null,
          path_completed: false,
        };
      }

      const pathData = Array.isArray(pendingNode.learning_paths)
        ? pendingNode.learning_paths[0]
        : pendingNode.learning_paths;
      if (!pathData || pathData.user_id !== userId) {
        return {
          node_updated: false,
          path_progress: null,
          path_completed: false,
        };
      }

      await this.learningPathService.updateNodeStatus(
        supabase,
        pendingNode.path_id,
        pendingNode.id,
        userId,
        {
          status: "completed",
          time_spent: task.actual_duration ?? task.estimated_duration,
          progress_percentage: 100,
        },
      );

      const progress = await this.learningPathService.getPathProgress(
        supabase,
        pendingNode.path_id,
        userId,
      );

      return {
        node_updated: true,
        path_progress: progress,
        path_completed: progress.progress_percentage === 100,
      };
    }

    const pathData = Array.isArray(node.learning_paths)
      ? node.learning_paths[0]
      : node.learning_paths;
    if (!pathData || pathData.user_id !== userId) {
      return {
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    await this.learningPathService.updateNodeStatus(supabase, node.path_id, node.id, userId, {
      status: "completed",
      time_spent: task.actual_duration ?? task.estimated_duration,
      progress_percentage: 100,
    });

    const progress = await this.learningPathService.getPathProgress(supabase, node.path_id, userId);

    return {
      node_updated: true,
      path_progress: progress,
      path_completed: progress.progress_percentage === 100,
    };
  }
}
