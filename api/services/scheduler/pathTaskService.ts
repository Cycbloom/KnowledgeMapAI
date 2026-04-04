import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { ScheduledTask } from "../../../shared/types/scheduler";

export interface PathNodeTask {
  id: string;
  path_id: string;
  node_id: string;
  task_id: string;
  user_id: string;
  created_at: string;
}

export interface LearningPathNode {
  id: string;
  path_id: string;
  knowledge_point_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time?: number;
  is_milestone: boolean;
  prerequisites: string[];
  status: string;
}

export interface CreatePathNodeTaskData {
  path_id: string;
  node_id: string;
  title?: string;
  description?: string;
  estimated_duration?: number;
  knowledge_point_id?: string;
  priority?: number;
}

export interface BatchConvertResult {
  success: boolean;
  converted_count: number;
  failed_count: number;
  tasks: PathNodeTask[];
  errors: Array<{ node_id: string; error: string }>;
}

export interface PathTaskWithDetails extends PathNodeTask {
  task?: ScheduledTask;
  node?: LearningPathNode;
}

export class PathTaskService {
  async convertNodeToTask(
    client: SupabaseClient,
    userId: string,
    data: CreatePathNodeTaskData,
  ): Promise<PathNodeTask> {
    const { data: node, error: nodeError } = await client
      .from("learning_path_nodes")
      .select("*")
      .eq("id", data.node_id)
      .eq("path_id", data.path_id)
      .single();

    if (nodeError || !node) {
      throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND, {
        details: { originalError: "Learning path node not found" },
      });
    }

    const { data: existingLink } = await client
      .from("path_node_tasks")
      .select("*")
      .eq("node_id", data.node_id)
      .eq("user_id", userId)
      .single();

