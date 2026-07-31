import { randomUUID } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../../utils/logger";
import { autoTaskGenerator } from "../autoTaskGenerator";
import type {
  FocusSessionEndedPayload,
  TaskCompletedPayload,
  StudyMode,
  StudyWorkflowStage,
  StudyWorkflowConfig,
} from "../../../../shared/types/scheduler";
import { getStudyModePreset } from "../../../../shared/constants/studyModePresets";
import { MASTERY_THRESHOLDS } from "../../../../shared/constants/masteryThresholds";
import { notDeleted } from '../../common/softDeleteHelper';

type LoopStage = "learn" | "test" | "review" | "iterate";

interface LearningLoop {
  id: string;
  userId: string;
  knowledgePointId?: string;
  graphId?: string;
  currentStage: LoopStage;
  currentWorkflowStage?: StudyWorkflowStage;
  studyMode?: StudyMode;
  masteryLevel: number;
  loopCount: number;
  lastStageChangeAt: string;
  config: {
    masteryThreshold?: number;
    testDelayMinutes?: number;
    maxLoops?: number;
  };
  taskId?: string;
}

class LearningLoopOrchestrator {
  private activeLoops = new Map<string, LearningLoop>();

  async startLoop(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId?: string,
    graphId?: string,
  ): Promise<LearningLoop> {
    const loop: LearningLoop = {
      id: randomUUID(),
      userId,
      knowledgePointId,
      graphId,
      currentStage: "learn",
      masteryLevel: 0,
      loopCount: 0,
      lastStageChangeAt: new Date().toISOString(),
      config: {
        masteryThreshold: 0.8,
        testDelayMinutes: 60,
        maxLoops: 10,
      },
    };

    await this.persistLoop(supabase, loop);

    if (loop.knowledgePointId) {
      try {
        const autoResult = await autoTaskGenerator.generateLearningTask(
          supabase,
          userId,
          loop.knowledgePointId,
          { graphId: loop.graphId },
        );
        if (autoResult.created) {
          loop.taskId = autoResult.taskId;
        } else {
          const task = await this.createStageTask(supabase, loop, "learn");
          loop.taskId = task?.id;
        }
      } catch (err) {
        logger.error("[LearningLoop] Auto task generation failed, falling back to stage task:", err);
        const task = await this.createStageTask(supabase, loop, "learn");
        loop.taskId = task?.id;
      }
    } else {
      const task = await this.createStageTask(supabase, loop, "learn");
      loop.taskId = task?.id;
    }

    this.activeLoops.set(`${userId}:${loop.id}`, loop);

    return loop;
  }

  async advanceLoop(
    supabase: SupabaseClient,
    loopId: string,
    userId: string,
  ): Promise<LearningLoop | null> {
    const key = `${userId}:${loopId}`;
    let loop: LearningLoop | null | undefined = this.activeLoops.get(key) ?? null;

    if (!loop) {
      loop = await this.loadLoop(supabase, loopId, userId);
      if (!loop) return null;
    }

    const nextStage = this.getNextStage(loop.currentStage);
    if (!nextStage) return loop;

    loop.currentStage = nextStage;
    loop.lastStageChangeAt = new Date().toISOString();

    if (nextStage === "iterate") {
      loop.loopCount++;
      if (loop.masteryLevel >= (loop.config.masteryThreshold ?? 0.8)) {
        loop.currentStage = "learn";
        loop.masteryLevel = 0;
      } else {
        loop.currentStage = "learn";
      }
    }

    const task = await this.createStageTask(supabase, loop, loop.currentStage);
    loop.taskId = task?.id;

    await this.persistLoop(supabase, loop);
    this.activeLoops.set(key, loop);

    return loop;
  }

  private getNextStage(current: LoopStage): LoopStage | null {
    const flow: LoopStage[] = ["learn", "test", "review", "iterate"];
    const idx = flow.indexOf(current);
    if (idx < 0) return flow[0];
    return flow[(idx + 1) % flow.length];
  }

  private async createStageTask(
    supabase: SupabaseClient,
    loop: LearningLoop,
    stage: LoopStage,
  ) {
    const knowledgePoint = loop.knowledgePointId ?? i18next.t("scheduler.learningLoop.defaults.knowledgePoint");
    const stageConfig: Record<LoopStage, { title: string; queueLevel: number; priority: number }> = {
      learn: { title: i18next.t("scheduler.learningLoop.titles.learn", { knowledgePoint }), queueLevel: 1, priority: 5 },
      test: { title: i18next.t("scheduler.learningLoop.titles.test", { knowledgePoint }), queueLevel: 1, priority: 5 },
      review: { title: i18next.t("scheduler.learningLoop.titles.review", { knowledgePoint }), queueLevel: 0, priority: 8 },
      iterate: { title: i18next.t("scheduler.learningLoop.titles.iterate", { knowledgePoint }), queueLevel: 1, priority: 3 },
    };

    const config = stageConfig[stage];

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", loop.userId)
      .eq("queue_level", config.queueLevel)
      );

