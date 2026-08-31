import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { MASTERY_THRESHOLDS } from "../../../shared/constants/masteryThresholds";
import { executionService } from "./executionService";
import type {
  LearningState,
  StateHistoryEntry,
  TaskSubtask,
} from "../../../shared/types/scheduler";

interface TransitionResult {
  success: boolean;
  subtask?: TaskSubtask;
  error?: string;
}

interface StateTransitionConfig {
  to: LearningState;
  minMastery?: number;
  maxMastery?: number;
  descriptionKey: string;
}

const VALID_TRANSITIONS: Record<LearningState, StateTransitionConfig[]> = {
  learning: [
    {
      to: "review",
      maxMastery: MASTERY_THRESHOLDS.LEARNING_REVIEW,
      descriptionKey: "scheduler.subtaskState.descriptions.masteryLowToReview",
    },
    {
      to: "practice",
      minMastery: MASTERY_THRESHOLDS.LEARNING_REVIEW,
      maxMastery: MASTERY_THRESHOLDS.PRACTICE_QUIZ,
      descriptionKey: "scheduler.subtaskState.descriptions.masteryMidToPractice",
    },
    {
      to: "quiz",
      minMastery: MASTERY_THRESHOLDS.PRACTICE_QUIZ,
      descriptionKey: "scheduler.subtaskState.descriptions.masteryHighToQuiz",
    },
  ],
  review: [
    {
      to: "practice",
      descriptionKey: "scheduler.subtaskState.descriptions.reviewCompleteToPractice",
    },
  ],
  practice: [
    {
      to: "quiz",
      minMastery: MASTERY_THRESHOLDS.REVIEW_PRACTICE,
      descriptionKey: "scheduler.subtaskState.descriptions.practicePassToQuiz",
    },
    {
      to: "review",
      maxMastery: MASTERY_THRESHOLDS.REVIEW_PRACTICE,
      descriptionKey: "scheduler.subtaskState.descriptions.practiceFailToReview",
    },
  ],
  quiz: [
    {
      to: "review",
      maxMastery: MASTERY_THRESHOLDS.REVIEW_PRACTICE,
      descriptionKey: "scheduler.subtaskState.descriptions.quizFailToReview",
    },
    {
      to: "practice",
      minMastery: MASTERY_THRESHOLDS.REVIEW_PRACTICE,
      maxMastery: MASTERY_THRESHOLDS.QUIZ_MASTERY,
      descriptionKey: "scheduler.subtaskState.descriptions.quizPartialToPractice",
    },
    {
      to: "quiz",
      minMastery: MASTERY_THRESHOLDS.QUIZ_MASTERY,
      descriptionKey: "scheduler.subtaskState.descriptions.quizPassToQuizDeepen",
    },
  ],
};

const CYCLE_ORDER: LearningState[] = ["review", "practice", "quiz"];

class SubtaskStateMachine {
  getNextState(
    currentState: LearningState,
    masteryLevel: number,
  ): LearningState {
    if (currentState === "learning") {
      return this.getNextStateFromLearning(masteryLevel);
    }

    return this.getNextStateInCycle(currentState, masteryLevel);
  }

  private getNextStateFromLearning(masteryLevel: number): LearningState {
    if (masteryLevel < MASTERY_THRESHOLDS.LEARNING_REVIEW) {
      return "review";
    }
    if (masteryLevel < MASTERY_THRESHOLDS.PRACTICE_QUIZ) {
      return "practice";
    }
    return "quiz";
  }

  private getNextStateInCycle(
    currentState: LearningState,
    masteryLevel: number,
  ): LearningState {
    const currentIndex = CYCLE_ORDER.indexOf(currentState);

    if (currentState === "review") {
      return "practice";
    }

    if (currentState === "practice") {
      if (masteryLevel >= MASTERY_THRESHOLDS.PRACTICE_QUIZ) {
        return "quiz";
      }
      return "review";
    }

    if (currentState === "quiz") {
      if (masteryLevel >= MASTERY_THRESHOLDS.QUIZ_MASTERY) {
        return "quiz";
      }
      if (masteryLevel >= MASTERY_THRESHOLDS.REVIEW_PRACTICE) {
        return "practice";
      }
      return "review";
    }

    return CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
  }

