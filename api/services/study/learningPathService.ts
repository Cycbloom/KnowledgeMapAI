import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { graphService } from "../graph/index";
import { transactionExecutor } from "../../database/transactionExecutor";
import { buildProgressMap, buildDependencyMaps, generateRulePath, generateAIPath, buildTodayPlan, calculateWeeklyProgress, type LearningPathStage } from "./learningPathAlgorithms";
import { LearningPathTaskIntegration } from "./learningPathTaskIntegration";
import { LearningPathDailyPlan } from "./learningPathDailyPlan";
import { LearningPathNodeService } from "./learningPathNodeService";
import { LearningPathProgressService } from "./learningPathProgressService";
import { LearningPathPlanService } from "./learningPathPlanService";

export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type: "single_graph" | "cross_graph";
  total_estimated_time: number;
  ai_generated: boolean;
  status: "active" | "completed" | "paused" | "archived";
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes?: LearningPathNode[];
  progress?: LearningPathProgressSummary;
}

export interface LearningPathNode {
  id: string;
  path_id: string;
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time: number;
  is_milestone: boolean;
  prerequisites: string[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningPathProgress {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  started_at?: string;
  completed_at?: string;
}

export interface LearningPathProgressSummary {
  total_nodes: number;
  completed_nodes: number;
  in_progress_nodes: number;
  pending_nodes: number;
  skipped_nodes: number;
  total_time_spent: number;
  progress_percentage: number;
}

export interface LearningPlan {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  planned_duration?: number;
  planned_nodes: string[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLearningPathInput {
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type?: "single_graph" | "cross_graph";
  total_estimated_time?: number;
  ai_generated?: boolean;
  daily_minutes_target?: number;
  nodes?: CreateLearningPathNodeInput[];
}

export interface CreateLearningPathNodeInput {
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time?: number;
  is_milestone?: boolean;
  prerequisites?: string[];
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  goal?: string;
  target_date?: string;
  status?: "active" | "completed" | "paused" | "archived";
  daily_minutes_target?: number;
}

export interface UpdateNodeStatusInput {
  status: "pending" | "in_progress" | "completed" | "skipped";
  notes?: string;
  time_spent?: number;
  progress_percentage?: number;
}

export interface LearningPathWithNodeCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  target_date: string | null;
  source_graph_id: string | null;
  domain_id: string | null;
  path_type: string;
  total_estimated_time: number;
  ai_generated: boolean;
  status: string;
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
  nodes_count: number;
  completed_nodes_count: number;
}

export interface LearningPathResult {
  id?: string;
  graphId: string;
  graphTitle: string;
  totalNodes: number;
  completedNodes: number;
  estimatedTotalTime: number;
  stages: LearningPathStage[];
  todayPlan: LearningPathStage[];
  predictions: {
    completionDate: string;
    weeklyProgress: number[];
    recommendedDailyTime: number;
  };
  suggestions: string[];
  aiGenerated: boolean;
  targetGoal?: string;
  savedPath?: LearningPath;
}

export class LearningPathService {
  private nodeService: LearningPathNodeService;
  private progressService: LearningPathProgressService;
  private planService: LearningPathPlanService;
  private taskIntegration: LearningPathTaskIntegration;

  constructor() {
    this.progressService = new LearningPathProgressService();
    this.nodeService = new LearningPathNodeService(this.progressService);

    // Create dailyPlan and planService after 'this' is fully initialized
    const dailyPlan = new LearningPathDailyPlan(this);
    this.planService = new LearningPathPlanService(dailyPlan);
    this.taskIntegration = new LearningPathTaskIntegration(this);
  }

  // ── Core CRUD ──────────────────────────────────────────────

  async createLearningPath(
    supabase: SupabaseClient,
    userId: string,
    input: CreateLearningPathInput,
  ): Promise<LearningPath> {
    // Transactional path
    if (transactionExecutor.isAvailable()) {
      try {
        const pathId = await transactionExecutor.executeInTransaction(async (client) => {
          const { rows } = await client.query(
            `INSERT INTO learning_paths (user_id, title, description, goal, target_date, source_graph_id, domain_id, path_type, total_estimated_time, ai_generated, daily_minutes_target, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
             RETURNING id`,
            [
              userId,
              input.title,
              input.description || null,
              input.goal || null,
              input.target_date || null,
              input.source_graph_id || null,
              input.domain_id || null,
              input.path_type || "single_graph",
              input.total_estimated_time || 0,
              input.ai_generated || false,
              input.daily_minutes_target || 30,
            ],
          );

          const newPathId = rows[0].id;

          if (input.nodes && input.nodes.length > 0) {
            const totalEstimatedTime = input.nodes.reduce(
              (sum, n) => sum + (n.estimated_time || 30),
              0,
            );

            for (const node of input.nodes) {
              await client.query(
                `INSERT INTO learning_path_nodes (path_id, knowledge_point_id, graph_id, order_index, title, description, estimated_time, is_milestone, prerequisites, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
                [
                  newPathId,
                  node.knowledge_point_id || null,
                  node.graph_id || null,
                  node.order_index,
                  node.title,
                  node.description || null,
                  node.estimated_time || 30,
                  node.is_milestone || false,
                  node.prerequisites || [],
                ],
              );
            }

            await client.query(
              `UPDATE learning_paths SET total_estimated_time = $1 WHERE id = $2`,
              [totalEstimatedTime, newPathId],
            );
          }

          return newPathId as string;
        });

        const result = await this.getLearningPath(supabase, pathId, userId);
        if (!result) throw new Error("Learning path not found after creation");
        return result;
      } catch (txError) {
        logger.warn('Transaction failed in createLearningPath, falling back to non-transactional operations', { error: txError });
      }
    } else {
      logger.warn('TransactionExecutor not available, using non-transactional path for createLearningPath');
    }

    // Non-transactional fallback
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .insert({
        user_id: userId,
        title: input.title,
        description: input.description || null,
        goal: input.goal || null,
        target_date: input.target_date || null,
        source_graph_id: input.source_graph_id || null,
        domain_id: input.domain_id || null,
        path_type: input.path_type || "single_graph",
        total_estimated_time: input.total_estimated_time || 0,
        ai_generated: input.ai_generated || false,
        daily_minutes_target: input.daily_minutes_target || 30,
        status: "active",
      })
      .select()
      .single();

    if (pathError) {
      logger.error("createLearningPath error:", pathError);
      throw pathError;
    }

    if (input.nodes && input.nodes.length > 0) {
      const nodesData = input.nodes.map((node) => ({
        path_id: path.id,
        knowledge_point_id: node.knowledge_point_id || null,
        graph_id: node.graph_id || null,
        order_index: node.order_index,
        title: node.title,
        description: node.description || null,
        estimated_time: node.estimated_time || 30,
        is_milestone: node.is_milestone || false,
        prerequisites: node.prerequisites || [],
        status: "pending" as const,
      }));

      const { error: nodesError } = await supabase
        .from("learning_path_nodes")
        .insert(nodesData);

      if (nodesError) {
        logger.error("createLearningPath nodes error:", nodesError);
        await supabase.from("learning_paths").delete().eq("id", path.id);
        throw nodesError;
      }

      const totalEstimatedTime = input.nodes.reduce(
        (sum, n) => sum + (n.estimated_time || 30),
        0,
      );
      await supabase
        .from("learning_paths")
        .update({ total_estimated_time: totalEstimatedTime })
        .eq("id", path.id);

      path.total_estimated_time = totalEstimatedTime;
    }

    const result = await this.getLearningPath(supabase, path.id, userId);
    if (!result) throw new Error("Learning path not found after creation");
    return result;
  }

  async getLearningPaths(
    supabase: SupabaseClient,
    userId: string,
    status?: string,
  ): Promise<LearningPathWithNodeCount[]> {
    let query = supabase
      .from("learning_paths")
      .select(
        `
        id,
        user_id,
        title,
        description,
        goal,
        target_date,
        source_graph_id,
        domain_id,
        path_type,
        total_estimated_time,
        ai_generated,
        status,
        daily_minutes_target,
        created_at,
        updated_at
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: paths, error } = await query;

    if (error) {
      logger.error("getLearningPaths error:", error);
      throw error;
    }

    if (!paths || paths.length === 0) {
      return [];
    }

    const pathIds = paths.map((p) => p.id);

    const { data: nodesData, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("path_id, status")
      .in("path_id", pathIds);

    if (nodesError) {
      logger.error("getLearningPaths nodes error:", nodesError);
      throw nodesError;
    }

    const nodeStatsMap = new Map<
      string,
      { total: number; completed: number }
    >();

    (nodesData || []).forEach((node) => {
      const stats = nodeStatsMap.get(node.path_id) || {
        total: 0,
        completed: 0,
      };
      stats.total++;
      if (node.status === "completed") {
        stats.completed++;
      }
      nodeStatsMap.set(node.path_id, stats);
    });

    return paths.map((path) => {
      const stats = nodeStatsMap.get(path.id) || { total: 0, completed: 0 };
      return {
        ...path,
        nodes_count: stats.total,
        completed_nodes_count: stats.completed,
      };
    });
  }

  async getLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningPath | null> {
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError) {
      if (pathError.code === "PGRST116") {
        return null;
      }
      logger.error("getLearningPath error:", pathError);
      throw pathError;
    }

    if (!path) {
      return null;
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("*")
      .eq("path_id", pathId)
      .order("order_index", { ascending: true });

    if (nodesError) {
      logger.error("getLearningPath nodes error:", nodesError);
      throw nodesError;
    }

    const progress = await this.getPathProgress(supabase, pathId, userId);

    return {
      ...path,
      nodes: nodes || [],
      progress,
    };
  }

  async updateLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: UpdateLearningPathInput,
  ): Promise<LearningPath> {
    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("learning_paths")
      .update(updateData)
      .eq("id", pathId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("updateLearningPath error:", error);
      throw error;
    }

    if (!data) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return (await this.getLearningPath(
      supabase,
      pathId,
      userId,
    )) as LearningPath;
  }

  async deleteLearningPath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    hardDelete: boolean = false,
  ): Promise<void> {
    const { data: path, error: checkError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (checkError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (hardDelete) {
      const { error } = await supabase
        .from("learning_paths")
        .delete()
        .eq("id", pathId)
        .eq("user_id", userId);

      if (error) {
        logger.error("deleteLearningPath hard delete error:", error);
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("learning_paths")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", pathId)
        .eq("user_id", userId);

      if (error) {
        logger.error("deleteLearningPath archive error:", error);
        throw error;
      }
    }
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

  // ── Core: Goal & Estimation ────────────────────────────────

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
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id, user_id")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const targetDate = new Date(input.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate <= today) {
      throw new AppError(
        i18next.t("learningPath.api.errors.targetDateMustBeFuture"),
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, estimated_time")
      .eq("path_id", pathId);

    if (nodesError) {
      logger.error("setLearningGoal nodes error:", nodesError);
      throw nodesError;
    }

    const totalEstimatedTime = (nodes || []).reduce(
      (sum, n) => sum + (n.estimated_time || 30),
      0,
    );

    const daysUntilTarget = Math.ceil(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const dailyMinutesTarget =
      input.daily_minutes_target ||
      Math.ceil(totalEstimatedTime / daysUntilTarget);

    const { error: updateError } = await supabase
      .from("learning_paths")
      .update({
        goal: input.goal,
        target_date: input.target_date,
        daily_minutes_target: dailyMinutesTarget,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pathId);

    if (updateError) {
      logger.error("setLearningGoal update error:", updateError);
      throw updateError;
    }

    const result = await this.getLearningPath(supabase, pathId, userId);
    if (!result) throw new Error("Learning path not found");
    return {
      ...result,
      total_estimated_time: totalEstimatedTime,
    } as LearningPath & { daily_node_count?: number };
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
    const path = await this.getLearningPath(supabase, pathId, userId);

    if (!path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const nodes = path.nodes || [];

    const { data: userSettings, error: settingsError } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .single();

    if (settingsError) {
      logger.warn("Failed to fetch user settings:", settingsError);
    }

    const userSettingsData = userSettings?.settings || {};
    const avgLearningSpeed = userSettingsData.avg_learning_speed || 1.0;

    const { data: studyCards, error: cardsError } = await supabase
      .from("study_cards")
      .select(
        "knowledge_point_id, difficulty, fsrs_stability, fsrs_difficulty, review_count",
      )
      .eq("user_id", userId);

    if (cardsError) {
      logger.warn("Failed to fetch study cards:", cardsError);
    }

    const cardStats = new Map<
      string,
      {
        avgDifficulty: number;
        avgStability: number;
        totalReviews: number;
      }
    >();

    (studyCards || []).forEach((card) => {
      const kpId = card.knowledge_point_id;
      if (!cardStats.has(kpId)) {
        cardStats.set(kpId, {
          avgDifficulty: 0,
          avgStability: 0,
          totalReviews: 0,
        });
      }
      const stats = cardStats.get(kpId);
      if (!stats) return;
      stats.avgDifficulty += card.difficulty || 1;
      stats.avgStability += card.fsrs_stability || 0;
      stats.totalReviews += card.review_count || 0;
    });

    cardStats.forEach((stats, kpId) => {
      const count =
        studyCards?.filter((c) => c.knowledge_point_id === kpId).length || 1;
      stats.avgDifficulty /= count;
      stats.avgStability /= count;
    });

    const { data: progressData, error: progressError } = await supabase
      .from("learning_path_progress")
      .select("node_id, time_spent")
      .eq("user_id", userId)
      .eq("path_id", pathId);

    if (progressError) {
      logger.warn("Failed to fetch progress data:", progressError);
    }

    const nodeTimeSpent = new Map<string, number>();
    (progressData || []).forEach((p) => {
      nodeTimeSpent.set(p.node_id, p.time_spent || 0);
    });

    const totalCompletedTime = Array.from(nodeTimeSpent.values()).reduce(
      (sum, t) => sum + t,
      0,
    );
    const completedNodeCount = nodeTimeSpent.size;
    const avgTimePerNode =
      completedNodeCount > 0 ? totalCompletedTime / completedNodeCount : 30;

    const userSpeedMultiplier =
      completedNodeCount >= 3
        ? Math.min(Math.max(30 / avgTimePerNode, 0.5), 2.0)
        : avgLearningSpeed;

    const estimates = nodes.map((node) => {
      const baseTime = node.estimated_time || 30;

      let difficultyMultiplier = 1.0;
      let confidence: "low" | "medium" | "high" = "medium";

      if (node.knowledge_point_id && cardStats.has(node.knowledge_point_id)) {
        const stats = cardStats.get(node.knowledge_point_id);
        if (stats) {
          difficultyMultiplier = 0.8 + stats.avgDifficulty * 0.15;
          confidence = stats.totalReviews >= 5 ? "high" : "medium";
        }
      } else {
        confidence = "low";
        difficultyMultiplier = 1.2;
      }

      const estimatedTime = Math.round(
        baseTime * difficultyMultiplier * userSpeedMultiplier,
      );

      return {
        node_id: node.id,
        title: node.title,
        base_time: baseTime,
        difficulty_multiplier: Math.round(difficultyMultiplier * 100) / 100,
        user_speed_multiplier: Math.round(userSpeedMultiplier * 100) / 100,
        estimated_time: estimatedTime,
        confidence,
      };
    });

    return estimates;
  }

  // ── Core: Recommendations ─────────────────────────────────

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
    const path = await this.getLearningPath(supabase, pathId, userId);

    if (!path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const nodes = path.nodes || [];

    // 预构建节点索引，避免多处循环内 find 线性扫描（O(n)→O(1)）
    const nodeById = new Map<string, LearningPathNode>();
    const nodeByKpId = new Map<string, LearningPathNode | undefined>();
    for (const n of nodes) {
      nodeById.set(n.id, n);
      if (n.knowledge_point_id && !nodeByKpId.has(n.knowledge_point_id)) {
        nodeByKpId.set(n.knowledge_point_id, n);
      }
    }

    const recommendations: {
      type: "weak_point" | "review_needed" | "prerequisite_gap" | "milestone";
      priority: "high" | "medium" | "low";
      node_id?: string;
      title: string;
      description: string;
      action?: string;
    }[] = [];

    const progress = await this.getPathProgress(supabase, pathId, userId);

    if (progress.progress_percentage < 50 && progress.pending_nodes > 0) {
      const nextNode = nodes.find((n) => n.status === "pending");
      if (nextNode) {
        recommendations.push({
          type: "milestone",
          priority: "high",
          node_id: nextNode.id,
          title: i18next.t("learningPath.api.suggestionItems.continueNext.title"),
          description: i18next.t("learningPath.api.suggestionItems.continueNext.description", { nodeTitle: nextNode.title, progress: progress.progress_percentage }),
          action: "start_learning",
        });
      }
    }

    const knowledgePointIds = nodes
      .filter((n) => n.knowledge_point_id)
      .map((n) => n.knowledge_point_id);

    if (knowledgePointIds.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from("study_cards")
        .select(
          "id, knowledge_point_id, fsrs_state, fsrs_stability, next_review, review_count",
        )
        .eq("user_id", userId)
        .in("knowledge_point_id", knowledgePointIds);

      if (cardsError) {
        logger.warn("Failed to fetch cards for recommendations:", cardsError);
      }

      const now = new Date();
      const weakKnowledgePoints = new Map<
        string,
        { stability: number; reviewCount: number }
      >();
      const reviewNeededPoints = new Map<string, Date>();

      (cards || []).forEach((card) => {
        if (card.fsrs_stability < 3 && card.review_count >= 2) {
          weakKnowledgePoints.set(card.knowledge_point_id, {
            stability: card.fsrs_stability,
            reviewCount: card.review_count,
          });
        }

        if (card.next_review && new Date(card.next_review) <= now) {
          reviewNeededPoints.set(
            card.knowledge_point_id,
            new Date(card.next_review),
          );
        }
      });

      weakKnowledgePoints.forEach((data, kpId) => {
        const node = nodeByKpId.get(kpId);
        if (node && node.status !== "completed") {
          recommendations.push({
            type: "weak_point",
            priority: "high",
            node_id: node.id,
            title: i18next.t("learningPath.api.suggestionItems.strengthenWeak.title", { nodeTitle: node.title }),
            description: i18next.t("learningPath.api.suggestionItems.strengthenWeak.description", { stability: data.stability.toFixed(1) }),
            action: "review",
          });
        }
      });

      reviewNeededPoints.forEach((reviewDate, kpId) => {
        const node = nodes.find((n) => n.knowledge_point_id === kpId);
        if (node) {
          const daysOverdue = Math.floor(
            (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          recommendations.push({
            type: "review_needed",
            priority: daysOverdue > 3 ? "high" : "medium",
            node_id: node.id,
            title: i18next.t("learningPath.api.suggestionItems.reviewDue.title", { nodeTitle: node.title }),
            description:
              daysOverdue > 0
                ? i18next.t("learningPath.api.suggestionItems.reviewDue.descriptionOverdue", { days: daysOverdue })
                : i18next.t("learningPath.api.suggestionItems.reviewDue.descriptionToday"),
            action: "review",
          });
        }
      });
    }

    const inProgressNodes = nodes.filter((n) => n.status === "in_progress");
    for (const node of inProgressNodes) {
      const incompletePrereqs = node.prerequisites.filter((prereqId) => {
        const prereqNode = nodes.find((n) => n.id === prereqId);
        return prereqNode && prereqNode.status !== "completed";
      });

      if (incompletePrereqs.length > 0) {
        const prereqTitles = incompletePrereqs
          .map((id) => nodes.find((n) => n.id === id)?.title)
          .filter(Boolean)
          .join("、");

        recommendations.push({
          type: "prerequisite_gap",
          priority: "high",
          node_id: node.id,
          title: i18next.t("learningPath.api.suggestionItems.prereqIncomplete.title", { nodeTitle: node.title }),
          description: i18next.t("learningPath.api.suggestionItems.prereqIncomplete.description", { prereqTitles }),
          action: "complete_prerequisites",
        });
      }
    }

    const milestoneNodes = nodes.filter((n) => n.is_milestone);
    for (const milestone of milestoneNodes) {
      if (milestone.status === "pending") {
        const prereqNodes = milestone.prerequisites
          .map((id) => nodeById.get(id))
          .filter((n): n is LearningPathNode => n !== undefined);
        const completedPrereqs = prereqNodes.filter(
          (n) => n.status === "completed",
        ).length;
        const totalPrereqs = prereqNodes.length;

        if (totalPrereqs > 0 && completedPrereqs === totalPrereqs) {
          recommendations.push({
            type: "milestone",
            priority: "medium",
            node_id: milestone.id,
            title: i18next.t("learningPath.api.suggestionItems.milestoneReady.title", { milestoneTitle: milestone.title }),
            description: i18next.t("learningPath.api.suggestionItems.milestoneReady.description"),
            action: "start_learning",
          });
        }
      }
    }

    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return recommendations.slice(0, 10);
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

  async autoSchedulePath(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      start_date?: string;
      daily_minutes?: number;
    },
  ): Promise<{
    main_task_id: string;
    subtask_ids: string[];
    total_tasks: number;
    estimated_days: number;
  }> {
    return this.taskIntegration.autoSchedulePath(supabase, pathId, userId, options);
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

  // ── Core: Cross-graph & Generation ─────────────────────────

  async getCrossGraphProgress(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<Record<string, LearningPathProgressSummary>> {
    const { data: nodes, error } = await supabase
      .from("learning_path_nodes")
      .select("id, status, estimated_time, graph_id")
      .eq("path_id", pathId);

    if (error || !nodes || nodes.length === 0) {
      return {};
    }

    const { data: progressData } = await supabase
      .from("learning_path_progress")
      .select("node_id, time_spent")
      .eq("user_id", userId)
      .eq("path_id", pathId);

    const nodeTimeSpent = new Map<string, number>();
    (progressData || []).forEach((p) => {
      nodeTimeSpent.set(p.node_id, p.time_spent || 0);
    });

    const graphNodes = new Map<string, {
      total: number;
      completed: number;
      in_progress: number;
      pending: number;
      skipped: number;
      totalTimeSpent: number;
    }>();

    for (const node of nodes) {
      const graphId = node.graph_id ?? "unknown";
      if (!graphNodes.has(graphId)) {
        graphNodes.set(graphId, {
          total: 0, completed: 0, in_progress: 0,
          pending: 0, skipped: 0, totalTimeSpent: 0,
        });
      }
      const stats = graphNodes.get(graphId);
      if (!stats) continue;
      stats.total++;
      stats.totalTimeSpent += nodeTimeSpent.get(node.id) ?? 0;

      switch (node.status) {
        case "completed": stats.completed++; break;
        case "in_progress": stats.in_progress++; break;
        case "skipped": stats.skipped++; break;
        default: stats.pending++;
      }
    }

    const result: Record<string, LearningPathProgressSummary> = {};
    graphNodes.forEach((stats, graphId) => {
      result[graphId] = {
        total_nodes: stats.total,
        completed_nodes: stats.completed,
        in_progress_nodes: stats.in_progress,
        pending_nodes: stats.pending,
        skipped_nodes: stats.skipped,
        total_time_spent: stats.totalTimeSpent,
        progress_percentage: stats.total > 0
          ? Math.round((stats.completed / stats.total) * 100)
          : 0,
      };
    });

    return result;
  }

  async getGraphMeta(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<{ title: string; description: string | null } | null> {
    const { data } = await supabase
      .from("knowledge_graphs")
      .select("title, description")
      .eq("id", graphId)
      .single();

    return data as { title: string; description: string | null } | null;
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
    const {
      target_goal,
      target_knowledge_point_id,
      learning_style,
      daily_time_minutes,
      current_knowledge,
      provider: providerType,
      model,
      save_path,
      path_title,
    } = options;

    const { nodes, edges } = await graphService.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    if (nodes.length === 0) {
      throw new AppError(i18next.t("learningPath.api.errors.noNodesInGraph"), 400, ErrorCodes.VALIDATION_ERROR);
    }

    const graphMeta = await this.getGraphMeta(supabase, graphId);

    const progressMap = await buildProgressMap(supabase, userId, nodes);
    const { parentMap, childMap } = buildDependencyMaps(nodes, edges);

    let stages: LearningPathStage[];
    let suggestions: string[];
    let aiGenerated = false;

    if (target_goal) {
      const aiResult = await generateAIPath(
        supabase,
        userId,
        graphId,
        nodes,
        edges,
        progressMap,
        parentMap,
        childMap,
        target_goal,
        learning_style,
        daily_time_minutes,
        current_knowledge,
        graphMeta?.title || "",
        providerType,
        model,
      );
      stages = aiResult.stages;
      suggestions = aiResult.suggestions;
      aiGenerated = true;
    } else {
      const ruleResult = generateRulePath(
        nodes,
        edges,
        progressMap,
        parentMap,
        childMap,
        target_knowledge_point_id,
        daily_time_minutes,
      );
      stages = ruleResult.stages;
      suggestions = ruleResult.suggestions;
    }

    const todayPlan = buildTodayPlan(stages, daily_time_minutes);
    const totalEstimatedTime = stages.reduce(
      (sum, s) => sum + s.estimatedTime,
      0,
    );
    const completedCount = stages.filter((s) => s.isCompleted).length;
    const estimatedDays = Math.ceil(totalEstimatedTime / daily_time_minutes);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + estimatedDays);

    const weeklyProgress = calculateWeeklyProgress(
      daily_time_minutes,
      totalEstimatedTime,
    );

    const learningPath: LearningPathResult = {
      graphId,
      graphTitle: graphMeta?.title || i18next.t("learningPath.api.defaults.unnamedGraph"),
      totalNodes: nodes.length,
      completedNodes: completedCount,
      estimatedTotalTime: totalEstimatedTime,
      stages,
      todayPlan,
      predictions: {
        completionDate: completionDate.toISOString(),
        weeklyProgress,
        recommendedDailyTime: Math.min(
          60,
          Math.ceil(totalEstimatedTime / 14),
        ),
      },
      suggestions,
      aiGenerated,
      targetGoal: target_goal,
    };

    if (save_path) {
      const validStages = stages.filter((stage) => {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            stage.nodeId,
          );
        return isUuid;
      });

      if (validStages.length === 0) {
        throw new AppError(
          i18next.t("learningPath.api.errors.aiPathMatchFailed"),
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const savedPath = await this.createLearningPath(
        supabase,
        userId,
        {
          title: path_title || i18next.t("learningPath.api.defaults.pathTitle", { title: graphMeta?.title || i18next.t("learningPath.api.defaults.unnamedGraph") }),
          goal: target_goal,
          source_graph_id: graphId,
          total_estimated_time: totalEstimatedTime,
          ai_generated: aiGenerated,
          daily_minutes_target: daily_time_minutes,
          nodes: validStages.map((stage, index) => ({
            knowledge_point_id: stage.nodeId,
            order_index: index,
            title: stage.nodeTitle,
            description: stage.reason,
            estimated_time: stage.estimatedTime,
            is_milestone: stage.priority === "high",
            prerequisites: stage.prerequisites.filter((id) =>
              uuidPattern.test(id),
            ),
          })),
        },
      );

      learningPath.id = savedPath.id;
      learningPath.savedPath = savedPath;
    }

    return learningPath;
  }
}

export const learningPathService = new LearningPathService();
