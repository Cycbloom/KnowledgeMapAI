import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_REVIEW_THRESHOLD = 0.5;

export interface DecayResult {
  knowledge_point_id: string;
  subtask_id: string;
  old_mastery: number;
  new_mastery: number;
  days_since_study: number;
  needs_review: boolean;
}

export interface KnowledgePointForReview {
  knowledge_point_id: string;
  subtask_id: string;
  current_mastery: number;
  last_study_at: Date;
  ease_factor: number;
}

export interface DecayCalculationInput {
  masteryLevel: number;
  lastStudyAt: Date;
  easeFactor: number;
}

export interface DecayConfig {
  reviewThreshold: number;
  minMastery: number;
  decayBaseFactor: number;
}

interface SubtaskData {
  id: string;
  knowledge_point_id: string;
  mastery_level: number;
  last_state_change_at: string;
  task_id: string;
}

interface ReviewTaskData {
  knowledge_point_id: string;
  ease_factor: number;
}

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  reviewThreshold: DEFAULT_REVIEW_THRESHOLD,
  minMastery: 0,
  decayBaseFactor: 10,
};

function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / oneDay);
}

export class MasteryDecayService {
  private config: DecayConfig;

  constructor(config?: Partial<DecayConfig>) {
    this.config = { ...DEFAULT_DECAY_CONFIG, ...config };
  }

  calculateDecay(
    masteryLevel: number,
    lastStudyAt: Date,
    easeFactor: number,
  ): number {
    const validatedMastery = Math.max(0, Math.min(1, masteryLevel));
    const validatedEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor);

    const daysSinceLastStudy = daysBetween(lastStudyAt, new Date());

    if (daysSinceLastStudy <= 0) {
      return validatedMastery;
    }

    const retentionRate = Math.pow(
      Math.E,
      -daysSinceLastStudy / (validatedEaseFactor * this.config.decayBaseFactor),
    );

    const newMastery = validatedMastery * retentionRate;

