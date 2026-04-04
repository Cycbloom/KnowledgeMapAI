import { SupabaseClient } from "@supabase/supabase-js";
import { sm2Service, SM2Result } from "./sm2Service";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";

export interface ReviewTask {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  task_id: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  next_review_date: string;
  last_review_date: string | null;
  last_quality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewTaskData {
  knowledge_point_id: string;
  task_id: string;
}

export interface UpdateReviewTaskData {
  quality: number;
}

export interface ReviewTaskStats {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  future: number;
  averageEaseFactor: number;
  averageInterval: number;
  averageRepetitions: number;
}

export interface PendingReviewTask extends ReviewTask {
  urgency: "overdue" | "today" | "upcoming" | "future";
  masteryLevel: number;
}

export class ReviewTaskService {
  async createFirstReviewTask(
    client: SupabaseClient,
    userId: string,
    data: CreateReviewTaskData,
  ): Promise<ReviewTask> {
    const { data: existingTask, error: checkError } = await client
      .from("knowledge_review_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("knowledge_point_id", data.knowledge_point_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: checkError.message },
      });
    }

    if (existingTask) {
      throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
        details: { message: "该知识点已存在复习任务" },
      });
    }

    const initialParams = sm2Service.getInitialReviewParams();
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + initialParams.interval);

    const { data: reviewTask, error } = await client
      .from("knowledge_review_tasks")
      .insert({
        user_id: userId,
        knowledge_point_id: data.knowledge_point_id,
        task_id: data.task_id,
        interval_days: initialParams.interval,
        ease_factor: initialParams.easeFactor,
        repetitions: initialParams.repetitions,
        next_review_date: nextReviewDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
        details: { originalError: error.message },
      });
    }

    logger.info("First review task created", {
      userId,
      knowledgePointId: data.knowledge_point_id,
      taskId: data.task_id,
    });

    return reviewTask as ReviewTask;
  }

  async updateReviewTask(
    client: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    data: UpdateReviewTaskData,
  ): Promise<ReviewTask> {
    const { data: existingTask, error: fetchError } = await client
      .from("knowledge_review_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
          details: { message: "复习任务不存在" },
        });
      }
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: fetchError.message },
      });
    }

    const sm2Result: SM2Result = sm2Service.calculateNextReview({
      quality: data.quality,
      interval: existingTask.interval_days,
      easeFactor: existingTask.ease_factor,
      repetitions: existingTask.repetitions,
    });

    const { data: updatedTask, error: updateError } = await client
      .from("knowledge_review_tasks")
      .update({
        interval_days: sm2Result.interval,
        ease_factor: sm2Result.easeFactor,
        repetitions: sm2Result.repetitions,
        next_review_date: sm2Result.nextReviewDate.toISOString(),
        last_review_date: new Date().toISOString(),
        last_quality_score: data.quality,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTask.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateError.message },
      });
    }

    logger.info("Review task updated", {
      userId,
      knowledgePointId,
      quality: data.quality,
      newInterval: sm2Result.interval,
      newEaseFactor: sm2Result.easeFactor,
    });

    return updatedTask as ReviewTask;
  }

  async getPendingReviewTasks(
    client: SupabaseClient,
    userId: string,
    limit?: number,
  ): Promise<PendingReviewTask[]> {
    let query = client
      .from("knowledge_review_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("next_review_date", { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: tasks, error } = await query;

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    const pendingTasks: PendingReviewTask[] = (tasks as ReviewTask[]).map(
      (task) => {
        const urgency = sm2Service.calculateUrgency({
          id: task.id,
          knowledge_point_id: task.knowledge_point_id,
          interval_days: task.interval_days,
          ease_factor: task.ease_factor,
          repetitions: task.repetitions,
          next_review_date: task.next_review_date,
          last_review_date: task.last_review_date ?? undefined,
          last_quality_score: task.last_quality_score ?? undefined,
        });

        const masteryLevel = sm2Service.estimateMasteryLevel(
          task.ease_factor,
          task.repetitions,
          task.interval_days,
        );

        return {
          ...task,
          urgency,
          masteryLevel,
        };
      },
    );

    return pendingTasks;
  }

  async getReviewTaskStats(
    client: SupabaseClient,
    userId: string,
  ): Promise<ReviewTaskStats> {
    const { data: tasks, error } = await client
      .from("knowledge_review_tasks")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    const reviewTasks = tasks as ReviewTask[];

    if (reviewTasks.length === 0) {
      return {
        total: 0,
        overdue: 0,
        today: 0,
        upcoming: 0,
        future: 0,
        averageEaseFactor: 0,
        averageInterval: 0,
        averageRepetitions: 0,
      };
    }

    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let future = 0;
    let totalEaseFactor = 0;
    let totalInterval = 0;
    let totalRepetitions = 0;

    for (const task of reviewTasks) {
      const urgency = sm2Service.calculateUrgency({
        id: task.id,
        knowledge_point_id: task.knowledge_point_id,
        interval_days: task.interval_days,
        ease_factor: task.ease_factor,
        repetitions: task.repetitions,
        next_review_date: task.next_review_date,
        last_review_date: task.last_review_date ?? undefined,
        last_quality_score: task.last_quality_score ?? undefined,
      });

      switch (urgency) {
        case "overdue":
          overdue++;
          break;
        case "today":
          today++;
          break;
        case "upcoming":
          upcoming++;
          break;
        case "future":
          future++;
          break;
      }

      totalEaseFactor += task.ease_factor;
      totalInterval += task.interval_days;
      totalRepetitions += task.repetitions;
    }

    const count = reviewTasks.length;

    return {
      total: count,
      overdue,
      today,
      upcoming,
      future,
      averageEaseFactor: Math.round((totalEaseFactor / count) * 100) / 100,
      averageInterval: Math.round((totalInterval / count) * 100) / 100,
      averageRepetitions: Math.round((totalRepetitions / count) * 100) / 100,
    };
  }

  async getReviewTaskByKnowledgePoint(
    client: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<ReviewTask | null> {
    const { data, error } = await client
      .from("knowledge_review_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return data as ReviewTask;
  }

  async deleteReviewTask(
    client: SupabaseClient,
    userId: string,
    knowledgePointId: string,
  ): Promise<void> {
    const { error } = await client
      .from("knowledge_review_tasks")
      .delete()
      .eq("user_id", userId)
      .eq("knowledge_point_id", knowledgePointId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    logger.info("Review task deleted", {
      userId,
      knowledgePointId,
    });
  }
}

export const reviewTaskService = new ReviewTaskService();
