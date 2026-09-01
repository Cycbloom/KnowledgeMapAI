import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type {
  LearningPath,
  LearningPathNode,
} from "./learningPathTypes";
import type { LearningPathCrudService } from "./learningPathCrudService";

/** 学习建议项 */
interface Recommendation {
  type: "weak_point" | "review_needed" | "prerequisite_gap" | "milestone";
  priority: "high" | "medium" | "low";
  node_id?: string;
  title: string;
  description: string;
  action?: string;
}

/** 单节点学习时间估算结果 */
interface LearningTimeEstimate {
  node_id: string;
  title: string;
  base_time: number;
  difficulty_multiplier: number;
  user_speed_multiplier: number;
  estimated_time: number;
  confidence: "low" | "medium" | "high";
}

/**
 * 学习路径分析服务：目标设置、学习时间估算、学习建议生成。
 * 复用 LearningPathCrudService 的路径查询能力，避免与主服务循环依赖。
 */
export class LearningPathAnalysisService {
  constructor(private readonly crudService: LearningPathCrudService) {}

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

    const result = await this.crudService.getLearningPath(supabase, pathId, userId);
    if (!result) throw new AppError(ErrorCodes.RESOURCE_PATH_NOT_FOUND, { message: "Learning path not found" });
    return {
      ...result,
      total_estimated_time: totalEstimatedTime,
    } as LearningPath & { daily_node_count?: number };
  }

  async estimateLearningTime(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<LearningTimeEstimate[]> {
    const path = await this.crudService.getLearningPath(supabase, pathId, userId);

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

  async getLearningRecommendations(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
  ): Promise<Recommendation[]> {
    const path = await this.crudService.getLearningPath(supabase, pathId, userId);

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

    const recommendations: Recommendation[] = [];

    const progress = await this.crudService.getPathProgress(supabase, pathId, userId);

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
        // 复杂度降低：用预构建的 nodeByKpId 取节点，替代循环内 O(n) 的 nodes.find()
        const node = nodeByKpId.get(kpId);
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
      // 复杂度降低：用预构建的 nodeById 取前置节点，替代循环内 O(n) 的 nodes.find()
      const incompletePrereqs = node.prerequisites.filter((prereqId) => {
        const prereqNode = nodeById.get(prereqId);
        return prereqNode && prereqNode.status !== "completed";
      });

      if (incompletePrereqs.length > 0) {
        const prereqTitles = incompletePrereqs
          .map((id) => nodeById.get(id)?.title)
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
}