    return Math.max(this.config.minMastery, Math.round(newMastery * 100) / 100);
  }

  async batchDecayCalculation(
    supabase: SupabaseClient,
    userId?: string,
  ): Promise<DecayResult[]> {
    logger.info("Starting batch decay calculation", { userId });

    try {
      let query = supabase.from("task_subtasks").select(`
          id,
          knowledge_point_id,
          mastery_level,
          last_state_change_at,
          task_id,
          tasks!inner(user_id)
        `);

      if (userId) {
        query = query.eq("tasks.user_id", userId);
      }

      const { data: subtasks, error } = await query;

      if (error) {
        logger.error("Failed to fetch subtasks for decay calculation", {
          error: error.message,
        });
        throw new Error(`Failed to fetch subtasks: ${error.message}`);
      }

      if (!subtasks || subtasks.length === 0) {
        logger.info("No subtasks found for decay calculation");
        return [];
      }

      const { data: reviewTasks } = await supabase
        .from("review_tasks")
        .select("knowledge_point_id, ease_factor");

      const easeFactorMap = new Map<string, number>();
      if (reviewTasks) {
        for (const rt of reviewTasks as ReviewTaskData[]) {
          easeFactorMap.set(rt.knowledge_point_id, rt.ease_factor);
        }
      }

      const results: DecayResult[] = [];

      for (const subtask of subtasks as SubtaskData[]) {
        const easeFactor =
          easeFactorMap.get(subtask.knowledge_point_id) || DEFAULT_EASE_FACTOR;
        const lastStudyAt = new Date(subtask.last_state_change_at);
        const oldMastery = subtask.mastery_level;
        const newMastery = this.calculateDecay(
          oldMastery,
          lastStudyAt,
          easeFactor,
        );
        const daysSinceStudy = daysBetween(lastStudyAt, new Date());
        const needsReview = this.needsReview(
          newMastery,
          this.config.reviewThreshold,
        );

        if (Math.abs(newMastery - oldMastery) > 0.01 || needsReview) {
          results.push({
            knowledge_point_id: subtask.knowledge_point_id,
            subtask_id: subtask.id,
            old_mastery: oldMastery,
            new_mastery: newMastery,
            days_since_study: daysSinceStudy,
            needs_review: needsReview,
          });
        }
      }

      logger.info("Batch decay calculation completed", {
        totalProcessed: subtasks.length,
        resultsCount: results.length,
        needingReview: results.filter((r) => r.needs_review).length,
      });

      return results;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error during batch decay calculation", {
        error: errorMessage,
      });
      throw error;
    }
  }

  needsReview(currentMastery: number, threshold?: number): boolean {
    const reviewThreshold = threshold ?? this.config.reviewThreshold;
    return currentMastery < reviewThreshold;
  }

  async getPointsNeedingReview(
    supabase: SupabaseClient,
    userId: string,
    threshold?: number,
  ): Promise<KnowledgePointForReview[]> {
    const reviewThreshold = threshold ?? this.config.reviewThreshold;

    logger.info("Fetching points needing review", {
      userId,
      threshold: reviewThreshold,
    });

    try {
      const { data: subtasks, error } = await supabase
        .from("task_subtasks")
        .select(
          `
          id,
          knowledge_point_id,
          mastery_level,
          last_state_change_at,
          task_id
        `,
        )
        .eq("tasks.user_id", userId);

      if (error) {
        logger.error("Failed to fetch subtasks for review check", {
          error: error.message,
        });
        throw new Error(`Failed to fetch subtasks: ${error.message}`);
      }

      if (!subtasks || subtasks.length === 0) {
        return [];
      }

      const { data: reviewTasks } = await supabase
        .from("review_tasks")
        .select("knowledge_point_id, ease_factor");

      const easeFactorMap = new Map<string, number>();
      if (reviewTasks) {
        for (const rt of reviewTasks as ReviewTaskData[]) {
          easeFactorMap.set(rt.knowledge_point_id, rt.ease_factor);
        }
      }

      const pointsNeedingReview: KnowledgePointForReview[] = [];

      for (const subtask of subtasks as SubtaskData[]) {
        const easeFactor =
          easeFactorMap.get(subtask.knowledge_point_id) || DEFAULT_EASE_FACTOR;
        const lastStudyAt = new Date(subtask.last_state_change_at);
        const currentMastery = this.calculateDecay(
          subtask.mastery_level,
          lastStudyAt,
          easeFactor,
        );

        if (this.needsReview(currentMastery, reviewThreshold)) {
          pointsNeedingReview.push({
            knowledge_point_id: subtask.knowledge_point_id,
            subtask_id: subtask.id,
            current_mastery: currentMastery,
            last_study_at: lastStudyAt,
            ease_factor: easeFactor,
          });
        }
      }

      logger.info("Found points needing review", {
        userId,
        count: pointsNeedingReview.length,
      });

      return pointsNeedingReview;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error fetching points needing review", {
        error: errorMessage,
      });
      throw error;
    }
  }

  async applyDecay(
    supabase: SupabaseClient,
    knowledgePointId: string,
    newMasteryLevel: number,
  ): Promise<void> {
    logger.info("Applying decay to knowledge point", {
      knowledgePointId,
      newMasteryLevel,
    });

    try {
      const { error } = await supabase
        .from("task_subtasks")
        .update({
          mastery_level: newMasteryLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("knowledge_point_id", knowledgePointId);

      if (error) {
        logger.error("Failed to apply decay", {
          knowledgePointId,
          error: error.message,
        });
        throw new Error(`Failed to apply decay: ${error.message}`);
      }

      logger.info("Decay applied successfully", {
        knowledgePointId,
        newMasteryLevel,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error applying decay", { error: errorMessage });
      throw error;
    }
  }

  async applyBatchDecay(
    supabase: SupabaseClient,
    decayResults: DecayResult[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    logger.info("Starting batch decay application", {
      count: decayResults.length,
    });

    for (const result of decayResults) {
      try {
        await this.applyDecay(
          supabase,
          result.knowledge_point_id,
          result.new_mastery,
        );
        success++;
      } catch {
        failed++;
        logger.warn("Failed to apply decay for knowledge point", {
          knowledgePointId: result.knowledge_point_id,
        });
      }
    }

    logger.info("Batch decay application completed", { success, failed });

    return { success, failed };
  }

  calculateRetentionRate(daysSinceStudy: number, easeFactor: number): number {
    return Math.pow(
      Math.E,
      -daysSinceStudy / (easeFactor * this.config.decayBaseFactor),
    );
  }

  estimateDaysUntilThreshold(
    currentMastery: number,
    easeFactor: number,
    threshold?: number,
  ): number {
    const reviewThreshold = threshold ?? this.config.reviewThreshold;

    if (currentMastery <= reviewThreshold) {
      return 0;
    }

    const decayConstant = easeFactor * this.config.decayBaseFactor;
    const daysUntilThreshold =
      -decayConstant * Math.log(reviewThreshold / currentMastery);

    return Math.max(0, Math.round(daysUntilThreshold));
  }

  getDecayConfig(): DecayConfig {
    return { ...this.config };
  }

  setDecayConfig(config: Partial<DecayConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("Decay config updated", { config: this.config });
  }
}

export const masteryDecayService = new MasteryDecayService();
