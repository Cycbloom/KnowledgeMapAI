import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { learningPathService } from "../services/study/learningPathService.js";
import { graphService } from "../services/graph/index.js";
import { getAIProviderForTask } from "../services/ai/factory.js";
import { promptService } from "../services/ai/promptService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import type { LearningPath } from "../services/study/learningPathService.js";

const router = Router();

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

interface LearningPathResult {
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

const uuidParamSchema = z.object({
  id: z.string().uuid("无效的学习路径ID"),
});

const nodeIdParamSchema = z.object({
  id: z.string().uuid("无效的学习路径ID"),
  nodeId: z.string().uuid("无效的节点ID"),
});

const dateParamSchema = z.object({
  id: z.string().uuid("无效的学习路径ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD"),
});

const createPathSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  description: z.string().max(2000).optional(),
  goal: z.string().max(500).optional(),
  target_date: z.string().datetime().optional(),
  source_graph_id: z.string().uuid().optional(),
  total_estimated_time: z.number().min(0).optional(),
  ai_generated: z.boolean().optional(),
  daily_minutes_target: z.number().min(5).max(480).optional(),
  nodes: z
    .array(
      z.object({
        knowledge_point_id: z.string().uuid().optional(),
        order_index: z.number().int().min(0),
        title: z.string().min(1, "节点标题不能为空"),
        description: z.string().optional(),
        estimated_time: z.number().min(1).optional(),
        is_milestone: z.boolean().optional(),
        prerequisites: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

const updatePathSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200).optional(),
  description: z.string().max(2000).optional(),
  goal: z.string().max(500).optional(),
  target_date: z.string().datetime().optional(),
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
  daily_minutes_target: z.number().min(5).max(480).optional(),
});

const addNodeSchema = z.object({
  knowledge_point_id: z.string().uuid().optional(),
  order_index: z.number().int().min(0),
  title: z.string().min(1, "节点标题不能为空"),
  description: z.string().optional(),
  estimated_time: z.number().min(1).optional(),
  is_milestone: z.boolean().optional(),
  prerequisites: z.array(z.string()).optional(),
});

const updateNodeStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
  notes: z.string().max(1000).optional(),
  time_spent: z.number().min(0).optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
});

const reorderNodesSchema = z.object({
  nodeOrders: z
    .array(
      z.object({
        id: z.string().uuid(),
        order_index: z.number().int().min(0),
      }),
    )
    .min(1, "至少需要一个节点"),
});

const updateProgressSchema = z.object({
  node_id: z.string().uuid("无效的节点ID"),
  progress_percentage: z.number().min(0).max(100).optional(),
  time_spent: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

const createPlanSchema = z.object({
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD"),
  planned_nodes: z.array(z.string().uuid()).min(1, "至少需要一个节点"),
  planned_duration: z.number().min(5).max(480).optional(),
  notes: z.string().max(500).optional(),
});

const updatePlanSchema = z.object({
  status: z.enum(["pending", "completed", "partial", "skipped"]).optional(),
  actual_duration: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

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
  save_path: z.boolean().optional(),
  path_title: z.string().max(200).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
});

const plansQuerySchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
    .optional(),
});

router.get(
  "/",
  requireAuth,
  validate({ query: listQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { status } = req.query;
    const data = await learningPathService.getLearningPaths(
      req.supabase!,
      req.user.id,
      status as string | undefined,
    );
    res.json(data);
  },
);

router.post(
  "/",
  requireAuth,
  validate({ body: createPathSchema }),
  async (req: AuthRequest, res: Response) => {
    const data = await learningPathService.createLearningPath(
      req.supabase!,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

router.get(
  "/:id",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.getLearningPath(
      req.supabase!,
      id,
      req.user.id,
    );

    if (!data) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.NOT_FOUND);
    }

    res.json(data);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamSchema, body: updatePathSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.updateLearningPath(
      req.supabase!,
      id,
      req.user.id,
      req.body,
    );
    res.json(data);
  },
);

router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const hardDelete = req.query.hard === "true";

    await learningPathService.deleteLearningPath(
      req.supabase!,
      id,
      req.user.id,
      hardDelete,
    );

    res.json({
      message: hardDelete ? "学习路径已永久删除" : "学习路径已归档",
    });
  },
);

