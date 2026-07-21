import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sseService } from "./core/sseService";
import { logger } from "../utils/logger";
import { getProcessor } from "./taskProcessors/index";
import { getPaginationParams, PaginationOptions } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { Task } from "../../shared/types/common";
import type { SystemTaskType, SystemTask } from "../../shared/types/scheduler";
import "./taskProcessors/batchGenerateCardsProcessor.js";
import "./taskProcessors/recursiveGraphProcessor.js";
import "./taskProcessors/infiniteExpansionProcessor.js";
import "./taskProcessors/embeddingGenerationProcessor.js";
import "./taskProcessors/quizGenerationProcessor.js";
import "./taskProcessors/generateQuestionsProcessor.js";

export interface TaskProgress {
  stage?: string;
  progress?: number;
  [key: string]: unknown;
}

export interface UpdateTaskStatusOptions {
  taskId: string;
  status: string;
  progress?: TaskProgress | null;
  result?: Record<string, unknown>;
  error?: string;
  userId?: string;
  client?: SupabaseClient;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let defaultClient: SupabaseClient;

try {
  const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
  const validKey = supabaseServiceKey || supabaseKey || 'placeholder-key';
  
  defaultClient = createClient(validUrl, validKey);
  logger.info('TaskService Supabase client initialized successfully');
} catch (error) {
  logger.error('Failed to initialize AsyncTaskService Supabase client:', error);
  defaultClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export class AsyncTaskService {
  private static readonly MAX_CONCURRENT = 3;
  private activeCount = 0;

  private mapTaskTypeToSystemTaskType(type: string): SystemTaskType {
    const typeMap: Record<string, SystemTaskType> = {
      "generate_questions": "ai_generation",
      "batch_generate_questions": "ai_generation",
      "expand_graph": "graph_expansion",
      "recursive_graph_generation": "graph_expansion",
      "infinite_graph_expansion": "graph_expansion",
      "embedding_generation": "knowledge_sync",
    };
    return typeMap[type] || "ai_generation";
  }

  /**
   * 启动恢复：查询滞留的 pending 任务（created_at 早于 5 分钟前）并恢复执行。
   *
   * 用于进程重启后恢复因崩溃/重启而中断的 pending 任务。非阻塞调用，
   * 内部错误被捕获并记录，不影响主进程启动。
   */
  async initialize(): Promise<void> {
    try {
      const supabase = defaultClient;
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

      const { data, error } = await supabase
        .from("system_tasks")
        .select("*")
        .eq("status", "pending")
        .lt("created_at", fiveMinAgo.toISOString())
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) {
        logger.error("asyncTaskService.initialize: failed to fetch stalled tasks:", error);
        return;
      }

      const stalledTasks = (data as SystemTask[] | null) ?? [];
      if (stalledTasks.length === 0) {
        logger.info("asyncTaskService.initialize: no stalled tasks to recover");
        return;
      }

      logger.info(`asyncTaskService.initialize: recovering ${stalledTasks.length} stalled task(s)`);

      for (const task of stalledTasks) {
        const originalType = this.getOriginalTaskType(task.task_type);
        const payload = (task.input_data as Record<string, unknown>) ?? {};
        this.processTaskAsync(task.id, task.user_id, originalType, payload).catch((err) => {
          logger.error(`asyncTaskService.initialize: failed to recover task ${task.id}:`, err);
        });
      }
    } catch (error) {
      logger.error("asyncTaskService.initialize: unexpected error:", error);
    }
  }

  /**
   * 乐观锁 claim：原子地将任务从 pending → running。
   *
   * 使用 `UPDATE ... WHERE id = ? AND status = 'pending' RETURNING *` 模式，
   * 多实例并发时仅一者能 claim 成功（返回非空数组），其余返回空数组并跳过。
   *
   * @returns claim 成功返回 true，失败（已被其他实例处理或不存在）返回 false
   */
  private async claimTask(taskId: string): Promise<boolean> {
    const supabase = defaultClient;
    const { data, error } = await supabase
      .from("system_tasks")
      .update({
        status: "running",
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("status", "pending")
      .select();

    if (error) {
      logger.error(`claimTask: failed to claim task ${taskId}:`, error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  async createTask(userId: string, type: string, payload?: Record<string, unknown>, name?: string) {
    const supabase = defaultClient;
    const systemTaskType = this.mapTaskTypeToSystemTaskType(type);

    const { data, error } = await supabase
      .from("system_tasks")
      .insert({
        user_id: userId,
        task_type: systemTaskType,
        title: name || type,
        status: "pending",
        input_data: payload || {},
      })
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to create task: ${error.message}` });

    logger.info("Processing task synchronously");
    this.processTaskAsync(data.id, userId, type, payload || {}).catch((err) => {
      logger.error(`Failed to process task ${data.id} synchronously:`, err);
    });

    return data as Task;
  }

  /**
   * 异步处理任务：先通过 claimTask 原子抢占，再执行 processTask。
   *
   * 并发控制：全局 MAX_CONCURRENT=3 信号量，超过上限的任务保留 pending
   * 状态等待下次轮询（initialize 或 createTask 触发）。
   *
   * 注意：activeCount 必须在 await 之前同步递增，否则在 for 循环中并发调用
   * processTaskAsync 时所有任务都会通过并发检查，导致信号量失效。
   */
  private async processTaskAsync(
    taskId: string,
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    this.activeCount += 1;
    if (this.activeCount > AsyncTaskService.MAX_CONCURRENT) {
      this.activeCount -= 1;
      logger.info(`processTaskAsync: concurrency limit reached, skipping task ${taskId} (will retry on next poll)`);
      return;
    }

    try {
      const claimed = await this.claimTask(taskId);
      if (!claimed) {
        logger.info(`processTaskAsync: task ${taskId} already claimed by another instance, skipping`);
        return;
      }

      await this.processTask(taskId, userId, type, payload);
    } catch (error) {
      logger.error(`Error in async task processing for task ${taskId}:`, error);
    } finally {
      this.activeCount -= 1;
    }
  }

  async updateTaskStatus(
    arg1: SupabaseClient | string | UpdateTaskStatusOptions,
    arg2?: string,
    arg3?: string,
    arg4?: TaskProgress | null,
    arg5?: Record<string, unknown>,
    arg6?: string,
    arg7?: string,
  ) {
    let supabase: SupabaseClient;
    let taskId: string;
    let status: string;
    let progress: TaskProgress | null | undefined;
    let result: Record<string, unknown> | undefined;
    let errorMsg: string | undefined;
    let userId: string | undefined;

    if (typeof arg1 === 'object' && arg1 !== null && 'taskId' in arg1 && 'status' in arg1) {
      const options = arg1 as UpdateTaskStatusOptions;
      supabase = options.client || defaultClient;
      taskId = options.taskId;
      status = options.status;
      progress = options.progress;
      result = options.result;
      errorMsg = options.error;
      userId = options.userId;
    } else {
      if (typeof arg1 !== "string" && arg1 !== undefined) {
        supabase = arg1 as SupabaseClient;
        taskId = arg2!;
        status = arg3!;
        progress = arg4;
        result = arg5;
        errorMsg = arg6;
        userId = arg7;
      } else {
        supabase = defaultClient;
        taskId = arg1 as string;
        status = arg2!;
        result = arg3 as unknown as Record<string, unknown> | undefined;
        errorMsg = arg4 as unknown as string | undefined;
        userId = arg5 as unknown as string | undefined;
        progress = undefined;
      }
    }

    const updateData: { status: string; updated_at: string; output_data?: Record<string, unknown>; error_message?: string } = { status, updated_at: new Date().toISOString() };
    if (result) updateData.output_data = result;
    if (errorMsg) updateData.error_message = errorMsg;

    logger.info(`Updating task ${taskId} status to ${status}`, {
      stage: progress?.stage,
      progress: progress?.progress,
    });

    const { error } = await supabase
      .from("system_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) throw error;

    if (userId) {
      sseService.sendToUser(userId, {
        type: "task_update",
        taskId,
        status,
        result,
        error: errorMsg,
        // 透传 processor 计算的运行时进度（stage/percent/completed/total 等），
        // 前端 useTaskEvents 将其写入 task.runtime_progress 字段。
        // progress 为 undefined/null 时 JSON.stringify 会省略该字段，前端降级为原 spinner。
        progress: progress ?? undefined,
      });
    }
  }

  async getTasks(
    client: SupabaseClient,
    userId: string,
    status?: string,
    options?: PaginationOptions,
  ) {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from("system_tasks")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, end);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to fetch tasks: ${error.message}` });
    return { tasks: data as Task[], total: count || 0 };
  }

  async getTask(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<Task | null> {
    const { data, error } = await client
      .from("system_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116")
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to fetch task: ${error.message}` });
    return data as Task | null;
  }

  async getPendingTasks(client: SupabaseClient) {
    const { data, error } = await client
      .from("system_tasks")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) throw error;
    return data as Task[];
  }

  async retryTask(client: SupabaseClient, taskId: string, userId: string) {
    const { data: task, error: fetchError } = await client
      .from("system_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !task) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: "Task not found" });

    const { data, error } = await client
      .from("system_tasks")
      .update({
        status: "pending",
        retry_count: (task.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to retry task: ${error.message}` });

    logger.info("Processing retried task synchronously");
    const originalType = this.getOriginalTaskType(task.task_type);
    this.processTaskAsync(data.id, userId, originalType, (task.input_data as Record<string, unknown>) || {}).catch(
      (err) => {
        logger.error(
          `Failed to process retried task ${data.id} synchronously:`,
          err,
        );
      },
    );

    return data as Task;
  }

  private getOriginalTaskType(systemTaskType: string): string {
    const reverseMap: Record<string, string> = {
      "ai_generation": "generate_questions",
      "graph_expansion": "expand_graph",
      "knowledge_sync": "embedding_generation",
    };
    return reverseMap[systemTaskType] || systemTaskType;
  }

  async deleteTask(client: SupabaseClient, taskId: string, userId: string) {
    const { error } = await client
      .from("system_tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to delete task: ${error.message}` });
  }

  async processTask(
    taskId: string,
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    const supabase = defaultClient;
    const processor = getProcessor(type);

    if (!processor) {
      logger.error(`No processor found for task type: ${type}`);
      await this.updateTaskStatus({
        taskId,
        status: "failed",
        error: `Unknown task type: ${type}`,
        userId,
      });
      return;
    }

    await processor.process(
      taskId,
      userId,
      payload,
      supabase,
      this.updateTaskStatus.bind(this),
    );
  }
}

export const asyncTaskService = new AsyncTaskService();
