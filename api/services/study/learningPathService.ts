import { SupabaseClient } from "@supabase/supabase-js";
import { LearningPathTaskIntegration } from "./learningPathTaskIntegration";
import { LearningPathDailyPlan } from "./learningPathDailyPlan";
import { LearningPathNodeService } from "./learningPathNodeService";
import { LearningPathProgressService } from "./learningPathProgressService";
import { LearningPathPlanService } from "./learningPathPlanService";
import { LearningPathCrudService } from "./learningPathCrudService";
import { LearningPathAnalysisService } from "./learningPathAnalysisService";
import { LearningPathGenerationService } from "./learningPathGenerationService";
import type {
  LearningPath,
  LearningPathNode,
  LearningPathProgress,
  LearningPathProgressSummary,
  LearningPlan,
  CreateLearningPathInput,
  CreateLearningPathNodeInput,
  UpdateLearningPathInput,
  UpdateNodeStatusInput,
  LearningPathWithNodeCount,
  LearningPathResult,
} from "./learningPathTypes";

// 类型 re-export：保持既有子服务与调用方从本文件导入类型
export type {
  LearningPath,
  LearningPathNode,
  LearningPathProgress,
  LearningPathProgressSummary,
  LearningPlan,
  CreateLearningPathInput,
  CreateLearningPathNodeInput,
  UpdateLearningPathInput,
  UpdateNodeStatusInput,
  LearningPathWithNodeCount,
  LearningPathResult,
} from "./learningPathTypes";

export class LearningPathService {
  private crudService: LearningPathCrudService;
  private analysisService: LearningPathAnalysisService;
  private generationService: LearningPathGenerationService;
  private nodeService: LearningPathNodeService;
  private progressService: LearningPathProgressService;
  private planService: LearningPathPlanService;
  private taskIntegration: LearningPathTaskIntegration;

  constructor() {
    this.progressService = new LearningPathProgressService();
    this.nodeService = new LearningPathNodeService(this.progressService);
    this.crudService = new LearningPathCrudService(this.progressService);
    this.analysisService = new LearningPathAnalysisService(this.crudService);
    this.generationService = new LearningPathGenerationService(this.crudService);

    // Create dailyPlan and planService after 'this' is fully initialized
    const dailyPlan = new LearningPathDailyPlan(this);
    this.planService = new LearningPathPlanService(dailyPlan);
    this.taskIntegration = new LearningPathTaskIntegration(this);
  }

  // ── Delegated to CrudService ───────────────────────────────

  createLearningPath(
    supabase: SupabaseClient,
    userId: string,
    input: CreateLearningPathInput,
  ): Promise<LearningPath> {
    return this.crudService.createLearningPath(supabase, userId, input);
  }

  getLearningPaths(
    supabase: SupabaseClient,
    userId: string,
    status?: string,
  ): Promise<LearningPathWithNodeCount[]> {
    return this.crudService.getLearningPaths(supabase, userId, status);
  }

  getLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPath | null> {
    return this.crudService.getLearningPath(supabase, pathId, userId);
  }

  updateLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: UpdateLearningPathInput,
  ): Promise<LearningPath> {
    return this.crudService.updateLearningPath(supabase, pathId, userId, input);
  }

  deleteLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    hardDelete: boolean = false,
  ): Promise<void> {
    return this.crudService.deleteLearningPath(supabase, pathId, userId, hardDelete);
  }

  // ── Delegated to NodeService ───────────────────────────────

  async addNodeToPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: CreateLearningPathNodeInput,
  ): Promise<LearningPathNode> {
    return this.nodeService.addNodeToPath(supabase, pathId, userId, input);
  }

  async updateNodeStatus(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
    input: UpdateNodeStatusInput,
  ): Promise<LearningPathNode> {
    return this.nodeService.updateNodeStatus(supabase, pathId, nodeId, userId, input);
  }

  async reorderNodes(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    nodeOrders: { id: string; order_index: number }[],
  ): Promise<void> {
    return this.nodeService.reorderNodes(supabase, pathId, userId, nodeOrders);
  }

  async removeNodeFromPath(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
  ): Promise<void> {
    return this.nodeService.removeNodeFromPath(supabase, pathId, nodeId, userId);
  }

  // ── Delegated to ProgressService ───────────────────────────

  async updateProgress(
    supabase: SupabaseClient,
    pathId: string,
    nodeId: string,
    userId: string,
    input: {
      progress_percentage?: number;
      time_spent?: number;
      notes?: string;
    },
  ): Promise<LearningPathProgress> {
    return this.progressService.updateProgress(supabase, pathId, nodeId, userId, input);
  }

  async getPathProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPathProgressSummary> {
    return this.progressService.getPathProgress(supabase, pathId, userId);
  }

  // ── Delegated to PlanService ───────────────────────────────

  async createDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: {
      plan_date: string;
      planned_nodes: string[];
      planned_duration?: number;
      notes?: string;
    },
  ): Promise<LearningPlan> {
    return this.planService.createDailyPlan(supabase, pathId, userId, input);
  }

  async getDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    planDate: string,
  ): Promise<LearningPlan | null> {
    return this.planService.getDailyPlan(supabase, pathId, userId, planDate);
  }

  async getDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<LearningPlan[]> {
    return this.planService.getDailyPlans(supabase, pathId, userId, startDate, endDate);
  }

  async updatePlanStatus(
    supabase: SupabaseClient,
    planId: string,
    userId: string,
    input: {
      status?: string;
      time_spent?: number;
      notes?: string;
      progress_percentage?: number;
    },
  ): Promise<LearningPlan> {
    return this.planService.updatePlanStatus(supabase, planId, userId, input);
  }

  async generateDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      start_date?: string;
      respect_prerequisites?: boolean;
    },
  ): Promise<LearningPlan[]> {
    return this.planService.generateDailyPlans(supabase, pathId, userId, options);
  }

  // ── Delegated to AnalysisService ───────────────────────────

  async setLearningGoal(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: {
      goal: string;
      target_date: string;
      daily_minutes_target?: number;
    },
  ): Promise<LearningPath> {
    return this.analysisService.setLearningGoal(supabase, pathId, userId, input);
  }

  async estimateLearningTime(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<
    {
      node_id: string;
      title: string;
      base_time: number;
      difficulty_multiplier: number;
      user_speed_multiplier: number;
      estimated_time: number;
      confidence: "low" | "medium" | "high";
    }[]
  > {
    return this.analysisService.estimateLearningTime(supabase, pathId, userId);
  }

  async getLearningRecommendations(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<
    {
      type: "weak_point" | "review_needed" | "prerequisite_gap" | "milestone";
      priority: "high" | "medium" | "low";
      node_id?: string;
      title: string;
      description: string;
      action?: string;
    }[]
  > {
    return this.analysisService.getLearningRecommendations(supabase, pathId, userId);
  }

  // ── Delegated to TaskIntegration ───────────────────────────

  async createLearningPathMainTask(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      scheduled_start?: string;
      scheduled_end?: string;
    },
  ): Promise<string> {
    return this.taskIntegration.createLearningPathMainTask(supabase, pathId, userId, options);
  }

  async convertNodeToSubtask(
    supabase: SupabaseClient,
    parentTaskId: string,
    nodeId: string,
    userId: string,
    position: number,
  ): Promise<string> {
    return this.taskIntegration.convertNodeToSubtask(supabase, parentTaskId, nodeId, userId, position);
  }

  async convertNodeToTask(
    supabase: SupabaseClient,
    nodeId: string,
    userId: string,
    options?: {
      queue_level?: number;
      scheduled_start?: string;
      scheduled_end?: string;
    },
  ): Promise<string> {
    return this.taskIntegration.convertNodeToTask(supabase, nodeId, userId, options);
  }

  async syncProgressWithTask(
    supabase: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<{
    node_updated: boolean;
    path_progress: LearningPathProgressSummary | null;
    path_completed: boolean;
  }> {
    return this.taskIntegration.syncProgressWithTask(supabase, taskId, userId);
  }

  // ── Delegated to GenerationService ─────────────────────────

  async getCrossGraphProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<Record<string, LearningPathProgressSummary>> {
    return this.generationService.getCrossGraphProgress(supabase, pathId, userId);
  }

  async getGraphMeta(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<{ title: string; description: string | null } | null> {
    return this.generationService.getGraphMeta(supabase, graphId);
  }

  async generateAndSavePath(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    options: {
      target_goal?: string;
      target_knowledge_point_id?: string;
      learning_style: string;
      daily_time_minutes: number;
      current_knowledge?: string;
      provider?: string;
      model?: string;
      save_path?: boolean;
      path_title?: string;
    },
  ): Promise<LearningPathResult> {
    return this.generationService.generateAndSavePath(supabase, userId, graphId, options);
  }
}

export const learningPathService = new LearningPathService();
