import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { graphService } from "../graph/graphService";
import { buildProgressMap, buildDependencyMaps, generateRulePath, generateAIPath, buildTodayPlan, calculateWeeklyProgress, type LearningPathStage } from "./learningPathAlgorithms";
import type { LearningPathResult, LearningPathProgressSummary } from "./learningPathTypes";
import type { LearningPathCrudService } from "./learningPathCrudService";

/**
 * 学习路径生成服务：跨图进度汇总、图谱元信息、AI/规则路径生成与保存。
 * 保存路径复用 LearningPathCrudService.createLearningPath。
 */
export class LearningPathGenerationService {
  constructor(private readonly crudService: LearningPathCrudService) {}

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
    const { parentMap, childMap, softParentMap } = buildDependencyMaps(
      nodes,
      edges,
    );

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
        softParentMap,
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

      const savedPath = await this.crudService.createLearningPath(
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
