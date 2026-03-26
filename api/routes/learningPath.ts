import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { graphService } from "../services/graph/index";
import { getAIProviderForTask } from "../services/ai/factory";
import { promptService } from "../services/ai/promptService";
import { logger } from "../utils/logger";
import { checkDuplicateGraphTopic } from "../utils/similaritySearch";
import { z } from "zod";

const router = Router();

const generatePathSchema = z.object({
  graph_id: z.string().uuid(),
  target_goal: z.string().min(5).max(500).optional(),
  target_knowledge_point_id: z.string().uuid().optional(),
  learning_style: z
    .enum(["sequential", "exploratory", "focused", "custom"])
    .default("sequential"),
  daily_time_minutes: z.number().min(5).max(240).default(30),
  current_knowledge: z.string().max(1000).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

interface LearningProgress {
  nodeId: string;
  nodeTitle: string;
  masteryLevel: number;
  lastReviewDate: Date | null;
  nextReviewDate: Date | null;
  reviewCount: number;
  stability: number;
  difficulty: number;
}

interface LearningPathStage {
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  level: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  estimatedTime: number;
  prerequisites: string[];
  isCompleted: boolean;
  masteryLevel: number;
  nextReviewDate: string | null;
}

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

router.post(
  "/generate",
  requireAuth,
  validate(generatePathSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      graph_id,
      target_goal,
      target_knowledge_point_id,
      learning_style,
      daily_time_minutes,
      current_knowledge,
      provider: providerType,
      model,
    } = req.body;
    const supabase = req.supabase!;

    try {
      const { nodes, edges } = await graphService.getGraphNodes(
        supabase,
        req.user.id,
        graph_id,
      );

      if (nodes.length === 0) {
        throw new AppError("图谱中没有节点", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const { data: graphMeta } = await supabase
        .from("knowledge_graphs")
        .select("title, description")
        .eq("id", graph_id)
        .single();

      const { data: studyCards } = await supabase
        .from("study_cards")
        .select(
          `
        knowledge_point_id,
        fsrs_stability,
        fsrs_difficulty,
        fsrs_elapsed_days,
        fsrs_scheduled_days,
        fsrs_last_review,
        next_review,
        review_count
      `,
        )
        .eq("user_id", req.user.id);

      const progressMap = new Map<string, LearningProgress>();
      if (studyCards) {
        studyCards.forEach((p: any) => {
          const nodeId = p.knowledge_point_id;
          if (nodeId) {
            const existing = progressMap.get(nodeId) || {
              nodeId,
              nodeTitle: "",
              masteryLevel: 0,
              lastReviewDate: null,
              nextReviewDate: null,
              reviewCount: 0,
              stability: 0,
              difficulty: 0,
            };

            existing.reviewCount = Math.max(
              existing.reviewCount,
              p.review_count || 0,
            );
            existing.stability = Math.max(
              existing.stability,
              p.fsrs_stability || 0,
            );
            existing.difficulty = p.fsrs_difficulty || 0;

            if (p.fsrs_last_review)
              existing.lastReviewDate = new Date(p.fsrs_last_review);
            if (p.next_review)
              existing.nextReviewDate = new Date(p.next_review);

            existing.masteryLevel = Math.min(
              1,
              (existing.stability / 30) * (1 - existing.difficulty / 10),
            );
            progressMap.set(nodeId, existing);
          }
        });
      }

      nodes.forEach((node: any) => {
        if (!progressMap.has(node.id)) {
          progressMap.set(node.id, {
            nodeId: node.id,
            nodeTitle: node.title,
            masteryLevel: 0,
            lastReviewDate: null,
            nextReviewDate: null,
            reviewCount: 0,
            stability: 0,
            difficulty: 0,
          });
        } else {
          const progress = progressMap.get(node.id)!;
          progress.nodeTitle = node.title;
        }
      });

      const parentMap = new Map<string, string[]>();
      const childMap = new Map<string, string[]>();

      nodes.forEach((node: any) => {
        parentMap.set(node.id, []);
        childMap.set(node.id, []);
      });

      edges.forEach((edge: any) => {
        const parents = parentMap.get(edge.target_knowledge_point_id) || [];
        parents.push(edge.source_knowledge_point_id);
        parentMap.set(edge.target_knowledge_point_id, parents);

        const children = childMap.get(edge.source_knowledge_point_id) || [];
        children.push(edge.target_knowledge_point_id);
        childMap.set(edge.source_knowledge_point_id, children);
      });

      let stages: LearningPathStage[];
      let suggestions: string[];
      let aiGenerated = false;

      if (target_goal) {
        const aiResult = await generateAIPath(
          supabase,
          req.user.id,
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
          progressMap,
          parentMap,
          childMap,
          target_knowledge_point_id,
          daily_time_minutes,
        );
        stages = ruleResult.stages;
        suggestions = ruleResult.suggestions;
      }

      const todayPlan: LearningPathStage[] = [];
      let remainingTime = daily_time_minutes;

      for (const stage of stages) {
        if (remainingTime <= 0) break;
        if (stage.isCompleted && stage.priority !== "high") continue;

        todayPlan.push(stage);
        remainingTime -= stage.estimatedTime;
      }

      const totalEstimatedTime = stages.reduce(
        (sum, s) => sum + s.estimatedTime,
        0,
      );
      const completedCount = stages.filter((s) => s.isCompleted).length;
      const estimatedDays = Math.ceil(totalEstimatedTime / daily_time_minutes);
      const completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + estimatedDays);

      const weeklyProgress: number[] = [];
      let accumulatedTime = 0;
      for (let i = 0; i < 7; i++) {
        accumulatedTime += daily_time_minutes;
        weeklyProgress.push(
          Math.min(
            100,
            Math.round((accumulatedTime / totalEstimatedTime) * 100),
          ),
        );
      }

      const learningPath: LearningPath = {
        graphId: graph_id,
        graphTitle: graphMeta?.title || "未命名图谱",
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

      res.json(learningPath);
    } catch (error: any) {
      logger.error("Learning Path Generation Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "学习路径生成失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

async function generateAIPath(
  supabase: any,
  userId: string,
  graphId: string,
  nodes: any[],
  edges: any[],
  progressMap: Map<string, LearningProgress>,
  parentMap: Map<string, string[]>,
  childMap: Map<string, string[]>,
  targetGoal: string,
  learningStyle: string,
  dailyTimeMinutes: number,
  currentKnowledge: string | undefined,
  graphTitle: string,
  _providerType: string | undefined,
  model: string | undefined,
): Promise<{ stages: LearningPathStage[]; suggestions: string[] }> {
  const provider = await getAIProviderForTask("text");

  if (!provider.hasKey) {
    return generateRulePath(
      nodes,
      progressMap,
      parentMap,
      childMap,
      undefined,
      dailyTimeMinutes,
    );
  }

  const nodesInfo = nodes.map((n) => {
    const progress = progressMap.get(n.id);
    return {
      title: n.title,
      level: n.level || "normal",
      mastery: progress?.masteryLevel || 0,
      isCompleted: (progress?.masteryLevel || 0) > 0.8,
    };
  });

  const nodeIdToTitle = new Map(nodes.map((n) => [n.id, n.title]));
  const edgesInfo = edges.map((e) => ({
    source:
      nodeIdToTitle.get(e.source_knowledge_point_id) ||
      e.source_knowledge_point_id,
    target:
      nodeIdToTitle.get(e.target_knowledge_point_id) ||
      e.target_knowledge_point_id,
    relationship: e.relationship_type,
  }));

  const systemPrompt = await promptService.getRenderedPrompt(
    supabase,
    "learning_path_generate",
    {
      graphTitle,
      targetGoal,
      learningStyle,
      dailyTimeMinutes,
      currentKnowledge: currentKnowledge || "未提供",
      nodesCount: nodes.length,
      isSequential: learningStyle === "sequential",
      isExploratory: learningStyle === "exploratory",
      isFocused: learningStyle === "focused",
      targetGoalProvided: !!targetGoal,
    },
    userId,
    graphId,
  );

  const userMessage = `图谱标题：${graphTitle}
目标：${targetGoal}

学习风格：${learningStyle === "sequential" ? "顺序学习" : learningStyle === "exploratory" ? "探索学习" : learningStyle === "focused" ? "专注学习" : "自定义"}
每日学习时间：${dailyTimeMinutes} 分钟
${currentKnowledge ? `当前知识背景：${currentKnowledge}` : ""}

知识点列表（共 ${nodes.length} 个）：
${JSON.stringify(nodesInfo, null, 2)}
知识点关系：
${JSON.stringify(edgesInfo, null, 2)}
请根据以上信息，规划一条最优的学习路径。注意：如果有明确的学习目标，只需要选择与目标直接相关的核心节点（5-15个），不需要包含图谱中的所有节点。`;

  try {
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"path": [], "suggestions": []}');
    const stages: LearningPathStage[] = (parsed.path || []).map(
      (item: any, index: number) => {
        const node = nodes.find(
          (n) =>
            n.title === item.nodeTitle ||
            n.title.toLowerCase() === item.nodeTitle?.toLowerCase(),
        );
        const progress = node ? progressMap.get(node.id) : null;

        return {
          nodeId: node?.id || item.nodeId || `ai-${index}`,
          nodeTitle: item.nodeTitle || node?.title || "",
          nodeContent: node?.content || "",
          level: node?.level || item.level || "normal",
          order: index,
          priority: item.priority || "medium",
          reason: item.reason || "",
          estimatedTime: item.estimatedTime || 15,
          prerequisites: item.prerequisites || [],
          isCompleted: progress?.masteryLevel
            ? progress.masteryLevel > 0.8
            : false,
          masteryLevel: progress?.masteryLevel || 0,
          nextReviewDate: progress?.nextReviewDate?.toISOString() || null,
        };
      },
    );

    return {
      stages,
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    logger.error("AI Learning Path Error:", error);
    return generateRulePath(
      nodes,
      progressMap,
      parentMap,
      childMap,
      undefined,
      dailyTimeMinutes,
    );
  }
}

function generateRulePath(
  nodes: any[],
  progressMap: Map<string, LearningProgress>,
  parentMap: Map<string, string[]>,
  childMap: Map<string, string[]>,
  targetNodeId: string | undefined,
  _dailyTimeMinutes: number,
): { stages: LearningPathStage[]; suggestions: string[] } {
  const sortedNodes: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  const visit = (nodeId: string) => {
    if (temp.has(nodeId)) return;
    if (visited.has(nodeId)) return;

    temp.add(nodeId);

    const parents = parentMap.get(nodeId) || [];
    parents.forEach((parentId) => visit(parentId));

    temp.delete(nodeId);
    visited.add(nodeId);
    sortedNodes.push(nodeId);
  };

  nodes.forEach((node: any) => visit(node.id));

  const today = new Date();
  const stages: LearningPathStage[] = [];
  let order = 0;

  for (const nodeId of sortedNodes) {
    const node = nodes.find((n: any) => n.id === nodeId);
    const progress = progressMap.get(nodeId);

    if (!node) continue;

    const parents = parentMap.get(nodeId) || [];

    let priority: "high" | "medium" | "low" = "medium";
    let reason = "";

    if (
      progress &&
      progress.nextReviewDate &&
      new Date(progress.nextReviewDate) <= today
    ) {
      priority = "high";
      reason = "需要复习：已到复习时间";
    } else if (!progress || progress.masteryLevel < 0.3) {
      priority = "high";
      reason = "需要学习：尚未掌握";
    } else if (progress.masteryLevel < 0.6) {
      priority = "medium";
      reason = "需要巩固：掌握程度较低";
    } else if (progress.masteryLevel < 0.8) {
      priority = "low";
      reason = "可选复习：基本掌握";
    } else {
      priority = "low";
      reason = "已掌握：可跳过";
    }

    if (targetNodeId) {
      const pathToTarget = findPath(nodeId, targetNodeId, childMap);
      if (pathToTarget.length > 0) {
        priority = "high";
        reason = "目标路径上的知识点";
      }
    }

    const estimatedTime = Math.max(
      5,
      Math.round(15 - (progress?.masteryLevel || 0) * 10),
    );

    stages.push({
      nodeId,
      nodeTitle: node.title,
      nodeContent: node.content || "",
      level: node.level || "normal",
      order: order++,
      priority,
      reason,
      estimatedTime,
      prerequisites: parents,
      isCompleted: (progress?.masteryLevel || 0) > 0.8,
      masteryLevel: progress?.masteryLevel || 0,
      nextReviewDate: progress?.nextReviewDate?.toISOString() || null,
    });
  }

  stages.sort((a, b) => {
    if (a.priority !== b.priority) {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.order - b.order;
  });

  const suggestions: string[] = [];
  const highPriorityCount = stages.filter(
    (s) => s.priority === "high" && !s.isCompleted,
  ).length;
  if (highPriorityCount > 5) {
    suggestions.push("建议增加每日学习时间，有较多待学习/复习的知识点");
  }

  const lowMasteryNodes = stages.filter(
    (s) => s.masteryLevel < 0.3 && !s.isCompleted,
  );
  if (lowMasteryNodes.length > 0) {
    suggestions.push(
      `建议优先学习：${lowMasteryNodes
        .slice(0, 3)
        .map((n) => n.nodeTitle)
        .join("、")}`,
    );
  }

  const dueReviews = stages.filter(
    (s) => s.nextReviewDate && new Date(s.nextReviewDate) <= today,
  );
  if (dueReviews.length > 0) {
    suggestions.push(`有 ${dueReviews.length} 个知识点需要复习`);
  }

  return { stages, suggestions };
}

function findPath(
  startId: string,
  endId: string,
  childMap: Map<string, string[]>,
): string[] {
  const queue: Array<{ id: string; path: string[] }> = [
    { id: startId, path: [startId] },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id === endId) return path;

    const children = childMap.get(id) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({ id: childId, path: [...path, childId] });
      }
    }
  }

  return [];
}

router.get(
  "/progress/:graphId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const supabase = req.supabase!;

    try {
      const { data: graphNodes } = await supabase
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
        .is("deleted_at", null);

      if (!graphNodes || graphNodes.length === 0) {
        return res.json({
          totalNodes: 0,
          masteredNodes: 0,
          learningNodes: 0,
          newNodes: 0,
          progress: 0,
        });
      }

      const nodes = graphNodes.map((gn: any) => {
        const kp = Array.isArray(gn.knowledge_points)
          ? gn.knowledge_points[0]
          : gn.knowledge_points;
        return {
          id: kp?.id || gn.knowledge_point_id,
          title: kp?.title || "",
          level: gn.level,
        };
      });

      const nodeIds = nodes.map((n: any) => n.id);
      const { data: studyCards } = await supabase
        .from("study_cards")
        .select("id, knowledge_point_id, fsrs_stability, fsrs_difficulty")
        .eq("user_id", req.user.id)
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

      res.json({
        totalNodes: nodes.length,
        masteredNodes,
        learningNodes,
        newNodes,
        progress:
          nodes.length > 0
            ? Math.round((masteredNodes / nodes.length) * 100)
            : 0,
      });
    } catch (error: any) {
      logger.error("Progress Fetch Error:", error);
      throw new AppError(
        error.message || "获取进度失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

const getQuestionsSchema = z.object({
  graph_id: z.string().uuid(),
});

router.post(
  "/questions",
  requireAuth,
  validate(getQuestionsSchema),
  async (req: AuthRequest, res: Response) => {
    const { graph_id } = req.body;
    const supabase = req.supabase!;

    try {
      const { data: graphMeta } = await supabase
        .from("knowledge_graphs")
        .select("title, description")
        .eq("id", graph_id)
        .single();

      if (!graphMeta) {
        throw new AppError("图谱不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const { nodes } = await graphService.getGraphNodes(
        supabase,
        req.user.id,
        graph_id,
      );

      if (nodes.length === 0) {
        throw new AppError("图谱中没有节点", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        const defaultQuestions = {
          graphTitle: graphMeta.title,
          suggestedGoals: [
            `全面掌握 ${graphMeta.title} 的核心概念`,
            `能够应用 ${graphMeta.title} 解决实际问题`,
            `深入理解 ${graphMeta.title} 的原理和机制`,
          ],
          prerequisiteQuestions: [
            {
              topic: "基础知识",
              description: "相关的基础概念",
              options: ["不了解", "了解一点", "比较熟悉", "非常熟悉"],
            },
            {
              topic: "实践经验",
              description: "相关的实践经验",
              options: ["不了解", "了解一点", "比较熟悉", "非常熟悉"],
            },
          ],
        };
        return res.json(defaultQuestions);
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
        req.user.id,
        graph_id,
      );

      const userMessage = `图谱标题：${graphMeta.title}
${graphMeta.description ? `描述：${graphMeta.description}` : ""}
知识点预览（共 ${nodes.length} 个）：${nodesInfo}

请根据以上信息，生成学习目标建议和前置知识评估问题。`;

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
                req.user.id,
                q.topic,
                { threshold: 0.85 },
              );

              if (
                duplicateCheck.isDuplicate &&
                duplicateCheck.similarGraphs[0]
              ) {
                const matchedGraph = duplicateCheck.similarGraphs[0];

                const { data: nodeCount } = await supabase
                  .from("graph_nodes")
                  .select("id", { count: "exact", head: true })
                  .eq("graph_id", matchedGraph.id)
                  .is("deleted_at", null);

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

      res.json({
        graphTitle: graphMeta.title,
        suggestedGoals: parsed.suggestedGoals || [],
        prerequisiteQuestions: enhancedQuestions,
      });
    } catch (error: any) {
      logger.error("Learning Path Questions Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "生成问题失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
