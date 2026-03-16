import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { taskQueue } from "./common/queueService.js";
import { sseService } from "./core/sseService.js";
import { logger } from "../utils/logger.js";
import { getProcessor } from "./taskProcessors/index.js";
import { getPaginationParams, PaginationOptions } from "../utils/pagination.js";
import "./taskProcessors/batchGenerateCardsProcessor.js";
import "./taskProcessors/recursiveGraphProcessor.js";
import "./taskProcessors/infiniteExpansionProcessor.js";
import "./taskProcessors/embeddingGenerationProcessor.js";
import "./taskProcessors/quizGenerationProcessor.js";
import dotenv from "dotenv";

dotenv.config();

export interface Task {
  id: string;
  user_id: string;
  type: string;
  name?: string;
  status: "pending" | "processing" | "completed" | "failed";
  payload: any;
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const defaultClient = createClient(
  supabaseUrl!,
  supabaseServiceKey || supabaseKey!,
);

export class TaskService {
  async createTask(userId: string, type: string, payload?: any, name?: string) {
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

    if (error) throw new Error(`Failed to create task: ${error.message}`);

    if (taskQueue) {
      await taskQueue.add(type, { taskId: data.id });
    } else {
      logger.info("Task queue not available, processing task synchronously");
      this.processTaskAsync(data.id, userId, type, payload).catch((err) => {
        logger.error(`Failed to process task ${data.id} synchronously:`, err);
      });
    }

    return data as Task;
  }

  private async processTaskAsync(
    taskId: string,
    userId: string,
    type: string,
    payload: any,
  ) {
    try {
      await this.processTask(taskId, userId, type, payload);
    } catch (error) {
      logger.error(`Error in async task processing for task ${taskId}:`, error);
    }
  }

  async updateTaskStatus(
    client: SupabaseClient | string,
    taskId: string,
    status: string,
    progress?: {
      stage?: string;
      progress?: number;
      [key: string]: unknown;
    } | null,
    result?: any,
    errorMsg?: string,
    userId?: string,
  ) {
    let supabase: SupabaseClient;
    let tid: string;
    let s: string;
    let p:
      | { stage?: string; progress?: number; [key: string]: unknown }
      | null
      | undefined;
    let r: any;
    let e: string | undefined;
    let uid: string | undefined;

    if (typeof client !== "string" && client !== undefined) {
      supabase = client;
      tid = taskId;
      s = status;
      p = progress;
      r = result;
      e = errorMsg;
      uid = userId;
    } else {
      supabase = defaultClient;
      tid = client as string;
      s = taskId;
      r = status;
      e = progress as string | undefined;
      uid = result as string | undefined;
      p = undefined;
    }

    const updateData: any = { status: s, updated_at: new Date().toISOString() };
    if (p !== undefined && p !== null) updateData.result = { ...r, ...p };
    else if (r !== undefined) updateData.result = r;
    if (e !== undefined) updateData.error = e;

    logger.info(`Updating task ${tid} status to ${s}`, {
      stage: p?.stage,
      progress: p?.progress,
    });

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", tid);

    if (error) throw error;

    if (uid) {
      sseService.sendToUser(uid, {
        type: "task_update",
        taskId: tid,
        status: s,
        result: updateData.result,
        error: e,
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
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
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
      throw new Error(`Failed to fetch task: ${error.message}`);
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

    if (fetchError || !task) throw new Error("Task not found");

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

    if (error) throw new Error(`Failed to retry task: ${error.message}`);

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

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }

  async processTask(
    taskId: string,
    userId: string,
    type: string,
    payload: any,
  ) {
    const supabase = defaultClient;
    const processor = getProcessor(type);

    if (!processor) {
      logger.error(`No processor found for task type: ${type}`);
      await this.updateTaskStatus(
        supabase,
        taskId,
        "failed",
        null,
        `Unknown task type: ${type}`,
        userId,
      );
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