    const { data: task, error } = await supabase
      .from("user_tasks")
      .insert({
        user_id: loop.userId,
        title: config.title,
        queue_level: config.queueLevel,
        position: count ?? 0,
        priority: config.priority,
        status: "pending",
        task_type: "learning",
        knowledge_point_id: loop.knowledgePointId,
        context: JSON.stringify({ loopId: loop.id, stage }),
      })
      .select()
      .single();

    if (error) {
      logger.error("[LearningLoop] Failed to create stage task:", error);
      return null;
    }

    return task;
  }

  async handleFocusSessionEnded(
    supabase: SupabaseClient,
    userId: string,
    payload: FocusSessionEndedPayload,
  ) {
    if (!payload.taskId) return;

    const { data: task } = await supabase
      .from("user_tasks")
      .select("context")
      .eq("id", payload.taskId)
      .eq("user_id", userId)
      .single();

    if (!task?.context) return;

    let context: Record<string, unknown>;
    try {
      context = JSON.parse(task.context);
    } catch {
      return;
    }

    if (!context.loopId) return;

    const loop = await this.loadLoop(supabase, context.loopId as string, userId);
    if (!loop) return;

    if (payload.isBreak) return;

    if (loop.masteryLevel >= (loop.config.masteryThreshold ?? 0.8)) {
      logger.info(`[LearningLoop] Loop ${loop.id}: mastery reached, suggesting test stage`);
    }
  }

  async handleTaskCompleted(
    supabase: SupabaseClient,
    userId: string,
    payload: TaskCompletedPayload,
  ) {
    if (!payload.knowledgePointId) return;

    const { data: task } = await supabase
      .from("user_tasks")
      .select("context")
      .eq("id", payload.taskId)
      .eq("user_id", userId)
      .single();

    if (!task?.context) return;

    let context: Record<string, unknown>;
    try {
      context = JSON.parse(task.context);
    } catch {
      return;
    }

    if (!context.loopId) return;

    await this.advanceLoop(supabase, context.loopId as string, userId);
  }

  private async persistLoop(supabase: SupabaseClient, loop: LearningLoop) {
    const { error } = await supabase.from("learning_loops").upsert({
      id: loop.id,
      user_id: loop.userId,
      knowledge_point_id: loop.knowledgePointId,
      graph_id: loop.graphId,
      current_stage: loop.currentStage,
      mastery_level: loop.masteryLevel,
      loop_count: loop.loopCount,
      last_stage_change_at: loop.lastStageChangeAt,
      config: loop.config,
    });

    if (error) {
      logger.error("[LearningLoop] Failed to persist loop:", error);
    }
  }

  private async loadLoop(
    supabase: SupabaseClient,
    loopId: string,
    userId: string,
  ): Promise<LearningLoop | null> {
    const { data, error } = await supabase
      .from("learning_loops")
      .select("*")
      .eq("id", loopId)
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      knowledgePointId: data.knowledge_point_id ?? undefined,
      graphId: data.graph_id ?? undefined,
      currentStage: data.current_stage,
      masteryLevel: data.mastery_level,
      loopCount: data.loop_count,
      lastStageChangeAt: data.last_stage_change_at,
      config: data.config ?? {},
      taskId: undefined,
    };
  }

  async getActiveLoop(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId?: string,
  ): Promise<LearningLoop | null> {
    let query = supabase
      .from("learning_loops")
      .select("*")
      .eq("user_id", userId)
      .neq("current_stage", "iterate")
      .order("last_stage_change_at", { ascending: false })
      .limit(1);

    if (knowledgePointId) {
      query = query.eq("knowledge_point_id", knowledgePointId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      knowledgePointId: data.knowledge_point_id ?? undefined,
      graphId: data.graph_id ?? undefined,
      currentStage: data.current_stage,
      masteryLevel: data.mastery_level,
      loopCount: data.loop_count,
      lastStageChangeAt: data.last_stage_change_at,
      config: data.config ?? {},
      taskId: undefined,
    };
  }

  async startLearningWithTask(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    graphId?: string,
  ): Promise<LearningLoop | null> {
    const existingLoop = await this.getActiveLoop(supabase, userId, knowledgePointId);
    if (existingLoop) return existingLoop;

    return this.startLoop(supabase, userId, knowledgePointId, graphId);
  }

  createWorkflowForMode(studyMode: StudyMode): { stages: StudyWorkflowStage[]; config: StudyWorkflowConfig } {
    const preset = getStudyModePreset(studyMode);
    return {
      stages: preset.workflow.stages,
      config: preset.workflow,
    };
  }

  getNextWorkflowStage(
    currentStage: StudyWorkflowStage,
    masteryLevel: number,
    accuracy: number,
    workflowConfig: StudyWorkflowConfig,
  ): StudyWorkflowStage {
    const transitions = workflowConfig.transitions.filter(
      (t) => t.from === currentStage,
    );

    for (const transition of transitions) {
      switch (transition.condition) {
        case "always":
          return transition.to;
        case "mastery_above":
          if (masteryLevel >= (transition.threshold ?? 0.7)) return transition.to;
          break;
        case "accuracy_above":
          if (accuracy >= (transition.threshold ?? 0.8)) return transition.to;
          break;
        case "completed":
          return transition.to;
      }
    }

    return currentStage;
  }

  async createLoopWithMode(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    graphId: string,
    studyMode: StudyMode,
  ): Promise<LearningLoop> {
    const preset = getStudyModePreset(studyMode);
    const initialStage = preset.workflow.stages[0] ?? "learn";

    const loop: LearningLoop = {
      id: randomUUID(),
      userId,
      knowledgePointId,
      graphId,
      currentStage: this.mapWorkflowStageToLegacy(initialStage),
      currentWorkflowStage: initialStage,
      studyMode,
      masteryLevel: 0,
      loopCount: 0,
      lastStageChangeAt: new Date().toISOString(),
      config: {
        masteryThreshold: MASTERY_THRESHOLDS.PRACTICE_QUIZ,
        testDelayMinutes: 60,
        maxLoops: 10,
      },
    };

    const { error } = await supabase.from("learning_loops").insert({
      id: loop.id,
      user_id: loop.userId,
      knowledge_point_id: loop.knowledgePointId,
      graph_id: loop.graphId,
      current_stage: loop.currentStage,
      study_mode: loop.studyMode,
      current_workflow_stage: loop.currentWorkflowStage,
      mastery_level: loop.masteryLevel,
      loop_count: loop.loopCount,
      config: loop.config,
    });

    if (error) {
      logger.error("Failed to create learning loop with mode", { error: error.message });
    }

    return loop;
  }

  private mapWorkflowStageToLegacy(stage: StudyWorkflowStage): LoopStage {
    const mapping: Record<StudyWorkflowStage, LoopStage> = {
      learn: "learn",
      recall: "learn",
      practice: "test",
      quiz: "test",
      review: "review",
      reflect: "iterate",
    };
    return mapping[stage];
  }

  async resumeLoop(
    supabase: SupabaseClient,
    loopId: string,
  ): Promise<LearningLoop | null> {
    const { data, error } = await supabase
      .from("learning_loops")
      .select("*")
      .eq("id", loopId)
      .single();

    if (error || !data) {
      logger.error("Failed to resume learning loop", { loopId, error: error?.message });
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      knowledgePointId: data.knowledge_point_id ?? undefined,
      graphId: data.graph_id ?? undefined,
      currentStage: data.current_stage,
      currentWorkflowStage: data.current_workflow_stage,
      studyMode: data.study_mode,
      masteryLevel: data.mastery_level ?? 0,
      loopCount: data.loop_count ?? 0,
      lastStageChangeAt: data.last_stage_change_at ?? new Date().toISOString(),
      config: data.config ?? {},
      taskId: data.task_id,
    };
  }

  async advanceWorkflowStage(
    supabase: SupabaseClient,
    loopId: string,
    masteryLevel: number,
    accuracy: number,
  ): Promise<{ loop: LearningLoop; advanced: boolean }> {
    const loop = await this.resumeLoop(supabase, loopId);
    if (!loop || !loop.studyMode || !loop.currentWorkflowStage) {
      return { loop: loop ?? {} as LearningLoop, advanced: false };
    }

    const preset = getStudyModePreset(loop.studyMode);
    const nextStage = this.getNextWorkflowStage(
      loop.currentWorkflowStage,
      masteryLevel,
      accuracy,
      preset.workflow,
    );

    if (nextStage === loop.currentWorkflowStage) {
      return { loop, advanced: false };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("learning_loops")
      .update({
        current_workflow_stage: nextStage,
        current_stage: this.mapWorkflowStageToLegacy(nextStage),
        mastery_level: masteryLevel,
        last_stage_change_at: now,
        updated_at: now,
      })
      .eq("id", loopId);

    if (error) {
      logger.error("Failed to advance workflow stage", { loopId, error: error.message });
      return { loop, advanced: false };
    }

    return {
      loop: {
        ...loop,
        currentWorkflowStage: nextStage,
        currentStage: this.mapWorkflowStageToLegacy(nextStage),
        masteryLevel,
        lastStageChangeAt: now,
      },
      advanced: true,
    };
  }
}

export const learningLoopOrchestrator = new LearningLoopOrchestrator();
export { LearningLoopOrchestrator };
export type { LearningLoop, LoopStage };
