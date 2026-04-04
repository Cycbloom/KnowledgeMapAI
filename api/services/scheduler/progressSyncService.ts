import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export interface SyncStudyDurationParams {
  taskId: string;
  userId: string;
  durationMinutes: number;
}

export interface SyncTaskCompletionParams {
  taskId: string;
  userId: string;
  completionQuality?: number;
}

export interface KnowledgePointProgress {
  knowledgePointId: string;
  relevanceScore: number;
  isPrimary: boolean;
  durationAllocated: number;
  progressIncrement: number;
}

export interface ProgressSyncResult {
  task: {
    id: string;
    actualDuration: number;
    progressPercentage: number;
  };
  knowledgePoints: Array<{
    id: string;
    masteryLevel: number;
    totalStudyDuration: number;
    lastStudyAt: string;
  }>;
}

export interface TaskKnowledgePointRelation {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  relevance_score: number;
  is_primary: boolean;
  notes?: string;
  created_at: string;
}

const MASTERY_INCREMENT_BASE = 0.05;
const MASTERY_MAX = 1.0;
const MASTERY_MIN = 0.0;

export class ProgressSyncService {
  async syncStudyDuration(
    client: SupabaseClient,
    params: SyncStudyDurationParams
  ): Promise<ProgressSyncResult> {
    const { taskId, userId, durationMinutes } = params;

    logger.info('Syncing study duration', { taskId, userId, durationMinutes });

    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: taskError?.message },
      });
    }

    const knowledgePointRelations = await this.getTaskKnowledgePoints(client, taskId);

    const progressAllocations = this.allocateProgressByRelevance(
      durationMinutes,
      knowledgePointRelations
    );

    const currentActualDuration = task.actual_duration ?? 0;
    const newActualDuration = currentActualDuration + durationMinutes;

    let newProgressPercentage = task.progress_percentage ?? 0;
    if (task.estimated_duration && task.estimated_duration > 0) {
      newProgressPercentage = Math.min(
        100,
        Math.round((newActualDuration / task.estimated_duration) * 100)
      );
    }

    const { error: updateTaskError } = await client
      .from("scheduled_tasks")
      .update({
        actual_duration: newActualDuration,
        progress_percentage: newProgressPercentage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateTaskError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateTaskError.message },
      });
    }

    const updatedKnowledgePoints = await this.updateKnowledgePointsProgress(
      client,
      progressAllocations
    );

    logger.info('Study duration synced successfully', {
      taskId,
      newActualDuration,
      newProgressPercentage,
      knowledgePointsUpdated: updatedKnowledgePoints.length,
    });

    return {
      task: {
        id: taskId,
        actualDuration: newActualDuration,
        progressPercentage: newProgressPercentage,
      },
      knowledgePoints: updatedKnowledgePoints,
    };
  }

  async syncTaskCompletion(
    client: SupabaseClient,
    params: SyncTaskCompletionParams
  ): Promise<ProgressSyncResult> {
    const { taskId, userId, completionQuality = 4 } = params;

    logger.info('Syncing task completion', { taskId, userId, completionQuality });

    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: taskError?.message },
      });
    }

    const knowledgePointRelations = await this.getTaskKnowledgePoints(client, taskId);

    const qualityMultiplier = this.getQualityMultiplier(completionQuality);

    const updatedKnowledgePoints = await this.updateKnowledgePointsMastery(
      client,
      knowledgePointRelations,
      qualityMultiplier
    );

    const { error: updateTaskError } = await client
      .from("scheduled_tasks")
      .update({
        progress_percentage: 100,
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateTaskError) {
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        details: { originalError: updateTaskError.message },
      });
    }

    logger.info('Task completion synced successfully', {
      taskId,
      knowledgePointsUpdated: updatedKnowledgePoints.length,
    });

    return {
      task: {
        id: taskId,
        actualDuration: task.actual_duration ?? 0,
        progressPercentage: 100,
      },
      knowledgePoints: updatedKnowledgePoints,
    };
  }

  private async getTaskKnowledgePoints(
    client: SupabaseClient,
    taskId: string
  ): Promise<TaskKnowledgePointRelation[]> {
    const { data: relations, error } = await client
      .from("task_knowledge_points")
      .select("*")
      .eq("task_id", taskId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (relations as TaskKnowledgePointRelation[]) ?? [];
  }

  private allocateProgressByRelevance(
    totalDuration: number,
    relations: TaskKnowledgePointRelation[]
  ): KnowledgePointProgress[] {
    if (relations.length === 0) {
      return [];
    }

    const totalRelevance = relations.reduce(
      (sum, r) => sum + r.relevance_score,
      0
    );

    if (totalRelevance === 0) {
      const equalShare = totalDuration / relations.length;
      return relations.map((r) => ({
        knowledgePointId: r.knowledge_point_id,
        relevanceScore: r.relevance_score,
        isPrimary: r.is_primary,
        durationAllocated: equalShare,
        progressIncrement: equalShare,
      }));
    }

    return relations.map((r) => {
      const weight = r.relevance_score / totalRelevance;
      const durationAllocated = totalDuration * weight;
      const progressIncrement = durationAllocated;

      return {
        knowledgePointId: r.knowledge_point_id,
        relevanceScore: r.relevance_score,
        isPrimary: r.is_primary,
        durationAllocated,
        progressIncrement,
      };
    });
  }

  private async updateKnowledgePointsProgress(
    client: SupabaseClient,
    allocations: KnowledgePointProgress[]
  ): Promise<Array<{
    id: string;
    masteryLevel: number;
    totalStudyDuration: number;
    lastStudyAt: string;
  }>> {
    const results: Array<{
      id: string;
      masteryLevel: number;
      totalStudyDuration: number;
      lastStudyAt: string;
    }> = [];

    for (const allocation of allocations) {
      const { data: kp, error: kpError } = await client
        .from("knowledge_points")
        .select("mastery_level, total_study_duration")
        .eq("id", allocation.knowledgePointId)
        .single();

      if (kpError || !kp) {
        logger.warn('Knowledge point not found for progress update', {
          knowledgePointId: allocation.knowledgePointId,
        });
        continue;
      }

      const currentMastery = kp.mastery_level ?? 0;
      const currentDuration = kp.total_study_duration ?? 0;

      const masteryIncrement = this.calculateMasteryIncrement(
        allocation.durationAllocated,
        allocation.isPrimary
      );
      const newMastery = Math.min(
        MASTERY_MAX,
        Math.max(MASTERY_MIN, currentMastery + masteryIncrement)
      );
      const newDuration = currentDuration + Math.round(allocation.durationAllocated);
      const now = new Date().toISOString();

      const { error: updateError } = await client
        .from("knowledge_points")
        .update({
          mastery_level: newMastery,
          total_study_duration: newDuration,
          last_study_at: now,
          updated_at: now,
        })
        .eq("id", allocation.knowledgePointId);

      if (updateError) {
        logger.error('Failed to update knowledge point progress', {
          knowledgePointId: allocation.knowledgePointId,
          error: updateError.message,
        });
        continue;
      }

      results.push({
        id: allocation.knowledgePointId,
        masteryLevel: newMastery,
        totalStudyDuration: newDuration,
        lastStudyAt: now,
      });
    }

    return results;
  }

  private async updateKnowledgePointsMastery(
    client: SupabaseClient,
    relations: TaskKnowledgePointRelation[],
    qualityMultiplier: number
  ): Promise<Array<{
    id: string;
    masteryLevel: number;
    totalStudyDuration: number;
    lastStudyAt: string;
  }>> {
    const results: Array<{
      id: string;
      masteryLevel: number;
      totalStudyDuration: number;
      lastStudyAt: string;
    }> = [];

    for (const relation of relations) {
      const { data: kp, error: kpError } = await client
        .from("knowledge_points")
        .select("mastery_level, total_study_duration")
        .eq("id", relation.knowledge_point_id)
        .single();

      if (kpError || !kp) {
        logger.warn('Knowledge point not found for mastery update', {
          knowledgePointId: relation.knowledge_point_id,
        });
        continue;
      }

      const currentMastery = kp.mastery_level ?? 0;
      const currentDuration = kp.total_study_duration ?? 0;

      const masteryIncrement = this.calculateCompletionMasteryIncrement(
        currentMastery,
        relation.is_primary,
        relation.relevance_score,
        qualityMultiplier
      );
      const newMastery = Math.min(
        MASTERY_MAX,
        Math.max(MASTERY_MIN, currentMastery + masteryIncrement)
      );
      const now = new Date().toISOString();

      const { error: updateError } = await client
        .from("knowledge_points")
        .update({
          mastery_level: newMastery,
          last_study_at: now,
          updated_at: now,
        })
        .eq("id", relation.knowledge_point_id);

      if (updateError) {
        logger.error('Failed to update knowledge point mastery', {
          knowledgePointId: relation.knowledge_point_id,
          error: updateError.message,
        });
        continue;
      }

      results.push({
        id: relation.knowledge_point_id,
        masteryLevel: newMastery,
        totalStudyDuration: currentDuration,
        lastStudyAt: now,
      });
    }

    return results;
  }

  private calculateMasteryIncrement(
    durationMinutes: number,
    isPrimary: boolean
  ): number {
    const baseIncrement = MASTERY_INCREMENT_BASE * (durationMinutes / 30);
    const primaryBonus = isPrimary ? 1.5 : 1.0;
    return baseIncrement * primaryBonus;
  }

  private calculateCompletionMasteryIncrement(
    currentMastery: number,
    isPrimary: boolean,
    relevanceScore: number,
    qualityMultiplier: number
  ): number {
    const diminishingFactor = 1 - currentMastery * 0.5;
    const primaryBonus = isPrimary ? 1.5 : 1.0;
    const relevanceFactor = relevanceScore / 100;

    const increment =
      MASTERY_INCREMENT_BASE *
      2 *
      diminishingFactor *
      primaryBonus *
      relevanceFactor *
      qualityMultiplier;

    return increment;
  }

  private getQualityMultiplier(quality: number): number {
    const qualityMultipliers: Record<number, number> = {
      0: 0.1,
      1: 0.3,
      2: 0.5,
      3: 0.8,
      4: 1.0,
      5: 1.2,
    };

    const clampedQuality = Math.max(0, Math.min(5, Math.round(quality)));
    return qualityMultipliers[clampedQuality] ?? 1.0;
  }

  async getTaskProgressSummary(
    client: SupabaseClient,
    taskId: string,
    userId: string
  ): Promise<{
    task: {
      id: string;
      title: string;
      actualDuration: number;
      estimatedDuration: number | null;
      progressPercentage: number;
    };
    knowledgePoints: Array<{
      id: string;
      title: string;
      masteryLevel: number;
      totalStudyDuration: number;
      lastStudyAt: string | null;
      relevanceScore: number;
      isPrimary: boolean;
    }>;
  }> {
    const { data: task, error: taskError } = await client
      .from("scheduled_tasks")
      .select("id, title, actual_duration, estimated_duration, progress_percentage")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.RESOURCE_TASK_NOT_FOUND, {
        details: { originalError: taskError?.message },
      });
    }

    const { data: relations, error: relationsError } = await client
      .from("task_knowledge_points")
      .select(
        `relevance_score,
         is_primary,
         knowledge_point:knowledge_points (
           id,
           title,
           mastery_level,
           total_study_duration,
           last_study_at
         )`
      )
      .eq("task_id", taskId);

    if (relationsError) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: relationsError.message },
      });
    }

    const knowledgePoints = (relations ?? []).map((r: Record<string, unknown>) => {
      const kp = r.knowledge_point as Record<string, unknown>;
      return {
        id: kp.id as string,
        title: kp.title as string,
        masteryLevel: (kp.mastery_level as number) ?? 0,
        totalStudyDuration: (kp.total_study_duration as number) ?? 0,
        lastStudyAt: kp.last_study_at as string | null,
        relevanceScore: r.relevance_score as number,
        isPrimary: r.is_primary as boolean,
      };
    });

    return {
      task: {
        id: task.id,
        title: task.title,
        actualDuration: task.actual_duration ?? 0,
        estimatedDuration: task.estimated_duration,
        progressPercentage: task.progress_percentage ?? 0,
      },
      knowledgePoints,
    };
  }

  async batchSyncStudyDuration(
    client: SupabaseClient,
    paramsList: SyncStudyDurationParams[]
  ): Promise<ProgressSyncResult[]> {
    const results: ProgressSyncResult[] = [];

    for (const params of paramsList) {
      try {
        const result = await this.syncStudyDuration(client, params);
        results.push(result);
      } catch (error) {
        logger.error('Failed to sync study duration in batch', {
          taskId: params.taskId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}

export const progressSyncService = new ProgressSyncService();
