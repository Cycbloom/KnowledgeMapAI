import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { DEFAULT_DECAY_CONFIG as SHARED_DECAY_CONFIG } from "../../../shared/constants/masteryThresholds";

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

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
  fsrsStability?: number;
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

const DEFAULT_DECAY_CONFIG: DecayConfig = { ...SHARED_DECAY_CONFIG };

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
    fsrsStability?: number,
  ): number {
    const daysSinceLastStudy = daysBetween(lastStudyAt, new Date());

    if (daysSinceLastStudy <= 0) {
      return Math.max(0, Math.min(1, masteryLevel));
    }

    // 使用 FSRS retrievability 作为衰减后的掌握度
    // retrievability = e^(-elapsed_days / stability)，表示当前能回忆起来的概率
    if (fsrsStability && fsrsStability > 0) {
      const retrievability = Math.pow(Math.E, -daysSinceLastStudy / fsrsStability);
      return Math.max(this.config.minMastery, Math.round(retrievability * 100) / 100);
    }

    // 无 FSRS 数据时，使用 easeFactor 估算
    const validatedEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor);
    const estimatedRetrievability = Math.pow(
      Math.E,
      -daysSinceLastStudy / (validatedEaseFactor * this.config.decayBaseFactor),
    );

    return Math.max(this.config.minMastery, Math.round(estimatedRetrievability * 100) / 100);
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

      const { data: studyCards } = await supabase
        .from("study_cards")
        .select("knowledge_point_id, fsrs_stability");

      const stabilityMap = new Map<string, number>();
      if (studyCards) {
        for (const card of studyCards as { knowledge_point_id: string; fsrs_stability: number | null }[]) {
          if (card.fsrs_stability) {
            stabilityMap.set(card.knowledge_point_id, card.fsrs_stability);
          }
        }
      }

      const results: DecayResult[] = [];

      for (const subtask of subtasks as SubtaskData[]) {
        const easeFactor =
          easeFactorMap.get(subtask.knowledge_point_id) || DEFAULT_EASE_FACTOR;
        const lastStudyAt = new Date(subtask.last_state_change_at);
        const oldMastery = subtask.mastery_level;
        const fsrsStability = stabilityMap.get(subtask.knowledge_point_id);
        const newMastery = this.calculateDecay(
          oldMastery,
          lastStudyAt,
          easeFactor,
          fsrsStability,
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

      const { data: studyCards } = await supabase
        .from("study_cards")
        .select("knowledge_point_id, fsrs_stability");

      const stabilityMap = new Map<string, number>();
      if (studyCards) {
        for (const card of studyCards as { knowledge_point_id: string; fsrs_stability: number | null }[]) {
          if (card.fsrs_stability) {
            stabilityMap.set(card.knowledge_point_id, card.fsrs_stability);
          }
        }
      }

      const pointsNeedingReview: KnowledgePointForReview[] = [];

      for (const subtask of subtasks as SubtaskData[]) {
        const easeFactor =
          easeFactorMap.get(subtask.knowledge_point_id) || DEFAULT_EASE_FACTOR;
        const lastStudyAt = new Date(subtask.last_state_change_at);
        const fsrsStability = stabilityMap.get(subtask.knowledge_point_id);
        const currentMastery = this.calculateDecay(
          subtask.mastery_level,
          lastStudyAt,
          easeFactor,
          fsrsStability,
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

  calculateRetentionRate(daysSinceStudy: number, easeFactor: number, fsrsStability?: number): number {
    if (fsrsStability && fsrsStability > 0) {
      return Math.pow(Math.E, -daysSinceStudy / fsrsStability);
    }
    return Math.pow(
      Math.E,
      -daysSinceStudy / (easeFactor * this.config.decayBaseFactor),
    );
  }

  estimateDaysUntilThreshold(
    currentMastery: number,
    easeFactor: number,
    threshold?: number,
    fsrsStability?: number,
  ): number {
    const reviewThreshold = threshold ?? this.config.reviewThreshold;

    if (currentMastery <= reviewThreshold) {
      return 0;
    }

    const decayConstant = (fsrsStability && fsrsStability > 0)
      ? fsrsStability
      : easeFactor * this.config.decayBaseFactor;

    // 当有 FSRS 数据时，mastery = retrievability = e^(-days/S)
    // 所以 threshold = e^(-days/S) => days = -S * ln(threshold)
    const daysUntilThreshold = -decayConstant * Math.log(reviewThreshold);

    return Math.max(0, Math.round(daysUntilThreshold));
  }

  async applyAdjacencyDecayCorrection(
    supabase: SupabaseClient,
    knowledgePointId: string,
    graphId: string,
    currentMastery: number,
  ): Promise<number> {
    const { data: edges } = await supabase
      .from("graph_edges")
      .select("source_id, target_id")
      .eq("graph_id", graphId)
      .or(`source_id.eq.${knowledgePointId},target_id.eq.${knowledgePointId}`);

    if (!edges || edges.length === 0) {
      return currentMastery;
    }

    const neighborIds = edges.map((e: { source_id: string; target_id: string }) =>
      e.source_id === knowledgePointId ? e.target_id : e.source_id,
    );

    const { data: neighbors } = await supabase
      .from("knowledge_points")
      .select("id, mastery_level")
      .in("id", neighborIds);

    if (!neighbors || neighbors.length === 0) {
      return currentMastery;
    }

    const avgNeighborMastery =
      neighbors.reduce((sum: number, n: { mastery_level: number | null }) => sum + (n.mastery_level ?? 0), 0) / neighbors.length;

    const correctionFactor = 1 + 0.2 * avgNeighborMastery;

    return Math.min(1, currentMastery * correctionFactor);
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
