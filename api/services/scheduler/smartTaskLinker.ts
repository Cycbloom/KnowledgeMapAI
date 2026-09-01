import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { graphTaskService } from "./graphTaskService";
import { notDeleted } from '../common/softDeleteHelper';
import { appEventBus } from "../core/eventBus";
import { getSupabaseAdmin } from "../../supabase";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { resolveLocalizedText } from "../../../shared/utils/localization";
import { formatStudyTaskTitle } from "../../../shared/constants/taskTitles";
import type { AppEvent, GraphCreatedPayload } from "../../../shared/types/events";

export interface LinkedTaskResult {
  taskId: string;
  taskTitle: string;
  source: "learning_path" | "existing" | "auto_generated";
  graphId?: string;
  subtaskId?: string;
  learningState?: string;
  progress?: number;
  totalNodes?: number;
  completedNodes?: number;
}

export interface GraphTaskInfo {
  mainTaskId: string;
  graphId: string;
  graphName: string;
  totalNodes: number;
  completedNodes: number;
  subtasks: Array<{
    id: string;
    title: string;
    knowledgePointId: string;
    status: string;
    learningState: string;
  }>;
}

class SmartTaskLinker {
  async getOrCreateTaskForGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ): Promise<GraphTaskInfo> {
    logger.info("[SmartTaskLinker] getOrCreateTaskForGraph called:", {
      userId,
      graphId,
    });

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, title, task_id, user_id")
      .eq("id", graphId)
      .single();

    if (graphError) {
      logger.error("[SmartTaskLinker] Error fetching graph:", graphError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to fetch graph: ${graphError.message}` });
    }

    if (!graph) {
      logger.error("[SmartTaskLinker] Graph not found:", graphId);
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND, { message: "Graph not found" });
    }

    let mainTaskId: string;

    if (graph.task_id) {
      logger.info("[SmartTaskLinker] Graph already has task_id:", {
        taskId: graph.task_id,
      });
      mainTaskId = graph.task_id;

      await graphTaskService.updateTaskForGraph(supabase, mainTaskId, graphId);
    } else {
      logger.info("[SmartTaskLinker] Graph has no task_id, creating task");
      
      const result = await graphTaskService.createOrUpdateTaskForGraph(
        supabase,
        userId,
        graphId,
      );

      mainTaskId = result.taskId;
    }

    const nodes = await this.getGraphNodes(supabase, graphId);
    logger.info("[SmartTaskLinker] Found graph nodes:", {
      count: nodes.length,
    });

    await this.syncSubtasksForNodes(supabase, mainTaskId, nodes);

    const subtasks = await this.getSubtasksForTask(supabase, mainTaskId);
    const completedNodes = subtasks.filter(
      (s) => s.status === "completed",
    ).length;

    logger.info("[SmartTaskLinker] Returning graph task info:", {
      mainTaskId,
      totalNodes: nodes.length,
      completedNodes,
      subtaskCount: subtasks.length,
    });

    return {
      mainTaskId,
      graphId,
      graphName: graph.title,
      totalNodes: nodes.length,
      completedNodes,
      subtasks,
    };
  }

  async getOrCreateTaskForKnowledgePoint(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    options?: {
      graphId?: string;
      title?: string;
    },
  ) {
    let graphId = options?.graphId;

    if (!graphId) {
      const { data: gn } = await notDeleted(supabase
        .from("graph_nodes")
        .select("graph_id")
        .eq("knowledge_point_id", knowledgePointId)
        )
        .limit(1)
        .maybeSingle();

      if (gn?.graph_id) {
        graphId = gn.graph_id;
      }
    }

    if (graphId) {
      const graphTask = await this.getOrCreateTaskForGraph(
        supabase,
        userId,
        graphId,
      );

      const subtask = graphTask.subtasks.find(
        (s) => s.knowledgePointId === knowledgePointId,
      );

      if (subtask) {
        return {
          taskId: graphTask.mainTaskId,
          taskTitle: graphTask.graphName,
          source: "auto_generated" as const,
          graphId,
          subtaskId: subtask.id,
          learningState: subtask.learningState,
          progress:
            graphTask.totalNodes > 0
              ? Math.round(
                  (graphTask.completedNodes / graphTask.totalNodes) * 100,
                )
              : 0,
          totalNodes: graphTask.totalNodes,
          completedNodes: graphTask.completedNodes,
        };
      }
    }

    // 孤立知识点（不在任何图谱）：创建/复用独立「学习」任务，保证直学也有时长锚点，
    // 否则 beginActivity 自动挂靠拿不到 taskId，本次学习不记时。
    const isolatedTask = await this.getOrCreateStandaloneLearningTask(
      supabase,
      userId,
      knowledgePointId,
      options?.title,
    );
    if (isolatedTask) {
      return {
        taskId: isolatedTask.id,
        taskTitle: isolatedTask.title,
        source: "auto_generated" as const,
        subtaskId: undefined,
        learningState: "learning",
      };
    }

    return {
      taskId: "",
      taskTitle: options?.title || "未知任务",
      source: "auto_generated" as const,
    };
  }

  /**
   * 孤立知识点（不在任何图谱）的直学锚点：创建/复用一条独立「学习」任务。
   * 同一知识点复用（task_type='learning' + knowledge_point_id 精确匹配），避免重复建任务。
   */
  private async getOrCreateStandaloneLearningTask(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    title?: string,
  ): Promise<{ id: string; title: string } | null> {
    try {
      const { data: existing } = await supabase
        .from("user_tasks")
        .select("id, title")
        .eq("user_id", userId)
        .eq("knowledge_point_id", knowledgePointId)
        .eq("task_type", "learning")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return {
          id: (existing as { id: string }).id,
          title: (existing as { title: string }).title,
        };
      }

      const kpTitle =
        title ??
        (await this.resolveKnowledgePointTitle(supabase, knowledgePointId));
      const { data: created, error } = await supabase
        .from("user_tasks")
        .insert({
          user_id: userId,
          title: formatStudyTaskTitle(kpTitle || knowledgePointId),
          knowledge_point_id: knowledgePointId,
          task_type: "learning",
          queue_level: 1,
          estimated_duration: 30,
          position: 0,
          status: "pending",
          context: {},
        })
        .select("id, title")
        .single();

      if (error || !created) {
        logger.warn("[SmartTaskLinker] standalone learning task creation failed", {
          knowledgePointId,
          error: error?.message,
        });
        return null;
      }
      logger.info("[SmartTaskLinker] created standalone learning task for isolated KP", {
        knowledgePointId,
        taskId: (created as { id: string }).id,
      });
      return {
        id: (created as { id: string }).id,
        title: (created as { title: string }).title,
      };
    } catch (error) {
      logger.warn("[SmartTaskLinker] standalone learning task creation error", {
        knowledgePointId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async resolveKnowledgePointTitle(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<string> {
    const { data } = await supabase
      .from("knowledge_points")
      .select("title")
      .eq("id", knowledgePointId)
      .maybeSingle();
    if (!data) return "";
    // knowledge_points.title 为 JSONB 本地化对象，需解析为可读文本
    return resolveLocalizedText(
      (data as { title: string | Record<string, string> | null }).title,
    );
  }

  private async getGraphNodes(supabase: SupabaseClient, graphId: string) {
    const { data, error } = await notDeleted(supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points!inner(id, title)
      `,
      )
      .eq("graph_id", graphId)
      );

    if (error) {
      logger.error("[SmartTaskLinker] Error fetching graph nodes:", error);
      return [];
    }

    return (data || [])
      .filter((gn) => gn.knowledge_points)
      .map((gn) => {
        const kp = gn.knowledge_points as unknown as {
          id: string;
          title: string | { [lang: string]: string };
        };
        return {
          id: gn.knowledge_point_id,
          // knowledge_points.title 为 JSONB 本地化对象，写入任务/子任务标题前需解析为可读文本
          title: resolveLocalizedText(kp.title),
        };
      });
  }

  private async syncSubtasksForNodes(
    supabase: SupabaseClient,
    taskId: string,
    nodes: Array<{ id: string; title: string }>,
  ) {
    logger.info("[SmartTaskLinker] Syncing subtasks for task:", {
      taskId,
      nodeCount: nodes.length,
    });

    const { data: existingSubtasks, error: fetchError } = await supabase
      .from("task_subtasks")
      .select("knowledge_point_id")
      .eq("task_id", taskId);

    if (fetchError) {
      logger.error(
        "[SmartTaskLinker] Error fetching existing subtasks:",
        fetchError,
      );
      return;
    }

    const existingNodeIds = new Set(
      (existingSubtasks || []).map((s) => s.knowledge_point_id),
    );

    const newNodes = nodes.filter((n) => !existingNodeIds.has(n.id));

    logger.info("[SmartTaskLinker] Subtask sync status:", {
      existingCount: existingSubtasks?.length || 0,
      newNodesCount: newNodes.length,
    });

    if (newNodes.length === 0) return;

    const subtasksToCreate = newNodes.map((node, index) => ({
      task_id: taskId,
      title: node.title,
      status: "pending",
      priority: 0,
      position: (existingSubtasks?.length || 0) + index,
      estimated_duration: 15,
      knowledge_point_id: node.id,
      learning_state: "learning",
      last_state_change_at: new Date().toISOString(),
      state_history: [],
    }));

    const { error } = await supabase
      .from("task_subtasks")
      .insert(subtasksToCreate);

    if (error) {
      logger.error("[SmartTaskLinker] Failed to create subtasks:", error);
    } else {
      logger.info("[SmartTaskLinker] Created subtasks:", {
        count: newNodes.length,
      });
    }
  }

  private async getSubtasksForTask(supabase: SupabaseClient, taskId: string) {
    const { data } = await supabase
      .from("task_subtasks")
      .select("id, title, status, knowledge_point_id, learning_state")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    return (data || []).map((s) => ({
      id: s.id,
      title: s.title,
      knowledgePointId: s.knowledge_point_id,
      status: s.status,
      learningState: s.learning_state,
    }));
  }

  /**
   * 订阅 graph_created 事件，为新创建的图谱自动关联学习任务。
   * 此方法将原来在 GraphService 中的直接调用改为事件驱动，
   * 消除 graph→scheduler 的循环依赖。
   */
  subscribeToGraphCreatedEvents(): void {
    appEventBus.subscribe("graph_created", async (event: AppEvent) => {
      const payload = event.payload as GraphCreatedPayload;
      try {
        const supabase = getSupabaseAdmin();
        const taskInfo = await this.getOrCreateTaskForGraph(
          supabase,
          payload.userId,
          payload.graphId,
        );
        logger.info("[SmartTaskLinker] Created task for new graph via event:", {
          graphId: payload.graphId,
          taskId: taskInfo.mainTaskId,
        });
      } catch (taskError) {
        logger.warn("[SmartTaskLinker] Failed to create task for graph via event:", taskError);
      }
    });
  }
}

export const smartTaskLinker = new SmartTaskLinker();

// Subscribe to graph_created events at module load time
smartTaskLinker.subscribeToGraphCreatedEvents();