router.post(
  "/:id/nodes",
  requireAuth,
  validate({ params: uuidParamSchema, body: addNodeSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.addNodeToPath(
      req.supabase!,
      id,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

router.put(
  "/:id/nodes/:nodeId/status",
  requireAuth,
  validate({ params: nodeIdParamSchema, body: updateNodeStatusSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, nodeId } = req.params;
    const data = await learningPathService.updateNodeStatus(
      req.supabase!,
      id,
      nodeId,
      req.user.id,
      req.body,
    );
    res.json(data);
  },
);

router.put(
  "/:id/nodes/reorder",
  requireAuth,
  validate({ params: uuidParamSchema, body: reorderNodesSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { nodeOrders } = req.body;

    await learningPathService.reorderNodes(
      req.supabase!,
      id,
      req.user.id,
      nodeOrders,
    );

    res.json({ message: "节点顺序已更新" });
  },
);

router.delete(
  "/:id/nodes/:nodeId",
  requireAuth,
  validate({ params: nodeIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, nodeId } = req.params;

    await learningPathService.removeNodeFromPath(
      req.supabase!,
      id,
      nodeId,
      req.user.id,
    );

    res.json({ message: "节点已移除" });
  },
);

router.get(
  "/:id/progress",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.getPathProgress(
      req.supabase!,
      id,
      req.user.id,
    );
    res.json(data);
  },
);

router.put(
  "/:id/progress",
  requireAuth,
  validate({ params: uuidParamSchema, body: updateProgressSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { node_id, ...input } = req.body;

    const data = await learningPathService.updateProgress(
      req.supabase!,
      id,
      node_id,
      req.user.id,
      input,
    );

    res.json(data);
  },
);

router.post(
  "/:id/plans",
  requireAuth,
  validate({ params: uuidParamSchema, body: createPlanSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.createDailyPlan(
      req.supabase!,
      id,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

router.get(
  "/:id/plans",
  requireAuth,
  validate({ params: uuidParamSchema, query: plansQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const data = await learningPathService.getDailyPlans(
      req.supabase!,
      id,
      req.user.id,
      start_date as string | undefined,
      end_date as string | undefined,
    );

    res.json(data);
  },
);

router.get(
  "/:id/plans/:date",
  requireAuth,
  validate({ params: dateParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, date } = req.params;

    const data = await learningPathService.getDailyPlan(
      req.supabase!,
      id,
      req.user.id,
      date,
    );

    if (!data) {
      throw new AppError("未找到该日期的计划", 404, ErrorCodes.NOT_FOUND);
    }

    res.json(data);
  },
);

router.put(
  "/:id/plans/:date",
  requireAuth,
  validate({ params: dateParamSchema, body: updatePlanSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, date } = req.params;

    const existingPlan = await learningPathService.getDailyPlan(
      req.supabase!,
      id,
      req.user.id,
      date,
    );

    if (!existingPlan) {
      throw new AppError("未找到该日期的计划", 404, ErrorCodes.NOT_FOUND);
    }

    const data = await learningPathService.updatePlanStatus(
      req.supabase!,
      existingPlan.id,
      req.user.id,
      req.body,
    );

    res.json(data);
  },
);

router.post(
  "/generate",
  requireAuth,
  validate({ body: generatePathSchema }),
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
      save_path,
      path_title,
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

      const progressMap = await buildProgressMap(supabase, req.user.id, nodes);
      const { parentMap, childMap } = buildDependencyMaps(nodes, edges);

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

      if (save_path) {
        const savedPath = await learningPathService.createLearningPath(
          supabase,
          req.user.id,
          {
            title: path_title || `${graphMeta?.title || "图谱"}学习路径`,
            goal: target_goal,
            source_graph_id: graph_id,
            total_estimated_time: totalEstimatedTime,
            ai_generated: aiGenerated,
            daily_minutes_target: daily_time_minutes,
            nodes: stages.map((stage, index) => ({
              knowledge_point_id: stage.nodeId,
              order_index: index,
              title: stage.nodeTitle,
              description: stage.reason,
              estimated_time: stage.estimatedTime,
              is_milestone: stage.priority === "high",
              prerequisites: stage.prerequisites,
            })),
          },
        );

        learningPath.id = savedPath.id;
        learningPath.savedPath = savedPath;
      }

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
      edges,
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
      id: n.id,
      title: n.title,
      level: n.level || "normal",
      mastery: progress?.masteryLevel || 0,
      isCompleted: (progress?.masteryLevel || 0) > 0.8,
    };
  });

  const edgesInfo = edges.map((e) => ({
    source: e.source_knowledge_point_id,
    target: e.target_knowledge_point_id,
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

请根据以上信息，规划一条最优的学习路径。`;

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

    const stages = (parsed.path || []).map((item: any, index: number) => {
      const node = nodes.find(
        (n) => n.id === item.nodeId || n.title === item.nodeTitle,
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
    });

    return {
      stages,
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    logger.error("AI Learning Path Error:", error);
    return generateRulePath(
      nodes,
      edges,
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
  _edges: any[],
  progressMap: Map<string, LearningProgress>,
  parentMap: Map<string, string[]>,
  childMap: Map<string, string[]>,
  targetNodeId: string | undefined,
  _dailyTimeMinutes: number,
): { stages: LearningPathStage[]; suggestions: string[] } {
  const sortedNodes = topologicalSort(nodes, parentMap);

  const today = new Date();
  const stages: LearningPathStage[] = [];
  let order = 0;

  for (const nodeId of sortedNodes) {
    const node = nodes.find((n: any) => n.id === nodeId);
    const progress = progressMap.get(nodeId);

    if (!node) continue;

    const parents = parentMap.get(nodeId) || [];
    const children = childMap.get(nodeId) || [];

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

    const estimatedTime = calculateEstimatedTime(
      progress?.masteryLevel || 0,
      node.level,
      parents.length,
      children.length,
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
      const priorityOrder: Record<"high" | "medium" | "low", number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.order - b.order;
  });

  const suggestions = generateSuggestions(stages, today);

  return { stages, suggestions };
}

function topologicalSort(
  nodes: any[],
  parentMap: Map<string, string[]>,
): string[] {
  const sortedNodes: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();
  const cycleNodes = new Set<string>();

  const visit = (nodeId: string, path: string[] = []): boolean => {
    if (temp.has(nodeId)) {
      cycleNodes.add(nodeId);
      logger.warn(`检测到循环依赖: ${[...path, nodeId].join(" -> ")}`);
      return false;
    }
    if (visited.has(nodeId)) return true;

    temp.add(nodeId);

    const parents = parentMap.get(nodeId) || [];
    for (const parentId of parents) {
      if (!visit(parentId, [...path, nodeId])) {
        break;
      }
    }

    temp.delete(nodeId);
    visited.add(nodeId);
    sortedNodes.push(nodeId);
    return true;
  };

  nodes.forEach((node: any) => {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  });

  if (cycleNodes.size > 0) {
    logger.info(`检测到 ${cycleNodes.size} 个循环依赖节点，已按最优顺序排列`);
  }

  return sortedNodes;
}

function calculateEstimatedTime(
  masteryLevel: number,
  level: string = "normal",
  parentCount: number = 0,
  childCount: number = 0,
): number {
  let baseTime = 15;

  switch (level) {
    case "beginner":
      baseTime = 25;
      break;
    case "intermediate":
      baseTime = 20;
      break;
    case "advanced":
      baseTime = 30;
      break;
    default:
      baseTime = 15;
  }

  const dependencyFactor = Math.max(0, parentCount - 1) * 2;
  const successorFactor = Math.max(0, childCount - 1) * 1;

  const adjustedTime = baseTime + dependencyFactor + successorFactor;

  const masteryReduction = masteryLevel * 10;

  return Math.max(5, Math.round(adjustedTime - masteryReduction));
}

function generateSuggestions(
  stages: LearningPathStage[],
  today: Date,
): string[] {
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

  const advancedNodes = stages.filter(
    (s) => s.level === "advanced" && !s.isCompleted,
  );
  if (advancedNodes.length > 3) {
    suggestions.push("有较多高级知识点，建议确保前置知识已掌握");
  }

  return suggestions;
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

async function buildProgressMap(
  supabase: any,
  userId: string,
  nodes: any[],
): Promise<Map<string, LearningProgress>> {
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
    .eq("user_id", userId);

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
        if (p.next_review) existing.nextReviewDate = new Date(p.next_review);

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

  return progressMap;
}

function buildDependencyMaps(
  nodes: any[],
  edges: any[],
): {
  parentMap: Map<string, string[]>;
  childMap: Map<string, string[]>;
} {
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

  return { parentMap, childMap };
}

function buildTodayPlan(
  stages: LearningPathStage[],
  dailyTimeMinutes: number,
): LearningPathStage[] {
  const todayPlan: LearningPathStage[] = [];
  let remainingTime = dailyTimeMinutes;

  for (const stage of stages) {
    if (remainingTime <= 0) break;
    if (stage.isCompleted && stage.priority !== "high") continue;

    todayPlan.push(stage);
    remainingTime -= stage.estimatedTime;
  }

  return todayPlan;
}

function calculateWeeklyProgress(
  dailyTimeMinutes: number,
  totalEstimatedTime: number,
): number[] {
  const weeklyProgress: number[] = [];
  let accumulatedTime = 0;

  for (let i = 0; i < 7; i++) {
    accumulatedTime += dailyTimeMinutes;
    weeklyProgress.push(
      Math.min(100, Math.round((accumulatedTime / totalEstimatedTime) * 100)),
    );
  }

  return weeklyProgress;
}

const autoScheduleSchema = z.object({
  start_date: z.string().datetime().optional(),
  daily_minutes: z.number().min(5).max(240).optional(),
});

router.post(
  "/:id/auto-schedule",
  requireAuth,
  validate({ body: autoScheduleSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { start_date, daily_minutes } = req.body;
    const supabase = req.supabase!;

    try {
      const result = await learningPathService.autoSchedulePath(
        supabase,
        id,
        req.user.id,
        {
          start_date,
          daily_minutes,
        },
      );

      res.json({
        success: true,
        main_task_id: result.main_task_id,
        subtask_ids: result.subtask_ids,
        total_tasks: result.total_tasks,
        estimated_days: result.estimated_days,
      });
    } catch (error: any) {
      logger.error("Auto Schedule Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        error.message || "自动排程失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
