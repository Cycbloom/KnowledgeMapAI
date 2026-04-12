import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { taskQueue } from "./common/queueService";
import { sseService } from "./core/sseService";
import { logger } from "../utils/logger";
import { getProcessor } from "./taskProcessors/index";
import { getPaginationParams, PaginationOptions } from "../utils/pagination";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import "./taskProcessors/batchGenerateCardsProcessor.js";
import "./taskProcessors/recursiveGraphProcessor.js";
import "./taskProcessors/infiniteExpansionProcessor.js";
import "./taskProcessors/embeddingGenerationProcessor.js";
import "./taskProcessors/quizGenerationProcessor.js";
import "./taskProcessors/generateQuestionsProcessor.js";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env.production') });
  dotenv.config();
} catch (err) {
  logger.warn('Failed to load .env file in taskService:', err);
}

export interface TaskPayload {
  [key: string]: unknown;
  graph_id?: string;
  knowledge_point_id?: string;
  node_id?: string;
  node_title?: string;
  node_content?: string;
  provider?: string;
  model?: string;
  config?: {
    types?: string[];
    count?: number;
    pack_template?: string;
    provider?: string;
    model?: string;
  };
}

export interface TaskResult {
  [key: string]: unknown;
}

export interface Task {
  id: string;
  user_id: string;
  type: string;
  name?: string;
  status: "pending" | "processing" | "completed" | "failed";
  payload: TaskPayload;
  result?: TaskResult;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskProgress {
  stage?: string;
  progress?: number;
  [key: string]: unknown;
}

export interface UpdateTaskStatusOptions {
  taskId: string;
  status: string;
  progress?: TaskProgress | null;
  result?: TaskResult;
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
  logger.error('Failed to initialize TaskService Supabase client:', error);
  defaultClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export class TaskService {
  async createTask(userId: string, type: string, payload?: TaskPayload, name?: string) {
    const supabase = defaultClient;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        type,
        name,
        status: "pending",
        payload: payload || {},
      })
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to create task: ${error.message}` });

    if (taskQueue) {
      await taskQueue.add(type, { taskId: data.id });
    } else {
      logger.info("Task queue not available, processing task synchronously");
      this.processTaskAsync(data.id, userId, type, payload || {}).catch((err) => {
        logger.error(`Failed to process task ${data.id} synchronously:`, err);
      });
    }

    return data as Task;
  }

  private async processTaskAsync(
    taskId: string,
    userId: string,
    type: string,
    payload: TaskPayload,
  ) {
    try {
      await this.processTask(taskId, userId, type, payload);
    } catch (error) {
      logger.error(`Error in async task processing for task ${taskId}:`, error);
    }
  }

  async updateTaskStatus(
    arg1: SupabaseClient | string | UpdateTaskStatusOptions,
    arg2?: string,
    arg3?: string,
    arg4?: TaskProgress | null,
    arg5?: TaskResult,
    arg6?: string,
    arg7?: string,
  ) {
    let supabase: SupabaseClient;
    let taskId: string;
    let status: string;
    let progress: TaskProgress | null | undefined;
    let result: TaskResult | undefined;
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
        result = arg3 as TaskResult | undefined;
        errorMsg = arg4 as string | undefined;
        userId = arg5 as string | undefined;
        progress = undefined;
      }
    }

    const updateData: { status: string; updated_at: string; result?: TaskResult; error?: string } = { status, updated_at: new Date().toISOString() };
    if (progress !== undefined && progress !== null && result) updateData.result = { ...result, ...progress };
    else if (result !== undefined) updateData.result = result;
    if (errorMsg !== undefined) updateData.error = errorMsg;

    logger.info(`Updating task ${taskId} status to ${status}`, {
      stage: progress?.stage,
      progress: progress?.progress,
    });

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) throw error;

    if (userId) {
      sseService.sendToUser(userId, {
        type: "task_update",
        taskId,
        status,
        result: updateData.result,
        error: errorMsg,
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
      .from("tasks")
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
      .from("tasks")
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
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) throw error;
    return data as Task[];
  }

  async retryTask(client: SupabaseClient, taskId: string, userId: string) {
    const { data: task, error: fetchError } = await client
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !task) throw new AppError(ErrorCodes.NOT_FOUND, { message: "Task not found" });

    const { data, error } = await client
      .from("tasks")
      .update({
        status: "pending",
        error: null,
        result: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to retry task: ${error.message}` });

    if (taskQueue) {
      await taskQueue.add(data.type, { taskId: data.id });
    } else {
      logger.info(
        "Task queue not available, processing retried task synchronously",
      );
      this.processTaskAsync(data.id, userId, data.type, data.payload).catch(
        (err) => {
          logger.error(
            `Failed to process retried task ${data.id} synchronously:`,
            err,
          );
        },
      );
    }

    return data as Task;
  }

  async deleteTask(client: SupabaseClient, taskId: string, userId: string) {
    const { error } = await client
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `Failed to delete task: ${error.message}` });
  }

  async processTask(
    taskId: string,
    userId: string,
    type: string,
    payload: TaskPayload,
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

export const taskService = new TaskService();
