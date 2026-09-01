import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { graphService } from "../graph/graphService";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { checkDuplicateGraphTopic } from "../../utils/similaritySearch";
import {
  buildProgressMap,
  buildDependencyMaps,
  generateAIPath,
  generateRulePath,
  buildTodayPlan,
  calculateWeeklyProgress,
  type LearningPathStage,
} from "./learningPathAlgorithms";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

interface LearningPath {
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
  aiGenerated?: boolean;
  targetGoal?: string;
}

interface GeneratePathData {
  graph_id: string;
  target_goal?: string;
  target_knowledge_point_id?: string;
  learning_style: string;
  daily_time_minutes: number;
  current_knowledge?: string;
  provider?: string;
  model?: string;
}

interface GenerateQuestionsData {
  graph_id: string;
}

class LearningPathRouteService {
  async generatePath(
    supabase: SupabaseClient,
    userId: string,
    data: GeneratePathData,
  ): Promise<LearningPath> {
    const {
      graph_id,
      target_goal,
      target_knowledge_point_id,
      learning_style,
      daily_time_minutes,
      current_knowledge,
      provider: providerType,
      model,
    } = data;

    try {
      const { nodes, edges } = await graphService.getGraphNodes(
        supabase,
        userId,
        graph_id,
      );

      if (nodes.length === 0) {
        throw new AppError(i18next.t("learningPath.api.errors.noNodesInGraph"), 400, ErrorCodes.VALIDATION_ERROR);
      }

      const { data: graphMeta } = await supabase
        .from("knowledge_graphs")
        .select("title, description")
        .eq("id", graph_id)
        .single();

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
          graph_id,
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

      const learningPath: LearningPath = {
        graphId: graph_id,
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

      return learningPath;
    } catch (error) {
      logger.error("Learning Path Generation Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        (error as Error).message || i18next.t("learningPath.api.errors.generatePathFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async getProgress(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ): Promise<{
    totalNodes: number;
    masteredNodes: number;
    learningNodes: number;
    newNodes: number;
    progress: number;
  }> {
    try {
      const { data: graphNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select(
          `
        knowledge_point_id,
        level,
        knowledge_points (
          id,
          title
        )
      `,
        )
        .eq("graph_id", graphId)
        );

      if (!graphNodes || graphNodes.length === 0) {
        return {
          totalNodes: 0,
          masteredNodes: 0,
          learningNodes: 0,
          newNodes: 0,
          progress: 0,
        };
      }

      const nodes = graphNodes.map((gn: { knowledge_point_id: string; level: string; knowledge_points?: { id?: string; title?: string } | { id?: string; title?: string }[] }) => {
        const kp = Array.isArray(gn.knowledge_points)
          ? gn.knowledge_points[0]
          : gn.knowledge_points;
        return {
          id: kp?.id || gn.knowledge_point_id,
          title: kp?.title || "",
          level: gn.level,
        };
      });

      const nodeIds = nodes.map((n) => n.id);
      const { data: studyCards } = await supabase
        .from("study_cards")
        .select("id, knowledge_point_id, fsrs_stability, fsrs_difficulty")
        .eq("user_id", userId)
        .in("knowledge_point_id", nodeIds);

      const nodeProgress = new Map<
        string,
        { mastered: boolean; learning: boolean }
      >();

      if (studyCards) {
        studyCards.forEach((card) => {
          const mastery = Math.min(
            1,
            ((card.fsrs_stability || 0) / 30) *
              (1 - (card.fsrs_difficulty || 5) / 10),
          );
          nodeProgress.set(card.knowledge_point_id, {
            mastered: mastery > 0.8,
            learning: mastery > 0.3 && mastery <= 0.8,
          });
        });
      }

      let masteredNodes = 0;
      let learningNodes = 0;
      let newNodes = 0;

      nodes.forEach((node) => {
        const np = nodeProgress.get(node.id);
        if (np?.mastered) masteredNodes++;
        else if (np?.learning) learningNodes++;
        else newNodes++;
      });

      return {
        totalNodes: nodes.length,
        masteredNodes,
        learningNodes,
        newNodes,
        progress:
          nodes.length > 0
            ? Math.round((masteredNodes / nodes.length) * 100)
            : 0,
      };
    } catch (error) {
      logger.error("Progress Fetch Error:", error);
      throw new AppError(
        (error as Error).message || i18next.t("learningPath.api.errors.getProgressFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async generateQuestions(
    supabase: SupabaseClient,
    userId: string,
    data: GenerateQuestionsData,
  ): Promise<{
    graphTitle: string;
    suggestedGoals: string[];
    prerequisiteQuestions: Array<{
      topic: string;
      description?: string;
      options: string[];
      existingGraph?: {
        id: string;
        title: string;
        similarity: number;
        nodeCount: number;
      };
    }>;
  }> {
    const { graph_id } = data;

    try {
      const { data: graphMeta } = await supabase
        .from("knowledge_graphs")
        .select("title, description")
        .eq("id", graph_id)
        .single();

      if (!graphMeta) {
        throw new AppError(i18next.t("learningPath.api.errors.graphNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const { nodes } = await graphService.getGraphNodes(
        supabase,
        userId,
        graph_id,
      );

      if (nodes.length === 0) {
        throw new AppError(i18next.t("learningPath.api.errors.noNodesInGraph"), 400, ErrorCodes.VALIDATION_ERROR);
      }

      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        const defaultQuestions = {
          graphTitle: graphMeta.title,
          suggestedGoals: [
            i18next.t("learningPath.api.goals.masterCoreConcepts", { title: graphMeta.title }),
            i18next.t("learningPath.api.goals.applyToSolveProblems", { title: graphMeta.title }),
            i18next.t("learningPath.api.goals.understandPrinciples", { title: graphMeta.title }),
          ],
          prerequisiteQuestions: [
            {
              topic: i18next.t("learningPath.api.assessment.basicKnowledgeTopic"),
              description: i18next.t("learningPath.api.assessment.basicKnowledgeDesc"),
              options: [
                i18next.t("learningPath.api.assessment.options.notFamiliar"),
                i18next.t("learningPath.api.assessment.options.slightlyFamiliar"),
                i18next.t("learningPath.api.assessment.options.familiar"),
                i18next.t("learningPath.api.assessment.options.veryFamiliar"),
              ],
            },
            {
              topic: i18next.t("learningPath.api.assessment.practicalExperienceTopic"),
              description: i18next.t("learningPath.api.assessment.practicalExperienceDesc"),
              options: [
                i18next.t("learningPath.api.assessment.options.notFamiliar"),
                i18next.t("learningPath.api.assessment.options.slightlyFamiliar"),
                i18next.t("learningPath.api.assessment.options.familiar"),
                i18next.t("learningPath.api.assessment.options.veryFamiliar"),
              ],
            },
          ],
        };
        return defaultQuestions;
      }

      const validNodes = nodes.filter(
        (n): n is NonNullable<typeof n> => n !== null,
      );
      const nodesInfo = validNodes
        .slice(0, 20)
        .map((n) => n.title)
        .join("、");

      const systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "learning_path_questions",
        {
          graphTitle: graphMeta.title,
          graphDescription: graphMeta.description || "",
          nodesPreview: nodesInfo,
          nodesCount: nodes.length,
        },
        userId,
        graph_id,
      );

      const descriptionLine = graphMeta.description
        ? i18next.t("learningPath.api.prompts.descriptionLine", { description: graphMeta.description })
        : "";
      const userMessage = i18next.t("learningPath.api.prompts.userMessage", {
        title: graphMeta.title,
        descriptionLine,
        count: nodes.length,
        nodesPreview: nodesInfo,
      });

      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: provider.model,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content;
      const parsed = JSON.parse(content || "{}");

      const prerequisiteQuestions = parsed.prerequisiteQuestions || [];

      const enhancedQuestions = await Promise.all(
        prerequisiteQuestions.map(
          async (q: {
            topic: string;
            description?: string;
            options: string[];
          }) => {
            try {
              const duplicateCheck = await checkDuplicateGraphTopic(
                supabase,
                userId,
                q.topic,
                { threshold: 0.85 },
              );

              if (
                duplicateCheck.isDuplicate &&
                duplicateCheck.similarGraphs[0]
              ) {
                const matchedGraph = duplicateCheck.similarGraphs[0];

                const { data: nodeCount } = await notDeleted(supabase
                  .from("graph_nodes")
                  .select("id", { count: "exact", head: true })
                  .eq("graph_id", matchedGraph.id)
                  );

                return {
                  ...q,
                  existingGraph: {
                    id: matchedGraph.id,
                    title: matchedGraph.title,
                    similarity: matchedGraph.similarity,
                    nodeCount: nodeCount?.length || 0,
                  },
                };
              }
            } catch (err) {
              logger.warn(
                `Failed to check existing graph for topic "${q.topic}":`,
                err,
              );
            }

            return q;
          },
        ),
      );

      return {
        graphTitle: graphMeta.title,
        suggestedGoals: parsed.suggestedGoals || [],
        prerequisiteQuestions: enhancedQuestions,
      };
    } catch (error) {
      logger.error("Learning Path Questions Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        (error as Error).message || i18next.t("learningPath.api.errors.generateQuestionsFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }
}

export const learningPathRouteService = new LearningPathRouteService();
