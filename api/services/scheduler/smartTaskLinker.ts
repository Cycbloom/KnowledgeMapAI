import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

export interface LinkedTaskResult {
  taskId: string;
  taskTitle: string;
  source: "learning_path" | "existing" | "auto_generated";
  graphId?: string;
  subtaskId?: string;
  subtaskType?: string;
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
    taskType: string;
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
      .select("id, title, task_id")
      .eq("id", graphId)
      .single();

    if (graphError) {
      logger.error("[SmartTaskLinker] Error fetching graph:", graphError);
      throw new Error(`Failed to fetch graph: ${graphError.message}`);
    }

    if (!graph) {
      logger.error("[SmartTaskLinker] Graph not found:", graphId);
      throw new Error("Graph not found");
    }

    let mainTaskId: string;

    if (graph.task_id) {
      logger.info("[SmartTaskLinker] Graph already has task_id:", {
        taskId: graph.task_id,
      });
      mainTaskId = graph.task_id;
    } else {
      logger.info("[SmartTaskLinker] Graph has no task_id, creating task");
      const newTask = await this.createTaskForGraph(
        supabase,
        userId,
        graphId,
        graph.title,
      );

      await supabase
        .from("knowledge_graphs")
        .update({ task_id: newTask.id })
        .eq("id", graphId);

      logger.info("[SmartTaskLinker] Updated graph with task_id:", {
        graphId,
        taskId: newTask.id,
      });

      mainTaskId = newTask.id;
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
      const { data: gn } = await supabase
        .from("graph_nodes")
        .select("graph_id")
        .eq("knowledge_point_id", knowledgePointId)
        .is("deleted_at", null)
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
          subtaskType: subtask.taskType,
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

    return {
      taskId: "",
      taskTitle: options?.title || "未知任务",
      source: "auto_generated" as const,
    };
  }

  private async createTaskForGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    graphName: string,
  ) {
    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", 1)
      .is("deleted_at", null);

    const { data: task, error } = await supabase
      .from("scheduled_tasks")
      .insert({
        user_id: userId,
        title: `学习图谱: ${graphName}`,
        queue_level: 1,
        position: count ?? 0,
        priority: 5,
        status: "pending",
        task_type: "graph_learning",
        estimated_duration: 60,
        tags: ["图谱学习"],
        context: { graph_id: graphId, auto_generated: true },
      })
      .select()
      .single();

    if (error) {
      logger.error("[SmartTaskLinker] Failed to create task:", error);
      throw error;
    }

    logger.info("[SmartTaskLinker] Created task for graph:", {
      taskId: task.id,
      graphId,
    });

    return task;
  }

  private async getGraphNodes(supabase: SupabaseClient, graphId: string) {
    const { data, error } = await supabase
      .from("graph_nodes")
      .select(
        `
        knowledge_point_id,
        knowledge_points!inner(id, title)
      `,
      )
      .eq("graph_id", graphId)
      .is("deleted_at", null);

    if (error) {
      logger.error("[SmartTaskLinker] Error fetching graph nodes:", error);
      return [];
    }

    return (data || [])
      .filter((gn) => gn.knowledge_points)
      .map((gn) => {
        const kp = gn.knowledge_points as unknown as {
          id: string;
          title: string;
        };
        return {
          id: gn.knowledge_point_id,
          title: kp.title,
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
      task_type: "learning",
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
      .select("id, title, status, knowledge_point_id, task_type")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    return (data || []).map((s) => ({
      id: s.id,
      title: s.title,
      knowledgePointId: s.knowledge_point_id,
      status: s.status,
      taskType: s.task_type,
    }));
  }
}

export const smartTaskLinker = new SmartTaskLinker();
