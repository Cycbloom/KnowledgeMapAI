import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { transactionExecutor } from "../../database/transactionExecutor";
import type {
  LearningPathProgressSummary,
  LearningPathService,
} from "./learningPathService";
import { topologicalSortNodes } from "./learningPathAlgorithms";
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

  async autoSchedulePath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      start_date?: string;
      daily_minutes?: number;
    },
  ): Promise<{
    main_task_id: string;
    subtask_ids: string[];
    total_tasks: number;
    estimated_days: number;
  }> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("*")
      .eq("path_id", pathId)
      .in("status", ["pending", "in_progress"])
      .order("order_index", { ascending: true });

    if (nodesError) {
      logger.error("autoSchedulePath nodes error:", nodesError);
      throw nodesError;
    }

    if (!nodes || nodes.length === 0) {
      return {
        main_task_id: "",
        subtask_ids: [],
        total_tasks: 0,
        estimated_days: 0,
      };
    }

    const dailyMinutes =
      options?.daily_minutes ?? path.daily_minutes_target ?? 30;
    const startDate = options?.start_date
      ? new Date(options.start_date)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    const knowledgePointToNodeMap = new Map<string, string>();
    nodes.forEach((node) => {
      if (node.knowledge_point_id) {
        knowledgePointToNodeMap.set(node.knowledge_point_id, node.id);
      }
    });

    const nodeDependencies = new Map<string, string[]>();
    nodes.forEach((node) => {
      if (node.prerequisites && node.prerequisites.length > 0) {
        const nodePrereqs = node.prerequisites
          .map((kpId: string) => knowledgePointToNodeMap.get(kpId))
          .filter((id: string | undefined): id is string => !!id);
        if (nodePrereqs.length > 0) {
          nodeDependencies.set(node.id, nodePrereqs);
        }
      }
    });

    const completedNodes = new Set<string>();
    const scheduledNodes = new Set<string>();

    const { data: timeSlots, error: slotsError } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", userId)
      .eq("is_available", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (slotsError) {
      logger.error("autoSchedulePath time slots error:", slotsError);
    }

    const getAvailableSlots = (
      date: Date,
    ): Array<{
      start: Date;
      end: Date;
      duration: number;
    }> => {
      const dayOfWeek = date.getDay();

      if (!timeSlots || timeSlots.length === 0) {
        const defaultStart = new Date(date);
        defaultStart.setHours(9, 0, 0, 0);
        const defaultEnd = new Date(date);
        defaultEnd.setHours(21, 0, 0, 0);
        return [
          {
            start: defaultStart,
            end: defaultEnd,
            duration: 12 * 60,
          },
        ];
      }

      const slots = timeSlots.filter(
        (slot) => slot.day_of_week === null || slot.day_of_week === dayOfWeek,
      );

      return slots.map((slot) => {
        const [startHour, startMin] = slot.start_time.split(":").map(Number);
        const [endHour, endMin] = slot.end_time.split(":").map(Number);
        const start = new Date(date);
        start.setHours(startHour, startMin, 0, 0);
        const end = new Date(date);
        end.setHours(endHour, endMin, 0, 0);
        return {
          start,
          end,
          duration: (end.getTime() - start.getTime()) / (1000 * 60),
        };
      });
    };

    const canScheduleNode = (nodeId: string): boolean => {
      const deps = nodeDependencies.get(nodeId);
      if (!deps || deps.length === 0) return true;
      return deps.every(
        (depId: string) =>
          completedNodes.has(depId) || scheduledNodes.has(depId),
      );
    };

    const currentDate = new Date(startDate);
    let currentDayMinutes = 0;
    let currentSlotIndex = 0;
    let currentSlots = getAvailableSlots(currentDate);
    let estimatedDays = 1;
    let finalScheduledEnd: Date | null = null;

    const sortedNodes = topologicalSortNodes(nodes);

    for (const node of sortedNodes) {
      if (!canScheduleNode(node.id)) {
        const pendingDeps = (node.prerequisites || []).filter(
          (depId: string) =>
            !completedNodes.has(depId) && !scheduledNodes.has(depId),
        );
        logger.warn(
          `Node ${node.id} has unmet dependencies: ${pendingDeps.join(", ")}`,
        );
        continue;
      }

      const nodeDuration = node.estimated_time ?? 30;

      if (
        currentSlots.length === 0 ||
        currentSlotIndex >= currentSlots.length
      ) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDayMinutes = 0;
        currentSlotIndex = 0;
        currentSlots = getAvailableSlots(currentDate);
        estimatedDays++;
      }

      let remainingDuration = nodeDuration;
      let scheduledStart: Date | null = null;
      let scheduledEnd: Date | null = null;

      while (remainingDuration > 0) {
        if (currentSlotIndex >= currentSlots.length) {
          currentDate.setDate(currentDate.getDate() + 1);
          currentDayMinutes = 0;
          currentSlotIndex = 0;
          currentSlots = getAvailableSlots(currentDate);
          estimatedDays++;
        }

        const slot = currentSlots[currentSlotIndex];
        if (!slot) break;

        const availableMinutes = slot.duration - currentDayMinutes;

        if (availableMinutes <= 0) {
          currentSlotIndex++;
          currentDayMinutes = 0;
          continue;
        }

        if (!scheduledStart) {
          scheduledStart = new Date(
            slot.start.getTime() + currentDayMinutes * 60 * 1000,
          );
        }

        const allocatedMinutes = Math.min(availableMinutes, remainingDuration);
        currentDayMinutes += allocatedMinutes;
        remainingDuration -= allocatedMinutes;

        scheduledEnd = new Date(
          slot.start.getTime() + currentDayMinutes * 60 * 1000,
        );

        if (currentDayMinutes >= slot.duration) {
          currentSlotIndex++;
          currentDayMinutes = 0;
        }

        if (currentDayMinutes >= dailyMinutes) {
          currentSlotIndex++;
          currentDayMinutes = 0;
        }
      }

      if (scheduledStart && scheduledEnd) {
        finalScheduledEnd = scheduledEnd;
        scheduledNodes.add(node.id);
      }
    }

    // Transactional path for task creation
    if (transactionExecutor.isAvailable()) {
      try {
        const result = await transactionExecutor.executeInTransaction(async (client) => {
          // Create main task
          const { rows: taskCountRows } = await client.query(
            `SELECT COUNT(*) as count FROM user_tasks WHERE user_id = $1 AND queue_level = 0 AND deleted_at IS NULL`,
            [userId],
          );

          const { rows: nodesForTime } = await client.query(
            `SELECT estimated_time FROM learning_path_nodes WHERE path_id = $1`,
            [pathId],
          );

          const totalEstimatedTime =
            nodesForTime.reduce((sum: number, n: { estimated_time: number }) => sum + (n.estimated_time || 0), 0) || 0;

          const position = Number(taskCountRows[0]?.count ?? 0);

          const { rows: mainTaskRows } = await client.query(
            `INSERT INTO user_tasks (user_id, title, description, queue_level, position, estimated_duration, task_type, status, scheduled_start, scheduled_end, context)
             VALUES ($1, $2, $3, 0, $4, $5, 'learning', 'pending', $6, $7, $8)
             RETURNING id`,
            [
              userId,
              formatLearningPathTaskTitle(path.title),
              path.description ||
                path.goal ||
                PATH_TASK_DEFAULT_DESCRIPTION,
              position,
              totalEstimatedTime,
              startDate.toISOString(),
              finalScheduledEnd?.toISOString() ?? null,
              JSON.stringify({
                type: "learning_path",
                path_id: pathId,
                path_title: path.title,
              }),
            ],
          );

          const mainTaskId = mainTaskRows[0].id as string;

          // Create subtasks
          const subtaskIds: string[] = [];
          let subtaskPosition = 0;

          for (const node of sortedNodes) {
            if (scheduledNodes.has(node.id)) {
              const { rows: subtaskRows } = await client.query(
                `INSERT INTO task_subtasks (task_id, title, description, status, priority, position, estimated_duration, learning_path_node_id)
                 VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
                 RETURNING id`,
                [
                  mainTaskId,
                  node.title,
                  node.description || null,
                  node.order_index,
                  subtaskPosition,
                  node.estimated_time || 30,
                  node.id,
                ],
              );

              subtaskIds.push(subtaskRows[0].id as string);
              subtaskPosition++;
            }
          }

          return {
            main_task_id: mainTaskId,
            subtask_ids: subtaskIds,
            total_tasks: subtaskIds.length,
            estimated_days: estimatedDays,
          };
        });

        return result;
      } catch (txError) {
        logger.warn('Transaction failed in autoSchedulePath, falling back to non-transactional operations', { error: txError });
      }
    } else {
      logger.warn('TransactionExecutor not available, using non-transactional path for autoSchedulePath');
    }

    // Non-transactional fallback
    const mainTaskId = await this.createLearningPathMainTask(
      supabase,
      pathId,
      userId,
      {
        scheduled_start: startDate.toISOString(),
        scheduled_end: finalScheduledEnd?.toISOString(),
      },
    );

    const subtaskIds: string[] = [];
    let position = 0;

    for (const node of sortedNodes) {
      if (scheduledNodes.has(node.id)) {
        const subtaskId = await this.convertNodeToSubtask(
          supabase,
          mainTaskId,
          node.id,
          userId,
          position,
        );
        subtaskIds.push(subtaskId);
        position++;
      }
    }

    return {
      main_task_id: mainTaskId,
      subtask_ids: subtaskIds,
      total_tasks: subtaskIds.length,
      estimated_days: estimatedDays,
    };
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