    if (existingLink) {
      throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
        details: { originalError: "Task already exists for this node" },
      });
    }

    const { data: maxPosResult } = await client
      .from("scheduled_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("queue_level", 0)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const taskTitle = data.title ?? node.title;
    const taskDescription = data.description ?? node.description;
    const taskDuration = data.estimated_duration ?? node.estimated_time ?? 30;
    const taskKnowledgePointId = data.knowledge_point_id ?? node.knowledge_point_id;

    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .insert({
        user_id: userId,
        title: taskTitle,
        description: taskDescription,
        queue_level: 0,
        position: nextPosition,
        estimated_duration: taskDuration,
        knowledge_point_id: taskKnowledgePointId,
        priority: data.priority ?? 0,
        status: "pending",
        tags: [],
      })
      .select()
      .single();

    if (taskError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
        details: { originalError: taskError.message },
      });
    }

    const { data: pathNodeTask, error: linkError } = await client
      .from("path_node_tasks")
      .insert({
        path_id: data.path_id,
        node_id: data.node_id,
        task_id: task.id,
        user_id: userId,
      })
      .select()
      .single();

    if (linkError) {
      await client.from("scheduled_tasks").delete().eq("id", task.id);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: linkError.message },
      });
    }

    return pathNodeTask as PathNodeTask;
  }

  async batchConvertNodesToTasks(
    client: SupabaseClient,
    userId: string,
    pathId: string,
    nodeIds?: string[],
  ): Promise<BatchConvertResult> {
    let query = client
      .from("learning_path_nodes")
      .select("*")
      .eq("path_id", pathId)
      .order("order_index", { ascending: true });

    if (nodeIds && nodeIds.length > 0) {
      query = query.in("id", nodeIds);
    }

    const { data: nodes, error: nodesError } = await query;

    if (nodesError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: nodesError.message },
      });
    }

    if (!nodes || nodes.length === 0) {
      return {
        success: true,
        converted_count: 0,
        failed_count: 0,
        tasks: [],
        errors: [],
      };
    }

    const { data: existingLinks } = await client
      .from("path_node_tasks")
      .select("node_id")
      .eq("path_id", pathId)
      .eq("user_id", userId);

    const existingNodeIds = new Set(existingLinks?.map((link) => link.node_id) ?? []);

    const { data: maxPosResult } = await client
      .from("scheduled_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("queue_level", 0)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    let currentPosition = maxPosResult?.position ?? -1;

    const results: BatchConvertResult = {
      success: true,
      converted_count: 0,
      failed_count: 0,
      tasks: [],
      errors: [],
    };

    const nodeToTaskMap: Map<string, string> = new Map();
    const createdTasks: string[] = [];

    for (const node of nodes) {
      if (existingNodeIds.has(node.id)) {
        results.failed_count++;
        results.errors.push({
          node_id: node.id,
          error: "Task already exists for this node",
        });
        continue;
      }

      try {
        currentPosition++;

        const { data: task, error: taskError } = await client
          .from("scheduled_tasks")
          .insert({
            user_id: userId,
            title: node.title,
            description: node.description,
            queue_level: 0,
            position: currentPosition,
            estimated_duration: node.estimated_time ?? 30,
            knowledge_point_id: node.knowledge_point_id,
            priority: 0,
            status: "pending",
            tags: [],
          })
          .select()
          .single();

        if (taskError) {
          results.failed_count++;
          results.errors.push({
            node_id: node.id,
            error: taskError.message,
          });
          continue;
        }

        createdTasks.push(task.id);
        nodeToTaskMap.set(node.id, task.id);

        const { data: pathNodeTask, error: linkError } = await client
          .from("path_node_tasks")
          .insert({
            path_id: pathId,
            node_id: node.id,
            task_id: task.id,
            user_id: userId,
          })
          .select()
          .single();

        if (linkError) {
          await client.from("scheduled_tasks").delete().eq("id", task.id);
          createdTasks.pop();
          nodeToTaskMap.delete(node.id);
          results.failed_count++;
          results.errors.push({
            node_id: node.id,
            error: linkError.message,
          });
          continue;
        }

        results.tasks.push(pathNodeTask as PathNodeTask);
        results.converted_count++;
      } catch (err) {
        results.failed_count++;
        results.errors.push({
          node_id: node.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    await this.setupTaskDependencies(client, userId, nodes, nodeToTaskMap);

    results.success = results.failed_count === 0;
    return results;
  }

  private async setupTaskDependencies(
    client: SupabaseClient,
    _userId: string,
    nodes: LearningPathNode[],
    nodeToTaskMap: Map<string, string>,
  ): Promise<void> {
    for (const node of nodes) {
      const taskId = nodeToTaskMap.get(node.id);
      if (!taskId || !node.prerequisites || node.prerequisites.length === 0) {
        continue;
      }

      for (const prereqNodeId of node.prerequisites) {
        const prereqTaskId = nodeToTaskMap.get(prereqNodeId);
        if (!prereqTaskId) {
          continue;
        }

        await client.from("task_dependencies").insert({
          task_id: taskId,
          depends_on_task_id: prereqTaskId,
          dependency_type: "soft",
        });
      }
    }
  }

  async getPathTasks(
    client: SupabaseClient,
    userId: string,
    pathId: string,
  ): Promise<PathTaskWithDetails[]> {
    const { data: pathNodeTasks, error } = await client
      .from("path_node_tasks")
      .select(
        `
        id,
        path_id,
        node_id,
        task_id,
        user_id,
        created_at,
        task:scheduled_tasks!task_id (
          id,
          user_id,
          title,
          description,
          queue_level,
          position,
          estimated_duration,
          actual_duration,
          deadline,
          status,
          tags,
          knowledge_point_id,
          priority,
          created_at,
          updated_at
        ),
        node:learning_path_nodes!node_id (
          id,
          path_id,
          knowledge_point_id,
          order_index,
          title,
          description,
          estimated_time,
          is_milestone,
          prerequisites,
          status
        )
      `,
      )
      .eq("path_id", pathId)
      .eq("user_id", userId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (pathNodeTasks as unknown as PathTaskWithDetails[]) ?? [];
  }

  async getNodeTask(
    client: SupabaseClient,
    userId: string,
    nodeId: string,
  ): Promise<PathTaskWithDetails | null> {
    const { data, error } = await client
      .from("path_node_tasks")
      .select(
        `
        id,
        path_id,
        node_id,
        task_id,
        user_id,
        created_at,
        task:scheduled_tasks!task_id (
          id,
          user_id,
          title,
          description,
          queue_level,
          position,
          estimated_duration,
          actual_duration,
          deadline,
          status,
          tags,
          knowledge_point_id,
          priority,
          created_at,
          updated_at
        ),
        node:learning_path_nodes!node_id (
          id,
          path_id,
          knowledge_point_id,
          order_index,
          title,
          description,
          estimated_time,
          is_milestone,
          prerequisites,
          status
        )
      `,
      )
      .eq("node_id", nodeId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (data as unknown as PathTaskWithDetails) ?? null;
  }

  async deletePathTaskAssociation(
    client: SupabaseClient,
    userId: string,
    nodeId: string,
    deleteTask: boolean = false,
  ): Promise<void> {
    const { data: pathNodeTask, error: findError } = await client
      .from("path_node_tasks")
      .select("*")
      .eq("node_id", nodeId)
      .eq("user_id", userId)
      .single();

    if (findError || !pathNodeTask) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        details: { originalError: "Path node task association not found" },
      });
    }

    const { error: deleteLinkError } = await client
      .from("path_node_tasks")
      .delete()
      .eq("id", pathNodeTask.id);

    if (deleteLinkError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: deleteLinkError.message },
      });
    }

    if (deleteTask) {
      const { error: deleteTaskError } = await client
        .from("scheduled_tasks")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pathNodeTask.task_id)
        .eq("user_id", userId);

      if (deleteTaskError) {
        throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
          details: { originalError: deleteTaskError.message },
        });
      }
    }
  }

  async deleteAllPathTaskAssociations(
    client: SupabaseClient,
    userId: string,
    pathId: string,
    deleteTasks: boolean = false,
  ): Promise<{ deleted_count: number }> {
    const { data: pathNodeTasks, error: findError } = await client
      .from("path_node_tasks")
      .select("id, task_id")
      .eq("path_id", pathId)
      .eq("user_id", userId);

    if (findError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: findError.message },
      });
    }

    if (!pathNodeTasks || pathNodeTasks.length === 0) {
      return { deleted_count: 0 };
    }

    const { error: deleteLinksError } = await client
      .from("path_node_tasks")
      .delete()
      .eq("path_id", pathId)
      .eq("user_id", userId);

    if (deleteLinksError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: deleteLinksError.message },
      });
    }

    if (deleteTasks) {
      const taskIds = pathNodeTasks.map((pnt) => pnt.task_id);

      const { error: deleteTasksError } = await client
        .from("scheduled_tasks")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", taskIds)
        .eq("user_id", userId);

      if (deleteTasksError) {
        throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
          details: { originalError: deleteTasksError.message },
        });
      }
    }

    return { deleted_count: pathNodeTasks.length };
  }
}

export const pathTaskService = new PathTaskService();
