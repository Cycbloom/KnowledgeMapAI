import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { LearningState } from "../../../shared/types/scheduler";
import { schedulerEventBus } from "./core/eventBus";

export interface SyncResult {
  success: boolean;
  subtask_id: string;
  knowledge_point_id: string;
  old_mastery?: number;
  new_mastery?: number;
  error?: string;
}

export interface SyncUpdate {
  subtask_id: string;
  knowledge_point_id: string;
  mastery_level: number;
  learning_state: LearningState;
}

export interface KnowledgePointInfo {
  id: string;
  title: string;
  mastery_level: number;
  last_study_at: Date | null;
  total_study_duration: number;
}

export interface SubtaskWithKnowledgePoint {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  learning_state: LearningState;
  mastery_level: number;
  state_history: Array<{
    from_state: LearningState;
    to_state: LearningState;
    changed_at: string;
    mastery_level_before: number;
    mastery_level_after: number;
    reason?: string;
  }>;
}

const MASTERY_MAX = 1.0;
const MASTERY_MIN = 0.0;
const REVIEW_THRESHOLD = 0.6;
const MASTERY_STATE_MAPPING: Record<
  LearningState,
  { min: number; max: number }
> = {
  learning: { min: 0.0, max: 0.3 },
  review: { min: 0.3, max: 0.6 },
  practice: { min: 0.6, max: 0.8 },
  quiz: { min: 0.8, max: 1.0 },
};

export class SubtaskKnowledgeSyncService {
  async syncSubtaskStateToKnowledgePoint(
    supabase: SupabaseClient,
    subtaskId: string,
    newState: LearningState,
    newMasteryLevel: number,
  ): Promise<SyncResult> {
    logger.info("Syncing subtask state to knowledge point", {
      subtaskId,
      newState,
      newMasteryLevel,
    });

    const { data: subtask, error: subtaskError } = await supabase
      .from("task_subtasks")
      .select(
        "id, task_id, knowledge_point_id, learning_state, mastery_level, state_history",
      )
      .eq("id", subtaskId)
      .single();

    if (subtaskError || !subtask) {
      return {
        success: false,
        subtask_id: subtaskId,
        knowledge_point_id: "",
        error: `Subtask not found: ${subtaskError?.message}`,
      };
    }

    const subtaskData = subtask as SubtaskWithKnowledgePoint;
    const knowledgePointId = subtaskData.knowledge_point_id;

    if (!knowledgePointId) {
      return {
        success: false,
        subtask_id: subtaskId,
        knowledge_point_id: "",
        error: "Subtask has no associated knowledge point",
      };
    }

    const { data: knowledgePoint, error: kpError } = await supabase
      .from("knowledge_points")
      .select("id, mastery_level")
      .eq("id", knowledgePointId)
      .single();

    if (kpError || !knowledgePoint) {
      return {
        success: false,
        subtask_id: subtaskId,
        knowledge_point_id: knowledgePointId,
        error: `Knowledge point not found: ${kpError?.message}`,
      };
    }

    const oldMastery = knowledgePoint.mastery_level ?? 0;
    const adjustedMastery = this.calculateKnowledgePointMastery(
      newState,
      newMasteryLevel,
      oldMastery,
    );

    const now = new Date().toISOString();

    const { error: updateKpError } = await supabase
      .from("knowledge_points")
      .update({
        mastery_level: adjustedMastery,
        last_study_at: now,
        updated_at: now,
      })
      .eq("id", knowledgePointId);

    if (updateKpError) {
      return {
        success: false,
        subtask_id: subtaskId,
        knowledge_point_id: knowledgePointId,
        old_mastery: oldMastery,
        error: `Failed to update knowledge point: ${updateKpError.message}`,
      };
    }

    const { error: updateSubtaskError } = await supabase
      .from("task_subtasks")
      .update({
        learning_state: newState,
        mastery_level: newMasteryLevel,
        last_state_change_at: now,
        updated_at: now,
        state_history: this.updateStateHistory(
          subtaskData.state_history ?? [],
          subtaskData.learning_state,
          newState,
          subtaskData.mastery_level,
          newMasteryLevel,
        ),
      })
      .eq("id", subtaskId);

    if (updateSubtaskError) {
      logger.error("Failed to update subtask state history", {
        subtaskId,
        error: updateSubtaskError.message,
      });
    }

    await this.publishLearningProgressEvent(
      supabase,
      subtaskData.task_id,
      knowledgePointId,
      adjustedMastery,
    );

    logger.info("Successfully synced subtask state to knowledge point", {
      subtaskId,
      knowledgePointId,
      oldMastery,
      newMastery: adjustedMastery,
    });

    return {
      success: true,
      subtask_id: subtaskId,
      knowledge_point_id: knowledgePointId,
      old_mastery: oldMastery,
      new_mastery: adjustedMastery,
    };
  }

