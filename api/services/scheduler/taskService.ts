import { SupabaseClient } from "@supabase/supabase-js";
import {
  getPaginationParams,
  PaginationOptions,
} from "../../utils/pagination";
import type {
  UserTask,
  UserTaskStatus,
  TaskExecution,
  TaskSettings,
  CreateTaskData,
  CreateUserTaskData,
  UserTaskFilters,
} from "../../../shared/types/index";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

export type {
  UserTask,
  UserTaskStatus,
  TaskExecution,
  TaskSettings,
  CreateTaskData,
  CreateUserTaskData,
  UserTaskFilters,
};

export class TaskService {
  async createTask(
    client: SupabaseClient,
    userId: string,
    taskData: CreateTaskData,
  ): Promise<UserTask> {
    const { data: maxPosResult } = await notDeleted(client
      .from("user_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("queue_level", 0)
      )
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const { data, error } = await client
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: taskData.title,
        description: taskData.description,
        queue_level: 0,
        position: nextPosition,
        estimated_duration: taskData.estimated_duration,
        deadline: taskData.deadline,
        tags: taskData.tags || [],
        knowledge_point_id: taskData.knowledge_point_id,
        priority: taskData.priority ?? 0,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, { details: { originalError: error.message } });
    return data as UserTask;
  }

