import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

interface AutoTaskResult {
  taskId: string;
  title: string;
  queueLevel: number;
  priority: number;
  created: boolean;
  reason: string;
}

class AutoTaskGenerator {
  async generateLearningTask(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    options?: {
      graphId?: string;
      title?: string;
    },
  ): Promise<AutoTaskResult> {
    const existing = await this.findExistingTask(
      supabase,
      userId,
      knowledgePointId,
      "learning",
    );
    if (existing) {
      return {
        taskId: existing.id,
        title: existing.title,
        queueLevel: existing.queue_level,
        priority: existing.priority,
        created: false,
        reason: "已存在关联的学习任务",
      };
    }

    let title = `学习: 知识点`;
    if (options?.title) {
      title = `学习: ${options.title}`;
    } else if (knowledgePointId) {
      const { data: kp } = await supabase
        .from("knowledge_points")
        .select("title")
        .eq("id", knowledgePointId)
        .single();
      if (kp?.title) {
        title = `学习: ${kp.title}`;
      }
    }

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", 1)
      );

    const { data: task, error } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title,
        queue_level: 1,
        position: count ?? 0,
        priority: 5,
        status: "pending",
        task_type: "learning",
        knowledge_point_id: knowledgePointId,
        estimated_duration: 25,
        tags: ["学习"],
        context: JSON.stringify({
          auto_generated: true,
          source: "auto_task_generator",
        }),
      })
      .select()
      .single();

    if (error) {
      logger.error(
        "[AutoTaskGenerator] Failed to create learning task:",
        error,
      );
      throw error;
    }

    return {
      taskId: task.id,
      title: task.title,
      queueLevel: task.queue_level,
      priority: task.priority,
      created: true,
      reason: "自动生成学习任务",
    };
  }

  async generateReviewTask(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    options?: {
      title?: string;
      intervalDays?: number;
    },
  ): Promise<AutoTaskResult> {
    const existing = await this.findExistingTask(
      supabase,
      userId,
      knowledgePointId,
      "review",
    );
    if (existing) {
      return {
        taskId: existing.id,
        title: existing.title,
        queueLevel: existing.queue_level,
        priority: existing.priority,
        created: false,
        reason: "已存在关联的复习任务",
      };
    }

    let title = `复习: 知识点`;
    if (options?.title) {
      title = `复习: ${options.title}`;
    } else if (knowledgePointId) {
      const { data: kp } = await supabase
        .from("knowledge_points")
        .select("title")
        .eq("id", knowledgePointId)
        .single();
      if (kp?.title) {
        title = `复习: ${kp.title}`;
      }
    }

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", 0)
      );

    const today = new Date();
    today.setHours(9, 0, 0, 0);

    const { data: task, error } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title,
        queue_level: 0,
        position: count ?? 0,
        priority: 8,
        status: "pending",
        task_type: "learning",
        knowledge_point_id: knowledgePointId,
        estimated_duration: 15,
        tags: ["复习"],
        scheduled_start: today.toISOString(),
        context: JSON.stringify({
          auto_generated: true,
          source: "auto_task_generator",
          review_interval_days: options?.intervalDays,
        }),
      })
      .select()
      .single();

    if (error) {
      logger.error("[AutoTaskGenerator] Failed to create review task:", error);
      throw error;
    }

    return {
      taskId: task.id,
      title: task.title,
      queueLevel: task.queue_level,
      priority: task.priority,
      created: true,
      reason: "自动生成复习任务",
    };
  }

  async generatePathNodeTask(
    supabase: SupabaseClient,
    _userId: string,
    pathNodeId: string,
    parentTaskId: string,
    options?: {
      title?: string;
      estimatedTime?: number;
    },
  ): Promise<AutoTaskResult> {
    const { data: existingSubtask } = await supabase
      .from("task_subtasks")
      .select("id, title, status")
      .eq("learning_path_node_id", pathNodeId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingSubtask) {
      return {
        taskId: parentTaskId,
        title: existingSubtask.title,
        queueLevel: 1,
        priority: 5,
        created: false,
        reason: "已存在关联的学习路径子任务",
      };
    }

    let title = `学习路径节点`;
    if (options?.title) {
      title = options.title;
    } else {
      const { data: node } = await supabase
        .from("learning_path_nodes")
        .select("title")
        .eq("id", pathNodeId)
        .single();
      if (node?.title) {
        title = node.title;
      }
    }

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: parentTaskId,
        title,
        status: "pending",
        priority: 5,
        estimated_duration: options?.estimatedTime || 25,
        learning_path_node_id: pathNodeId,
      })
      .select()
      .single();

    if (error) {
      logger.error(
        "[AutoTaskGenerator] Failed to create path node subtask:",
        error,
      );
      throw error;
    }

    return {
      taskId: parentTaskId,
      title: subtask.title,
      queueLevel: 1,
      priority: 5,
      created: true,
      reason: "自动生成学习路径子任务",
    };
  }

  private async findExistingTask(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    _taskContext: string,
  ) {
    const { data } = await notDeleted(supabase
      .from("user_tasks")
      .select("id, title, queue_level, priority, status")
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .in("status", ["pending", "in_progress", "paused"])
      )
      .limit(1)
      .maybeSingle();

    return data;
  }
}

export const autoTaskGenerator = new AutoTaskGenerator();
export type { AutoTaskResult };
