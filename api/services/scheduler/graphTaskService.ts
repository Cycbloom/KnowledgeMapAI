import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { smartTaskLinker } from "./smartTaskLinker";
import { notDeleted } from '../common/softDeleteHelper';

const MINUTES_PER_KNOWLEDGE_POINT = 30;
const MINUTES_PER_DAY = 240;
const MIN_DEADLINE_DAYS = 30;

export interface GraphTaskCalculation {
  estimatedDuration: number;
  deadline: string;
  knowledgePointCount: number;
}

export class GraphTaskService {
  calculateTaskMetrics(knowledgePointCount: number): GraphTaskCalculation {
    const estimatedDuration = knowledgePointCount * MINUTES_PER_KNOWLEDGE_POINT;

    const requiredDays = Math.ceil(estimatedDuration / MINUTES_PER_DAY);
    const deadlineDays = Math.max(requiredDays, MIN_DEADLINE_DAYS);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    deadline.setHours(23, 59, 59, 999);

    return {
      estimatedDuration,
      deadline: deadline.toISOString(),
      knowledgePointCount,
    };
  }

  async updateTaskForGraph(
    supabase: SupabaseClient,
    taskId: string,
    graphId: string,
  ): Promise<void> {
    logger.info("[GraphTaskService] Updating task for graph:", {
      taskId,
      graphId,
    });

    const { data: graphNodes, error: nodesError } = await notDeleted(supabase
      .from("graph_nodes")
      .select("knowledge_point_id")
      .eq("graph_id", graphId)
      );

    if (nodesError) {
      logger.error(
        "[GraphTaskService] Error fetching graph nodes:",
        nodesError,
      );
      throw new Error(`Failed to fetch graph nodes: ${nodesError.message}`);
    }

    const { data: graph } = await supabase
      .from("knowledge_graphs")
      .select("title")
      .eq("id", graphId)
      .single();

    const knowledgePointCount = graphNodes?.length || 0;
    const metrics = this.calculateTaskMetrics(knowledgePointCount);

    const { error: updateError } = await supabase
      .from("user_tasks")
      .update({
        estimated_duration: metrics.estimatedDuration,
        deadline: metrics.deadline,
        graph_id: graphId,
        context: JSON.stringify({
          graph_title: graph?.title || "",
          knowledge_point_count: metrics.knowledgePointCount,
          auto_calculated_duration: true,
          auto_calculated_deadline: true,
          auto_generated: true,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) {
      logger.error("[GraphTaskService] Error updating task:", updateError);
      throw new Error(`Failed to update task: ${updateError.message}`);
    }

    logger.info("[GraphTaskService] Task updated successfully:", {
      taskId,
      knowledgePointCount: metrics.knowledgePointCount,
      estimatedDuration: metrics.estimatedDuration,
      deadline: metrics.deadline,
    });
  }

  async createOrUpdateTaskForGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ): Promise<{ taskId: string; isNew: boolean }> {
    logger.info("[GraphTaskService] createOrUpdateTaskForGraph called:", {
      userId,
      graphId,
    });

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, title, task_id, template_type")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      logger.error("[GraphTaskService] Error fetching graph:", graphError);
      throw new Error(
        `Graph not found: ${graphError?.message || "Unknown error"}`,
      );
    }

    // 故事创作类型的图谱不应该创建任务
    if (graph.template_type === "story_creation") {
      logger.warn("[GraphTaskService] Story creation graph should not have task, skipping:", {
        graphId,
        title: graph.title,
      });
      return { taskId: "", isNew: false };
    }

    if (graph.task_id) {
      logger.info("[GraphTaskService] Graph already has task, updating:", {
        taskId: graph.task_id,
      });

      await this.updateTaskForGraph(supabase, graph.task_id, graphId);

      return { taskId: graph.task_id, isNew: false };
    }

    logger.info("[GraphTaskService] Creating new task for graph");

    const { data: graphNodes, error: nodesError } = await notDeleted(supabase
      .from("graph_nodes")
      .select("knowledge_point_id")
      .eq("graph_id", graphId)
      );

    if (nodesError) {
      logger.error(
        "[GraphTaskService] Error fetching graph nodes:",
        nodesError,
      );
      throw new Error(`Failed to fetch graph nodes: ${nodesError.message}`);
    }

    const knowledgePointCount = graphNodes?.length || 0;
    const metrics = this.calculateTaskMetrics(knowledgePointCount);

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", 1)
      );

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: `学习图谱: ${graph.title}`,
        queue_level: 1,
        position: count ?? 0,
        priority: 5,
        status: "pending",
        task_type: "graph_learning",
        estimated_duration: metrics.estimatedDuration,
        deadline: metrics.deadline,
        graph_id: graphId,
        context: JSON.stringify({
          graph_title: graph?.title || "",
          knowledge_point_count: metrics.knowledgePointCount,
          auto_calculated_duration: true,
          auto_calculated_deadline: true,
          auto_generated: true,
        }),
        tags: ["图谱学习"],
        source: "system_recommendation",
      })
      .select()
      .single();

    if (taskError) {
      logger.error("[GraphTaskService] Error creating task:", taskError);
      throw new Error(`Failed to create task: ${taskError.message}`);
    }

    await supabase
      .from("knowledge_graphs")
      .update({ task_id: task.id })
      .eq("id", graphId);

    logger.info("[GraphTaskService] Task created successfully:", {
      taskId: task.id,
      graphId,
      knowledgePointCount: metrics.knowledgePointCount,
    });

    return { taskId: task.id, isNew: true };
  }

  async syncTaskWithGraphChanges(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<void> {
    logger.info("[GraphTaskService] Syncing task with graph changes:", {
      graphId,
    });

    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("id, task_id, user_id")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      logger.warn(
        "[GraphTaskService] Graph not found, skipping sync:",
        graphId,
      );
      return;
    }

    if (!graph.task_id) {
      logger.info("[GraphTaskService] Graph has no task, skipping sync");
      return;
    }

    await this.updateTaskForGraph(supabase, graph.task_id, graphId);

    const graphTaskInfo = await smartTaskLinker.getOrCreateTaskForGraph(
      supabase,
      graph.user_id || "",
      graphId,
    );

    logger.info("[GraphTaskService] Task synced with graph changes:", {
      taskId: graph.task_id,
      totalNodes: graphTaskInfo.totalNodes,
    });
  }

  async recalculateAllGraphTasks(supabase: SupabaseClient): Promise<void> {
    logger.info("[GraphTaskService] Recalculating all graph tasks");

    const { data: graphTasks, error: fetchError } = await notDeleted(supabase
      .from("user_tasks")
      .select("id, graph_id")
      .eq("task_type", "graph_learning")
      .not("graph_id", "is", null)
      );

    if (fetchError) {
      logger.error(
        "[GraphTaskService] Error fetching graph tasks:",
        fetchError,
      );
      throw new Error(`Failed to fetch graph tasks: ${fetchError.message}`);
    }

    if (!graphTasks || graphTasks.length === 0) {
      logger.info("[GraphTaskService] No graph tasks found to recalculate");
      return;
    }

    logger.info("[GraphTaskService] Found graph tasks to recalculate:", {
      count: graphTasks.length,
    });

    for (const task of graphTasks) {
      try {
        const graphId = task.graph_id;
        if (graphId) {
          await this.updateTaskForGraph(supabase, task.id, graphId);
        }
      } catch (error) {
        logger.error("[GraphTaskService] Error updating task:", {
          taskId: task.id,
          error,
        });
      }
    }

    logger.info("[GraphTaskService] All graph tasks recalculated");
  }
}

export const graphTaskService = new GraphTaskService();