  async syncKnowledgePointToSubtask(
    supabase: SupabaseClient,
    knowledgePointId: string,
    newMasteryLevel: number,
  ): Promise<SyncResult> {
    logger.info("Syncing knowledge point to subtask", {
      knowledgePointId,
      newMasteryLevel,
    });

    const { data: subtasks, error: subtasksError } = await supabase
      .from("task_subtasks")
      .select(
        "id, task_id, knowledge_point_id, learning_state, mastery_level, state_history",
      )
      .eq("knowledge_point_id", knowledgePointId);

    if (subtasksError) {
      return {
        success: false,
        subtask_id: "",
        knowledge_point_id: knowledgePointId,
        error: `Failed to fetch subtasks: ${subtasksError.message}`,
      };
    }

    if (!subtasks || subtasks.length === 0) {
      return {
        success: false,
        subtask_id: "",
        knowledge_point_id: knowledgePointId,
        error: "No subtasks associated with this knowledge point",
      };
    }

    const primarySubtask = (subtasks as SubtaskWithKnowledgePoint[])[0];

    const subtaskId = primarySubtask.id;
    const oldMastery = primarySubtask.mastery_level;
    const newLearningState = this.determineLearningState(newMasteryLevel);
    const now = new Date().toISOString();

    const { error: updateSubtaskError } = await supabase
      .from("task_subtasks")
      .update({
        mastery_level: newMasteryLevel,
        learning_state: newLearningState,
        last_state_change_at: now,
        updated_at: now,
        state_history: this.updateStateHistory(
          primarySubtask.state_history ?? [],
          primarySubtask.learning_state,
          newLearningState,
          oldMastery,
          newMasteryLevel,
        ),
      })
      .eq("id", subtaskId);

    if (updateSubtaskError) {
      return {
        success: false,
        subtask_id: subtaskId,
        knowledge_point_id: knowledgePointId,
        old_mastery: oldMastery,
        error: `Failed to update subtask: ${updateSubtaskError.message}`,
      };
    }

    if (newMasteryLevel < REVIEW_THRESHOLD) {
      await this.triggerReviewReminder(supabase, subtaskId);
    }

    logger.info("Successfully synced knowledge point to subtask", {
      subtaskId,
      knowledgePointId,
      oldMastery,
      newMastery: newMasteryLevel,
      newLearningState,
    });

    return {
      success: true,
      subtask_id: subtaskId,
      knowledge_point_id: knowledgePointId,
      old_mastery: oldMastery,
      new_mastery: newMasteryLevel,
    };
  }