  async createTaskFull(
    client: SupabaseClient,
    userId: string,
    taskData: CreateUserTaskData,
  ): Promise<UserTask> {
    const queueLevel = taskData.queue_level ?? 0;

    const { count } = await notDeleted(client
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", queueLevel)
      );

    const { data, error } = await client
      .from("user_tasks")
      .insert({
        user_id: userId,
        title: taskData.title,
        description: taskData.description,
        queue_level: queueLevel,
        position: count ?? 0,
        estimated_duration: taskData.estimated_duration,
        deadline: taskData.deadline,
        tags: taskData.tags ?? [],
        knowledge_point_id: taskData.knowledge_point_id,
        priority: taskData.priority ?? 0,
        status: "pending",
        task_type: taskData.task_type ?? "one_time",
        total_duration: taskData.total_duration,
        progress_mode: taskData.progress_mode ?? "average",
        progress_percentage: 0,
        context: taskData.context,
        parent_task_id: taskData.parent_task_id,
      })
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, { details: { originalError: error.message } });
    return data as UserTask;
  }

  async updateTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    updates: Partial<
      Omit<UserTask, "id" | "user_id" | "created_at" | "updated_at">
    >,
  ): Promise<UserTask> {
    const { data, error } = await notDeleted(client
      .from("user_tasks")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    if (!data) throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND);
    return data as UserTask;
  }

  async deleteTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await client
      .from("user_tasks")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
  }

  async getTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<UserTask | null> {
    const { data, error } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    }
    return data as UserTask | null;
  }

  async getTaskStatus(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<UserTaskStatus | null> {
    const { data, error } = await notDeleted(client
      .from("user_tasks")
      .select("status")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (error && error.code !== "PGRST116") {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    }
    return (data?.status as UserTaskStatus) ?? null;
  }

  async getTasks(
    client: SupabaseClient,
    userId: string,
    filters?: UserTaskFilters,
    options?: PaginationOptions,
  ): Promise<{ tasks: UserTask[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = notDeleted(client
      .from("user_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      )
      .order("queue_level", { ascending: true })
      .order("position", { ascending: true })
      .range(offset, end);

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.queue_level !== undefined) {
      query = query.eq("queue_level", filters.queue_level);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains("tags", filters.tags);
    }

    const { data, error, count } = await query;

    if (error) throw new AppError(ErrorCodes.SCHEDULER_QUEUE_ERROR, { details: { originalError: error.message } });
    return { tasks: data as UserTask[], total: count ?? 0 };
  }

  async getTasksByQueue(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
  ): Promise<UserTask[]> {
    const { data, error } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("queue_level", queueLevel)
      )
      .order("position", { ascending: true });

    if (error)
      {throw new AppError(ErrorCodes.SCHEDULER_QUEUE_ERROR, { details: { originalError: error.message } });}
    return data as UserTask[];
  }

  async startTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<{ task: UserTask; execution: TaskExecution }> {
    try {
      const { data, error } = await client.rpc('start_task_with_execution', {
        p_task_id: taskId,
        p_user_id: userId,
      });
      if (error) throw error;

      // Fetch the full task and execution objects
      const { data: task } = await client
        .from('user_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      const { data: execution } = await client
        .from('task_executions')
        .select('*')
        .eq('id', data[0].execution_id)
        .single();

      return {
        task: task as UserTask,
        execution: execution as TaskExecution,
      };
    } catch (rpcError) {
      logger.warn('RPC start_task_with_execution failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: original sequential implementation
    const { data: task, error: taskError } = await notDeleted(client
      .from("user_tasks")
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (taskError)
      {throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: taskError.message } });}

    const { data: execution, error: execError } = await client
      .from("task_executions")
      .insert({
        task_id: taskId,
        user_id: userId,
        started_at: new Date().toISOString(),
        queue_level: task.queue_level,
        status: "in_progress",
      })
      .select()
      .single();

    if (execError)
      {throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: execError.message } });}

    return {
      task: task as UserTask,
      execution: execution as TaskExecution,
    };
  }

  async pauseTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<UserTask> {
    const { data: task, error: taskError } = await notDeleted(client
      .from("user_tasks")
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (taskError)
      {throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: taskError.message } });}
    return task as UserTask;
  }

  async completeTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<UserTask> {
    try {
      const { error } = await client.rpc('complete_task_with_execution', {
        p_task_id: taskId,
        p_user_id: userId,
      });
      if (error) throw error;

      const { data: task } = await client
        .from('user_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      return task as UserTask;
    } catch (rpcError) {
      logger.warn('RPC complete_task_with_execution failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: original sequential implementation
    const { data: executions, error: execError } = await client
      .from("task_executions")
      .select("*")
      .eq("task_id", taskId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (execError)
      {throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: execError.message } });}

    if (executions && executions.length > 0) {
      const execution = executions[0];
      const endedAt = new Date();
      const startedAt = new Date(execution.started_at);
      const duration = Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000,
      );

      await client
        .from("task_executions")
        .update({
          ended_at: endedAt.toISOString(),
          duration,
        })
        .eq("id", execution.id);
    }

    const { data: task, error: taskError } = await notDeleted(client
      .from("user_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (taskError)
      {throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: taskError.message } });}
    return task as UserTask;
  }

  async moveTaskToQueue(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    targetQueue: number,
  ): Promise<UserTask> {
    const { data: maxPosResult } = await notDeleted(client
      .from("user_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("queue_level", targetQueue)
      )
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPosResult?.position ?? -1) + 1;

    const { data, error } = await notDeleted(client
      .from("user_tasks")
      .update({
        queue_level: targetQueue,
        position: nextPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_QUEUE_ERROR, { details: { originalError: error.message } });
    return data as UserTask;
  }

  async reorderTasks(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
    taskIds: string[],
  ): Promise<void> {
    try {
      const { error } = await client.rpc('reorder_tasks', {
        p_user_id: userId,
        p_queue_level: queueLevel,
        p_task_ids: taskIds,
      });
      if (error) throw error;
      return;
    } catch (rpcError) {
      logger.warn('RPC reorder_tasks failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: original sequential implementation
    for (let i = 0; i < taskIds.length; i++) {
      const { error } = await client
        .from("user_tasks")
        .update({
          position: i,
          queue_level: queueLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskIds[i])
        .eq("user_id", userId);

      if (error) throw new AppError(ErrorCodes.SCHEDULER_QUEUE_ERROR, { details: { originalError: error.message } });
    }
  }

  async demoteTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<UserTask> {
    const { data: task } = await client
      .from("user_tasks")
      .select("queue_level")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (!task) throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND);

    const newQueue = Math.min(task.queue_level + 1, 2);
    return this.moveTaskToQueue(client, taskId, userId, newQueue);
  }

  async updateTaskProgress(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    progressData: {
      progress_percentage?: number;
      actual_duration_add?: number;
    },
  ): Promise<UserTask> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (progressData.progress_percentage !== undefined) {
      updateData.progress_percentage = Math.min(100, Math.max(0, progressData.progress_percentage));
    }

    if (progressData.actual_duration_add !== undefined) {
      const { data: currentTask } = await client
        .from("user_tasks")
        .select("actual_duration")
        .eq("id", taskId)
        .eq("user_id", userId)
        .single();

      const currentDuration = (currentTask?.actual_duration as number) || 0;
      updateData.actual_duration = currentDuration + progressData.actual_duration_add;
    }

    const { data: task, error } = await notDeleted(client
      .from("user_tasks")
      .update(updateData)
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, { details: { originalError: error.message } });
    return task as UserTask;
  }

  async getTimeSlice(
    client: SupabaseClient,
    userId: string,
    queueLevel: number,
  ): Promise<number> {
    const { data: settings, error } = await client
      .from("task_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !settings) {
      return 25 * 60;
    }

    switch (queueLevel) {
      case 0:
        return settings.q0_time_slice;
      case 1:
        return settings.q1_time_slice;
      case 2:
        return settings.q2_time_slice;
      default:
        return settings.q0_time_slice;
    }
  }

  async updateExecutionAfterTimeSlice(
    client: SupabaseClient,
    taskId: string,
    userId: string,
    durationSeconds: number,
  ): Promise<TaskExecution | null> {
    const { data: executions, error: fetchError } = await client
      .from("task_executions")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (fetchError || !executions || executions.length === 0) {
      const { data: task } = await client
        .from("user_tasks")
        .select("queue_level")
        .eq("id", taskId)
        .single();

      const { data: newExecution, error: insertError } = await client
        .from("task_executions")
        .insert({
          task_id: taskId,
          user_id: userId,
          started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
          ended_at: new Date().toISOString(),
          duration: durationSeconds,
          queue_level: task?.queue_level ?? 0,
          status: "time_slice_ended",
        })
        .select()
        .single();

      if (insertError) return null;
      return newExecution as TaskExecution;
    }

    const execution = executions[0];
    const endedAt = new Date();
    const startedAt = new Date(execution.started_at);
    const totalDuration = Math.floor(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );

    const { data: updated, error: updateError } = await client
      .from("task_executions")
      .update({
        ended_at: endedAt.toISOString(),
        duration: totalDuration,
        status: "time_slice_ended",
      })
      .eq("id", execution.id)
      .select()
      .single();

    if (updateError) return null;
    return updated as TaskExecution;
  }

  async listTasksWithStats(
    client: SupabaseClient,
    userId: string,
    filters: {
      status?: string;
      queue_level?: number;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ tasks: Array<Record<string, unknown>>; total: number }> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    let query = notDeleted(client
      .from("user_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      )
      .order("queue_level", { ascending: true })
      .order("position", { ascending: true });

    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.queue_level !== undefined) {
      query = query.eq("queue_level", filters.queue_level);
    }

    const { data: tasks, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_QUEUE_ERROR, {
        details: { originalError: error.message },
      });
    }

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      const { data: subtaskStats } = await client
        .from("task_subtasks")
        .select("id, task_id, title, description, status, priority, position, estimated_duration, actual_duration, due_date, completed_at, learning_path_node_id, knowledge_point_id, learning_state, last_state_change_at, state_history, created_at, updated_at, knowledge_points(mastery_level)")
        .in("task_id", taskIds)
        .order("position", { ascending: true });

      const subtasksByTask = new Map<string, Record<string, unknown>[]>();
      const subtaskCounts = new Map<
        string,
        { total: number; completed: number }
      >();
      if (subtaskStats) {
        for (const st of subtaskStats) {
          const taskId = st.task_id as string;
          const existing = subtaskCounts.get(taskId) || {
            total: 0,
            completed: 0,
          };
          existing.total++;
          if (st.status === "completed") {
            existing.completed++;
          }
          subtaskCounts.set(taskId, existing);

          const { knowledge_points, ...rest } = st as Record<string, unknown> & {
            knowledge_points?: { mastery_level: number | null }[] | null;
          };
          const subtask = {
            ...rest,
            // mastery_level 单一来源：从 knowledge_points JOIN 提升到顶层，兼容既有 API 契约
            mastery_level: knowledge_points?.[0]?.mastery_level ?? 0,
          };
          const list = subtasksByTask.get(taskId) ?? [];
          list.push(subtask);
          subtasksByTask.set(taskId, list);
        }
      }

      for (const task of tasks) {
        const stats = subtaskCounts.get(task.id);
        const taskRecord = task as Record<string, unknown>;
        taskRecord.subtask_count = stats?.total || 0;
        taskRecord.subtask_completed = stats?.completed || 0;
        taskRecord.has_subtasks = (stats?.total || 0) > 0;
        // 附挂完整子任务数组（含 mastery_level），供日历/任务列表展开子任务展示
        taskRecord.subtasks = subtasksByTask.get(task.id) ?? [];
      }
    }

    return { tasks: (tasks ?? []) as Array<Record<string, unknown>>, total: count ?? 0 };
  }

  async getTaskDetail(
    client: SupabaseClient,
    userId: string,
    taskId: string,
  ): Promise<Record<string, unknown> | null> {
    const { data: task, error: taskError } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (taskError || !task) {
      return null;
    }

    const { data: dependencies } = await client
      .from("task_dependencies")
      .select(
        "id, task_id, depends_on_task_id, dependency_type, created_at, depends_on_task:user_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("task_id", taskId);

    const { data: dependents } = await client
      .from("task_dependencies")
      .select(
        "id, task_id, depends_on_task_id, dependency_type, created_at, task:user_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("depends_on_task_id", taskId);

    const { data: progressPlans } = await client
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", taskId)
      .order("plan_date", { ascending: true });

    const { data: executions } = await client
      .from("task_executions")
      .select("*")
      .eq("task_id", taskId)
      .order("started_at", { ascending: false })
      .limit(20);

    const { count: focusSessionCount, error: fsCountError } = await client
      .from("focus_sessions")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId);
    if (fsCountError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        message: `Failed to count focus sessions: ${fsCountError.message}`,
      });
    }

    const { data: subtasks } = await client
      .from("task_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    const estimatedDuration = task.estimated_duration as number | null;
    const requiredTimeSlots = estimatedDuration
      ? Math.ceil(estimatedDuration / 25)
      : undefined;

    const subtaskCount = subtasks?.length || 0;
    const subtaskCompleted =
      subtasks?.filter((s) => s.status === "completed").length || 0;

    return {
      ...task,
      dependencies: dependencies || [],
      dependents: dependents || [],
      progress_plans: progressPlans || [],
      executions: executions || [],
      subtasks: subtasks || [],
      required_time_slots: requiredTimeSlots,
      subtask_count: subtaskCount,
      subtask_completed: subtaskCompleted,
      has_subtasks: subtaskCount > 0,
      focus_session_count: focusSessionCount || 0,
    };
  }

  async listQueuesWithStats(
    client: SupabaseClient,
    userId: string,
    options: {
      includeCompleted?: boolean;
      includeCancelled?: boolean;
    },
  ): Promise<{
    q0: Array<Record<string, unknown>>;
    q1: Array<Record<string, unknown>>;
    q2: Array<Record<string, unknown>>;
  }> {
    const statusFilter: string[] = ["pending", "in_progress", "paused"];
    if (options.includeCompleted) {
      statusFilter.push("completed");
    }
    if (options.includeCancelled) {
      statusFilter.push("cancelled");
    }

    const { data: tasks, error } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      )
      .in("status", statusFilter)
      .order("queue_level", { ascending: true })
      .order("position", { ascending: true });

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_QUEUE_ERROR, {
        details: { originalError: error.message },
      });
    }

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      const { data: subtaskStats } = await client
        .from("task_subtasks")
        .select("task_id, status")
        .in("task_id", taskIds);

      const subtaskCounts = new Map<
        string,
        { total: number; completed: number }
      >();
      if (subtaskStats) {
        for (const st of subtaskStats) {
          const existing = subtaskCounts.get(st.task_id) || {
            total: 0,
            completed: 0,
          };
          existing.total++;
          if (st.status === "completed") {
            existing.completed++;
          }
          subtaskCounts.set(st.task_id, existing);
        }
      }

      for (const task of tasks) {
        const stats = subtaskCounts.get(task.id);
        const taskRecord = task as Record<string, unknown>;
        taskRecord.subtask_count = stats?.total || 0;
        taskRecord.subtask_completed = stats?.completed || 0;
        taskRecord.has_subtasks = (stats?.total || 0) > 0;
      }
    }

    // 单趟遍历分组，避免 3 次 O(n) filter 扫描同一数组
    const q0: Array<Record<string, unknown>> = [];
    const q1: Array<Record<string, unknown>> = [];
    const q2: Array<Record<string, unknown>> = [];
    for (const t of tasks ?? []) {
      if (t.queue_level === 0) q0.push(t as Record<string, unknown>);
      else if (t.queue_level === 1) q1.push(t as Record<string, unknown>);
      else if (t.queue_level === 2) q2.push(t as Record<string, unknown>);
    }

    return { q0, q1, q2 };
  }
}

export const taskService = new TaskService();
