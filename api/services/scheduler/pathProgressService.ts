import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { scheduleSyncService } from "./planning/scheduleSyncService";

export interface PathProgressRecord {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PathProgressSummary {
  path_id: string;
  total_nodes: number;
  completed_nodes: number;
  in_progress_nodes: number;
  pending_nodes: number;
  skipped_nodes: number;
  progress_percentage: number;
  total_time_spent: number;
  total_estimated_time: number;
  status: "not_started" | "in_progress" | "completed";
}

export interface PathLearningStats {
  path_id: string;
  path_title: string;
  total_time_spent: number;
  total_estimated_time: number;
  completed_nodes: number;
  total_nodes: number;
  progress_percentage: number;
  average_time_per_node: number;
  started_at?: string;
  last_activity_at?: string;
  milestones_completed: number;
  total_milestones: number;
}

export interface NodeCompletionSyncResult {
  success: boolean;
  task_updated: boolean;
  task_id?: string;
  path_progress: PathProgressSummary | null;
  path_completed: boolean;
}

export interface TaskCompletionSyncResult {
  success: boolean;
  node_updated: boolean;
  node_id?: string;
  path_progress: PathProgressSummary | null;
  path_completed: boolean;
}

export class PathProgressService {
  async syncNodeCompletionToTask(
    client: SupabaseClient,
    userId: string,
    nodeId: string,
    completedAt?: string,
  ): Promise<NodeCompletionSyncResult> {
    const { data: nodeProgress, error: progressError } = await client
      .from("learning_path_progress")
      .select("*")
      .eq("node_id", nodeId)
      .eq("user_id", userId)
      .single();

    if (progressError && progressError.code !== "PGRST116") {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: progressError.message },
      });
    }

    if (!nodeProgress || nodeProgress.status !== "completed") {
      return {
        success: false,
        task_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    const { data: pathNodeTask, error: linkError } = await client
      .from("path_node_tasks")
      .select("task_id, path_id")
      .eq("node_id", nodeId)
      .eq("user_id", userId)
      .single();

    if (linkError || !pathNodeTask) {
      return {
        success: true,
        task_updated: false,
        path_progress: await this.getPathProgressSummary(client, userId, nodeProgress.path_id),
        path_completed: false,
      };
    }

    const { data: task, error: taskError } = await client
      .from("user_tasks")
      .select("id, status")
      .eq("id", pathNodeTask.task_id)
      .eq("user_id", userId)
      .single();

    if (taskError || !task) {
      return {
        success: true,
        task_updated: false,
        path_progress: await this.getPathProgressSummary(client, userId, pathNodeTask.path_id),
        path_completed: false,
      };
    }

    if (task.status === "completed") {
      return {
        success: true,
        task_updated: false,
        task_id: task.id,
        path_progress: await this.getPathProgressSummary(client, userId, pathNodeTask.path_id),
        path_completed: false,
      };
    }

    const completionTime = completedAt ?? new Date().toISOString();

    const { error: updateError } = await client
      .from("user_tasks")
      .update({
        status: "completed",
        completed_at: completionTime,
        actual_duration: nodeProgress.time_spent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", userId);

    if (updateError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateError.message },
      });
    }

    const pathProgress = await this.getPathProgressSummary(client, userId, pathNodeTask.path_id);

    return {
      success: true,
      task_updated: true,
      task_id: task.id,
      path_progress: pathProgress,
      path_completed: pathProgress?.progress_percentage === 100,
    };
  }

  async syncTaskCompletionToPath(
    client: SupabaseClient,
    userId: string,
    taskId: string,
  ): Promise<TaskCompletionSyncResult> {
    const { data: task, error: taskError } = await client
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: "Task not found" },
      });
    }

    if (task.status !== "completed") {
      return {
        success: false,
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    const { data: pathNodeTask, error: linkError } = await client
      .from("path_node_tasks")
      .select("node_id, path_id")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .single();

    if (linkError || !pathNodeTask) {
      return {
        success: true,
        node_updated: false,
        path_progress: null,
        path_completed: false,
      };
    }

    const { data: nodeProgress, error: progressError } = await client
      .from("learning_path_progress")
      .select("*")
      .eq("node_id", pathNodeTask.node_id)
      .eq("user_id", userId)
      .single();

    if (progressError && progressError.code !== "PGRST116") {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: progressError.message },
      });
    }

    const completionTime = task.completed_at ?? new Date().toISOString();
    const timeSpent = task.actual_duration ?? task.estimated_duration ?? 0;

    if (nodeProgress) {
      if (nodeProgress.status === "completed") {
        const pathProgress = await this.getPathProgressSummary(client, userId, pathNodeTask.path_id);
        return {
          success: true,
          node_updated: false,
          node_id: pathNodeTask.node_id,
          path_progress: pathProgress,
          path_completed: pathProgress?.progress_percentage === 100,
        };
      }

      const { error: updateError } = await client
        .from("learning_path_progress")
        .update({
          status: "completed",
          progress_percentage: 100,
          time_spent: timeSpent,
          completed_at: completionTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nodeProgress.id);

      if (updateError) {
        throw new AppError(ErrorCodes.LEARNING_PROGRESS_ERROR, {
          details: { originalError: updateError.message },
        });
      }
    } else {
      const { data: nodeData, error: nodeError } = await client
        .from("learning_path_nodes")
        .select("path_id")
        .eq("id", pathNodeTask.node_id)
        .single();

      if (nodeError || !nodeData) {
        throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND, {
          details: { originalError: "Learning path node not found" },
        });
      }

      const { error: insertError } = await client
        .from("learning_path_progress")
        .insert({
          user_id: userId,
          path_id: pathNodeTask.path_id,
          node_id: pathNodeTask.node_id,
          status: "completed",
          progress_percentage: 100,
          time_spent: timeSpent,
          started_at: completionTime,
          completed_at: completionTime,
        });

      if (insertError) {
        throw new AppError(ErrorCodes.LEARNING_PROGRESS_ERROR, {
          details: { originalError: insertError.message },
        });
      }
    }

    await this.updateNodeStatus(client, pathNodeTask.node_id, "completed", completionTime);

    // P4 完成闭环：任务完成 → 知识点全局同步（排期行收口 + 跨路径节点同步）。
    // 同步失败不影响任务完成链路本身。
    const { data: completedNode } = await client
      .from("learning_path_nodes")
      .select("knowledge_point_id")
      .eq("id", pathNodeTask.node_id)
      .maybeSingle();
    if (completedNode?.knowledge_point_id) {
      try {
        await scheduleSyncService.syncKnowledgePointCompleted(
          client,
          userId,
          completedNode.knowledge_point_id,
          {
            excludePathId: pathNodeTask.path_id,
            now: new Date(completionTime),
          },
        );
      } catch (syncError) {
        logger.warn("[PathProgress] syncKnowledgePointCompleted failed", {
          taskId,
          nodeId: pathNodeTask.node_id,
          error:
            syncError instanceof Error
              ? syncError.message
              : String(syncError),
        });
      }
    }

    const pathProgress = await this.getPathProgressSummary(client, userId, pathNodeTask.path_id);

    return {
      success: true,
      node_updated: true,
      node_id: pathNodeTask.node_id,
      path_progress: pathProgress,
      path_completed: pathProgress?.progress_percentage === 100,
    };
  }

  private async updateNodeStatus(
    client: SupabaseClient,
    nodeId: string,
    status: string,
    completedAt?: string,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "completed" && completedAt) {
      updateData.completed_at = completedAt;
    }

    const { error } = await client
      .from("learning_path_nodes")
      .update(updateData)
      .eq("id", nodeId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }
  }

  async updatePathOverallProgress(
    client: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<PathProgressSummary> {
    const { data: nodes, error: nodesError } = await client
      .from("learning_path_nodes")
      .select("id, estimated_time, status")
      .eq("path_id", pathId);

    if (nodesError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: nodesError.message },
      });
    }

    if (!nodes || nodes.length === 0) {
      return {
        path_id: pathId,
        total_nodes: 0,
        completed_nodes: 0,
        in_progress_nodes: 0,
        pending_nodes: 0,
        skipped_nodes: 0,
        progress_percentage: 0,
        total_time_spent: 0,
        total_estimated_time: 0,
        status: "not_started",
      };
    }

    const nodeIds = nodes.map((n) => n.id);

    const { data: progressRecords, error: progressError } = await client
      .from("learning_path_progress")
      .select("node_id, status, time_spent, progress_percentage")
      .eq("path_id", pathId)
      .eq("user_id", userId)
      .in("node_id", nodeIds);

    if (progressError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: progressError.message },
      });
    }

    const progressMap = new Map<string, typeof progressRecords[0]>();
    (progressRecords || []).forEach((p) => {
      progressMap.set(p.node_id, p);
    });

    let completedNodes = 0;
    let inProgressNodes = 0;
    let pendingNodes = 0;
    let skippedNodes = 0;
    let totalTimeSpent = 0;

    for (const node of nodes) {
      const progress = progressMap.get(node.id);
      const nodeStatus = progress?.status ?? node.status ?? "pending";

      switch (nodeStatus) {
        case "completed":
          completedNodes++;
          break;
        case "in_progress":
          inProgressNodes++;
          break;
        case "skipped":
          skippedNodes++;
          break;
        default:
          pendingNodes++;
      }

      totalTimeSpent += progress?.time_spent ?? 0;
    }

    const totalNodes = nodes.length;
    const progressPercentage = Math.round((completedNodes / totalNodes) * 100);
    const totalEstimatedTime = nodes.reduce((sum, n) => sum + (n.estimated_time ?? 0), 0);

    let status: "not_started" | "in_progress" | "completed" = "not_started";
    if (completedNodes === totalNodes) {
      status = "completed";
    } else if (completedNodes > 0 || inProgressNodes > 0) {
      status = "in_progress";
    }

    const summary: PathProgressSummary = {
      path_id: pathId,
      total_nodes: totalNodes,
      completed_nodes: completedNodes,
      in_progress_nodes: inProgressNodes,
      pending_nodes: pendingNodes,
      skipped_nodes: skippedNodes,
      progress_percentage: progressPercentage,
      total_time_spent: totalTimeSpent,
      total_estimated_time: totalEstimatedTime,
      status,
    };

    const { error: pathUpdateError } = await client
      .from("learning_paths")
      .update({
        status: status === "completed" ? "completed" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pathId);

    if (pathUpdateError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: pathUpdateError.message },
      });
    }

    return summary;
  }

  async getPathProgressSummary(
    client: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<PathProgressSummary | null> {
    const { data: path, error: pathError } = await client
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      return null;
    }

    return this.updatePathOverallProgress(client, userId, pathId);
  }

  async getPathLearningStats(
    client: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<PathLearningStats | null> {
    const { data: path, error: pathError } = await client
      .from("learning_paths")
      .select("id, title, total_estimated_time")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      return null;
    }

    const { data: nodes, error: nodesError } = await client
      .from("learning_path_nodes")
      .select("id, estimated_time, is_milestone, status")
      .eq("path_id", pathId);

    if (nodesError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: nodesError.message },
      });
    }

    if (!nodes || nodes.length === 0) {
      return {
        path_id: pathId,
        path_title: path.title,
        total_time_spent: 0,
        total_estimated_time: path.total_estimated_time ?? 0,
        completed_nodes: 0,
        total_nodes: 0,
        progress_percentage: 0,
        average_time_per_node: 0,
        milestones_completed: 0,
        total_milestones: 0,
      };
    }

    const nodeIds = nodes.map((n) => n.id);

    const { data: progressRecords, error: progressError } = await client
      .from("learning_path_progress")
      .select("node_id, status, time_spent, started_at, completed_at, updated_at")
      .eq("path_id", pathId)
      .eq("user_id", userId)
      .in("node_id", nodeIds);

    if (progressError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: progressError.message },
      });
    }

    const progressMap = new Map<string, typeof progressRecords[0]>();
    (progressRecords || []).forEach((p) => {
      progressMap.set(p.node_id, p);
    });

    let completedNodes = 0;
    let totalTimeSpent = 0;
    let milestonesCompleted = 0;
    let totalMilestones = 0;
    let startedAt: string | undefined;
    let lastActivityAt: string | undefined;

    for (const node of nodes) {
      const progress = progressMap.get(node.id);
      const nodeStatus = progress?.status ?? node.status ?? "pending";

      if (node.is_milestone) {
        totalMilestones++;
        if (nodeStatus === "completed") {
          milestonesCompleted++;
        }
      }

      if (nodeStatus === "completed") {
        completedNodes++;
        totalTimeSpent += progress?.time_spent ?? 0;
      }

      if (progress?.started_at) {
        if (!startedAt || progress.started_at < startedAt) {
          startedAt = progress.started_at;
        }
      }

      if (progress?.updated_at) {
        if (!lastActivityAt || progress.updated_at > lastActivityAt) {
          lastActivityAt = progress.updated_at;
        }
      }
    }

    const totalNodes = nodes.length;
    const progressPercentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
    const averageTimePerNode = completedNodes > 0 ? Math.round(totalTimeSpent / completedNodes) : 0;

    return {
      path_id: pathId,
      path_title: path.title,
      total_time_spent: totalTimeSpent,
      total_estimated_time: path.total_estimated_time ?? 0,
      completed_nodes: completedNodes,
      total_nodes: totalNodes,
      progress_percentage: progressPercentage,
      average_time_per_node: averageTimePerNode,
      started_at: startedAt,
      last_activity_at: lastActivityAt,
      milestones_completed: milestonesCompleted,
      total_milestones: totalMilestones,
    };
  }

  async batchSyncTaskCompletionsToPath(
    client: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<{
    synced_count: number;
    failed_count: number;
    results: TaskCompletionSyncResult[];
  }> {
    const { data: pathNodeTasks, error: linkError } = await client
      .from("path_node_tasks")
      .select("task_id, node_id")
      .eq("path_id", pathId)
      .eq("user_id", userId);

    if (linkError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: linkError.message },
      });
    }

    if (!pathNodeTasks || pathNodeTasks.length === 0) {
      return {
        synced_count: 0,
        failed_count: 0,
        results: [],
      };
    }

    const taskIds = pathNodeTasks.map((pnt) => pnt.task_id);

    const { data: tasks, error: tasksError } = await client
      .from("user_tasks")
      .select("id, status")
      .in("id", taskIds)
      .eq("user_id", userId);

    if (tasksError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: tasksError.message },
      });
    }

    const completedTaskIds = new Set(
      (tasks || []).filter((t) => t.status === "completed").map((t) => t.id),
    );

    const results: TaskCompletionSyncResult[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const pnt of pathNodeTasks) {
      if (!completedTaskIds.has(pnt.task_id)) {
        continue;
      }

      try {
        const result = await this.syncTaskCompletionToPath(client, userId, pnt.task_id);
        results.push(result);
        if (result.success && result.node_updated) {
          syncedCount++;
        }
      } catch {
        failedCount++;
        results.push({
          success: false,
          node_updated: false,
          path_progress: null,
          path_completed: false,
        });
      }
    }

    return {
      synced_count: syncedCount,
      failed_count: failedCount,
      results,
    };
  }

  async getNodeProgress(
    client: SupabaseClient,
    userId: string,
    nodeId: string,
  ): Promise<PathProgressRecord | null> {
    const { data, error } = await client
      .from("learning_path_progress")
      .select("*")
      .eq("node_id", nodeId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (data as PathProgressRecord) ?? null;
  }

  async updateNodeProgress(
    client: SupabaseClient,
    userId: string,
    nodeId: string,
    data: {
      status?: "pending" | "in_progress" | "completed" | "skipped";
      progress_percentage?: number;
      time_spent?: number;
      notes?: string;
    },
  ): Promise<PathProgressRecord> {
    const { data: node, error: nodeError } = await client
      .from("learning_path_nodes")
      .select("id, path_id")
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND, {
        details: { originalError: "Learning path node not found" },
      });
    }

    const { data: existingProgress } = await client
      .from("learning_path_progress")
      .select("*")
      .eq("node_id", nodeId)
      .eq("user_id", userId)
      .single();

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      ...data,
      updated_at: now,
    };

    if (data.status === "in_progress" && !existingProgress?.started_at) {
      updateData.started_at = now;
    }

    if (data.status === "completed") {
      updateData.completed_at = now;
      updateData.progress_percentage = 100;
    }

    if (existingProgress) {
      const { data: updated, error: updateError } = await client
        .from("learning_path_progress")
        .update(updateData)
        .eq("id", existingProgress.id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(ErrorCodes.LEARNING_PROGRESS_ERROR, {
          details: { originalError: updateError.message },
        });
      }

      if (data.status) {
        await this.updateNodeStatus(client, nodeId, data.status, data.status === "completed" ? now : undefined);
      }

      return updated as PathProgressRecord;
    }

    const { data: newProgress, error: insertError } = await client
      .from("learning_path_progress")
      .insert({
        user_id: userId,
        path_id: node.path_id,
        node_id: nodeId,
        status: data.status ?? "pending",
        progress_percentage: data.progress_percentage ?? 0,
        time_spent: data.time_spent ?? 0,
        notes: data.notes,
        started_at: data.status === "in_progress" ? now : undefined,
        completed_at: data.status === "completed" ? now : undefined,
      })
      .select()
      .single();

    if (insertError) {
      throw new AppError(ErrorCodes.LEARNING_PROGRESS_ERROR, {
        details: { originalError: insertError.message },
      });
    }

    if (data.status) {
      await this.updateNodeStatus(client, nodeId, data.status, data.status === "completed" ? now : undefined);
    }

    return newProgress as PathProgressRecord;
  }
}

export const pathProgressService = new PathProgressService();