  async updateLastStudyTime(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<void> {
    logger.info("Updating last study time for knowledge point", {
      knowledgePointId,
    });

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("knowledge_points")
      .update({
        last_study_at: now,
        updated_at: now,
      })
      .eq("id", knowledgePointId);

    if (error) {
      logger.error("Failed to update last study time", {
        knowledgePointId,
        error: error.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    const { data: subtasks, error: subtasksError } = await supabase
      .from("task_subtasks")
      .select("id")
      .eq("knowledge_point_id", knowledgePointId);

    if (!subtasksError && subtasks && subtasks.length > 0) {
      const { error: updateSubtasksError } = await supabase
        .from("task_subtasks")
        .update({
          updated_at: now,
        })
        .eq("knowledge_point_id", knowledgePointId);

      if (updateSubtasksError) {
        logger.warn("Failed to update subtasks last study time", {
          knowledgePointId,
          error: updateSubtasksError.message,
        });
      }
    }

    logger.info("Successfully updated last study time", {
      knowledgePointId,
    });
  }

  async triggerReviewReminder(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<void> {
    logger.info("Triggering review reminder for subtask", {
      subtaskId,
    });

    const { data: subtask, error: subtaskError } = await supabase
      .from("task_subtasks")
      .select("id, task_id, knowledge_point_id, mastery_level")
      .eq("id", subtaskId)
      .single();

    if (subtaskError || !subtask) {
      logger.warn("Subtask not found for review reminder", {
        subtaskId,
        error: subtaskError?.message,
      });
      return;
    }

    const subtaskData = subtask as {
      id: string;
      task_id: string;
      knowledge_point_id: string;
      mastery_level: number;
    };

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("id, user_id, title")
      .eq("id", subtaskData.task_id)
      .single();

    if (taskError || !task) {
      logger.warn("Task not found for review reminder", {
        taskId: subtaskData.task_id,
        error: taskError?.message,
      });
      return;
    }

    const taskData = task as { id: string; user_id: string; title: string };

    await schedulerEventBus.publish(
      "notification_needed",
      {
        userId: taskData.user_id,
        type: "review_reminder",
        message: `知识点需要复习：掌握度已降至 ${Math.round((subtaskData.mastery_level ?? 0) * 100)}%`,
        data: {
          subtaskId: subtaskData.id,
          taskId: taskData.id,
          knowledgePointId: subtaskData.knowledge_point_id,
          masteryLevel: subtaskData.mastery_level,
        },
      },
      taskData.user_id,
      "subtaskKnowledgeSync",
    );

    logger.info("Review reminder triggered successfully", {
      subtaskId,
      userId: taskData.user_id,
    });
  }

  async batchSync(
    supabase: SupabaseClient,
    updates: SyncUpdate[],
  ): Promise<SyncResult[]> {
    logger.info("Starting batch sync", {
      updateCount: updates.length,
    });

    const results: SyncResult[] = [];

    for (const update of updates) {
      try {
        const result = await this.syncSubtaskStateToKnowledgePoint(
          supabase,
          update.subtask_id,
          update.learning_state,
          update.mastery_level,
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          subtask_id: update.subtask_id,
          knowledge_point_id: update.knowledge_point_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info("Batch sync completed", {
      total: updates.length,
      successful: successCount,
      failed: updates.length - successCount,
    });

    return results;
  }

  async getKnowledgePointInfo(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<KnowledgePointInfo> {
    const { data: knowledgePoint, error } = await supabase
      .from("knowledge_points")
      .select("id, title, mastery_level, last_study_at, total_study_duration")
      .eq("id", knowledgePointId)
      .single();

    if (error || !knowledgePoint) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        details: {
          resource: "knowledge_point",
          id: knowledgePointId,
          originalError: error?.message,
        },
      });
    }

    return {
      id: knowledgePoint.id,
      title: knowledgePoint.title,
      mastery_level: knowledgePoint.mastery_level ?? 0,
      last_study_at: knowledgePoint.last_study_at
        ? new Date(knowledgePoint.last_study_at)
        : null,
      total_study_duration: knowledgePoint.total_study_duration ?? 0,
    };
  }

  async getSubtasksByKnowledgePoint(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<SubtaskWithKnowledgePoint[]> {
    const { data: subtasks, error } = await supabase
      .from("task_subtasks")
      .select(
        "id, task_id, knowledge_point_id, learning_state, mastery_level, state_history",
      )
      .eq("knowledge_point_id", knowledgePointId);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    return (subtasks as SubtaskWithKnowledgePoint[]) ?? [];
  }

  async checkAndTriggerReviews(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<string[]> {
    logger.info("Checking for knowledge points needing review", {
      userId,
    });

    const { data: knowledgePoints, error } = await supabase
      .from("knowledge_points")
      .select("id, mastery_level")
      .lt("mastery_level", REVIEW_THRESHOLD);

    if (error) {
      logger.error("Failed to fetch knowledge points for review check", {
        error: error.message,
      });
      return [];
    }

    const triggeredSubtaskIds: string[] = [];

    for (const kp of knowledgePoints ?? []) {
      const { data: subtasks } = await supabase
        .from("task_subtasks")
        .select("id, task_id")
        .eq("knowledge_point_id", kp.id)
        .limit(1);

      if (subtasks && subtasks.length > 0) {
        await this.triggerReviewReminder(supabase, subtasks[0].id);
        triggeredSubtaskIds.push(subtasks[0].id);
      }
    }

    logger.info("Review check completed", {
      userId,
      triggeredCount: triggeredSubtaskIds.length,
    });

    return triggeredSubtaskIds;
  }

  private calculateKnowledgePointMastery(
    learningState: LearningState,
    subtaskMastery: number,
    currentKpMastery: number,
  ): number {
    const stateConfig = MASTERY_STATE_MAPPING[learningState];
    const stateMidpoint = (stateConfig.min + stateConfig.max) / 2;

    const weight = 0.3;
    const weightedMastery =
      currentKpMastery * (1 - weight) + stateMidpoint * weight;

    const adjustedMastery = weightedMastery + (subtaskMastery - 0.5) * 0.1;

    return Math.min(MASTERY_MAX, Math.max(MASTERY_MIN, adjustedMastery));
  }

  private determineLearningState(masteryLevel: number): LearningState {
    if (masteryLevel < 0.3) {
      return "learning";
    } else if (masteryLevel < 0.6) {
      return "review";
    } else if (masteryLevel < 0.8) {
      return "practice";
    } else {
      return "quiz";
    }
  }

  private updateStateHistory(
    history: Array<{
      from_state: LearningState;
      to_state: LearningState;
      changed_at: string;
      mastery_level_before: number;
      mastery_level_after: number;
      reason?: string;
    }>,
    fromState: LearningState,
    toState: LearningState,
    masteryBefore: number,
    masteryAfter: number,
  ): Array<{
    from_state: LearningState;
    to_state: LearningState;
    changed_at: string;
    mastery_level_before: number;
    mastery_level_after: number;
    reason?: string;
  }> {
    const newEntry = {
      from_state: fromState,
      to_state: toState,
      changed_at: new Date().toISOString(),
      mastery_level_before: masteryBefore,
      mastery_level_after: masteryAfter,
    };

    const updatedHistory = [...history, newEntry];

    if (updatedHistory.length > 50) {
      return updatedHistory.slice(-50);
    }

    return updatedHistory;
  }

  private async publishLearningProgressEvent(
    supabase: SupabaseClient,
    taskId: string,
    knowledgePointId: string,
    masteryLevel: number,
  ): Promise<void> {
    try {
      const { data: task } = await supabase
        .from("user_tasks")
        .select("user_id")
        .eq("id", taskId)
        .single();

      if (task?.user_id) {
        await schedulerEventBus.publish(
          "learning_progress_updated",
          {
            knowledgePointId,
            masteryLevel,
            studyDuration: 0,
            source: "task_completion" as const,
          },
          task.user_id,
          "subtaskKnowledgeSync",
        );
      }
    } catch (error) {
      logger.warn("Failed to publish learning progress event", {
        taskId,
        knowledgePointId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const subtaskKnowledgeSyncService = new SubtaskKnowledgeSyncService();