  canTransition(from: LearningState, to: LearningState): boolean {
    if (from === to) {
      return true;
    }

    const transitions = VALID_TRANSITIONS[from];
    if (!transitions) {
      return false;
    }

    return transitions.some((t) => t.to === to);
  }

  getValidTransitions(from: LearningState): LearningState[] {
    const transitions = VALID_TRANSITIONS[from];
    if (!transitions) {
      return [];
    }

    const result = transitions.map((t) => t.to);

    if (!result.includes(from)) {
      result.push(from);
    }

    return result;
  }

  async transition(
    supabase: SupabaseClient,
    subtaskId: string,
    toState: LearningState,
    masteryLevel: number,
    reason?: string,
  ): Promise<TransitionResult> {
    const { data: subtask, error: fetchError } = await supabase
      .from("task_subtasks")
      .select("*, knowledge_points(mastery_level)")
      .eq("id", subtaskId)
      .single();

    if (fetchError || !subtask) {
      logger.error(
        "[SubtaskStateMachine] Failed to fetch subtask:",
        fetchError,
      );
      return {
        success: false,
        error: fetchError?.message ?? "Subtask not found",
      };
    }

    const fromState = subtask.learning_state as LearningState;
    const masteryBefore = this.readMasteryFromJoin(subtask);

    if (!this.canTransition(fromState, toState)) {
      const validTransitions = this.getValidTransitions(fromState);
      return {
        success: false,
        error: `Invalid transition: ${fromState} → ${toState}. Valid transitions: ${validTransitions.join(", ")}`,
      };
    }

    if (fromState === "learning" && toState === "learning") {
      return {
        success: false,
        error:
          "Cannot transition to learning state. Learning state can only occur once.",
      };
    }

    const stateHistory = this.recordStateHistory(
      subtask.state_history ?? [],
      fromState,
      toState,
      masteryBefore,
      masteryLevel,
      reason,
    );

    const now = new Date().toISOString();
    const updateData = {
      learning_state: toState,
      state_history: stateHistory,
      last_state_change_at: now,
      updated_at: now,
    };

    // mastery_level 单一来源：写入 knowledge_points（不再写入 task_subtasks）
    if (subtask.knowledge_point_id) {
      const { error: kpError } = await supabase
        .from("knowledge_points")
        .update({ mastery_level: masteryLevel, updated_at: now })
        .eq("id", subtask.knowledge_point_id);
      if (kpError) {
        logger.error(
          "[SubtaskStateMachine] Failed to update knowledge point mastery:",
          kpError,
        );
      }
    }

    const { data: updatedSubtask, error: updateError } = await supabase
      .from("task_subtasks")
      .update(updateData)
      .eq("id", subtaskId)
      .select("*, knowledge_points(mastery_level)")
      .single();

    if (updateError || !updatedSubtask) {
      logger.error(
        "[SubtaskStateMachine] Failed to update subtask:",
        updateError,
      );
      return {
        success: false,
        error: updateError?.message ?? "Failed to update subtask",
      };
    }

    logger.info(
      `[SubtaskStateMachine] Subtask ${subtaskId}: ${fromState} → ${toState} (mastery: ${(masteryBefore * 100).toFixed(0)}% → ${(masteryLevel * 100).toFixed(0)}%)`,
    );

    // 阶段推进回写：为真实迁移产生一条待计时执行记录（阶段开始不计时）
    if (fromState !== toState) {
      try {
        const owner = await this.resolveOwner(supabase, subtask.task_id);
        if (owner) {
          await executionService.createPendingForStage(supabase, owner, {
            taskId: subtask.task_id,
            subtaskId,
            knowledgePointId: subtask.knowledge_point_id,
            stage: toState,
          });
        }
      } catch (error) {
        logger.warn("[SubtaskStateMachine] failed to write pending stage execution", {
          subtaskId,
          toState,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: true,
      subtask: this.flattenSubtaskMastery(updatedSubtask) as TaskSubtask,
    };
  }

  /** 从任务解析拥有者 user_id（task_executions.user_id 来源） */
  private async resolveOwner(
    supabase: SupabaseClient,
    taskId: string,
  ): Promise<string | null> {
    const { data } = await supabase
      .from("user_tasks")
      .select("user_id")
      .eq("id", taskId)
      .single();
    return data?.user_id ?? null;
  }

  /**
   * 从 JOIN 查询结果中读取 mastery_level（单一来源：knowledge_points）
   */
  private readMasteryFromJoin(raw: unknown): number {
    const r = raw as { knowledge_points?: { mastery_level: number | null }[] | null };
    return r.knowledge_points?.[0]?.mastery_level ?? 0;
  }

  /**
   * 将 JOIN 查询结果扁平化，把 knowledge_points.mastery_level 提升到顶层
   */
  private flattenSubtaskMastery<T extends Record<string, unknown>>(
    raw: T | null,
  ): T & { mastery_level: number } {
    const r = (raw ?? {}) as T & {
      knowledge_points?: { mastery_level: number | null }[] | null;
    };
    const { knowledge_points, ...rest } = r;
    return {
      ...rest,
      mastery_level: knowledge_points?.[0]?.mastery_level ?? 0,
    } as T & { mastery_level: number };
  }

  recordStateHistory(
    history: StateHistoryEntry[],
    from: LearningState,
    to: LearningState,
    masteryBefore: number,
    masteryAfter: number,
    reason?: string,
  ): StateHistoryEntry[] {
    const newEntry: StateHistoryEntry = {
      from_state: from,
      to_state: to,
      changed_at: new Date().toISOString(),
      mastery_level_before: masteryBefore,
      mastery_level_after: masteryAfter,
      reason,
    };

    return [...history, newEntry];
  }

  getTransitionDescription(
    from: LearningState,
    to: LearningState,
  ): string | undefined {
    const transitions = VALID_TRANSITIONS[from];
    if (!transitions) {
      return undefined;
    }

    const transition = transitions.find((t) => t.to === to);
    return transition?.descriptionKey;
  }

  isLearningCompleted(stateHistory: StateHistoryEntry[]): boolean {
    return stateHistory.some((entry) => entry.from_state === "learning");
  }

  getStateCyclePosition(state: LearningState): number {
    if (state === "learning") {
      return -1;
    }
    return CYCLE_ORDER.indexOf(state);
  }

  getRecommendedNextState(
    currentState: LearningState,
    masteryLevel: number,
    stateHistory: StateHistoryEntry[],
  ): LearningState {
    if (
      currentState === "learning" &&
      !this.isLearningCompleted(stateHistory)
    ) {
      return this.getNextStateFromLearning(masteryLevel);
    }

    return this.getNextStateInCycle(currentState, masteryLevel);
  }

  calculateMasteryProgress(
    fromState: LearningState,
    toState: LearningState,
    masteryBefore: number,
    masteryAfter: number,
  ): {
    improved: boolean;
    improvementAmount: number;
    stateProgress: number;
  } {
    const improvementAmount = masteryAfter - masteryBefore;
    const improved = improvementAmount > 0;

    const fromPosition = this.getStateCyclePosition(fromState);
    const toPosition = this.getStateCyclePosition(toState);

    let stateProgress = 0;
    if (fromPosition >= 0 && toPosition >= 0) {
      if (toPosition > fromPosition) {
        stateProgress = toPosition - fromPosition;
      } else if (toPosition < fromPosition) {
        stateProgress = -(fromPosition - toPosition);
      }
    } else if (fromPosition < 0 && toPosition >= 0) {
      stateProgress = toPosition + 1;
    }

    return {
      improved,
      improvementAmount,
      stateProgress,
    };
  }

  validateTransition(
    from: LearningState,
    to: LearningState,
    masteryLevel: number,
  ): {
    valid: boolean;
    error?: string;
    warning?: string;
  } {
    if (from === "learning" && to === "learning") {
      return {
        valid: false,
        error: "Learning state can only occur once per subtask",
      };
    }

    if (!this.canTransition(from, to)) {
      const validTransitions = this.getValidTransitions(from);
      return {
        valid: false,
        error: `Invalid transition from ${from} to ${to}. Valid transitions: ${validTransitions.join(", ")}`,
      };
    }

    const expectedState = this.getNextState(from, masteryLevel);
    if (to !== expectedState && to !== from) {
      return {
        valid: true,
        warning: `Expected transition to ${expectedState} based on mastery level ${(masteryLevel * 100).toFixed(0)}%, but transitioning to ${to}`,
      };
    }

    return { valid: true };
  }
}

export const subtaskStateMachine = new SubtaskStateMachine();
export { SubtaskStateMachine };
export type { TransitionResult, StateTransitionConfig };
