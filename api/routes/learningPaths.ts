import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import {
  learningPathService,
  buildProgressMap,
  buildDependencyMaps,
  generateAIPath,
  generateRulePath,
  buildTodayPlan,
  calculateWeeklyProgress,
} from "../services/study/learningPathService";
import type { LearningPath, LearningPathStage } from "../services/study/learningPathService";
import { graphService } from "../services/graph/index";
import { logger } from "../utils/logger";
import { z } from "zod";

const router = Router();

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
        const validStages = stages.filter((stage) => {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              stage.nodeId,
            );
          return isUuid;
        });

        if (validStages.length === 0) {
          throw new AppError(
            "AI 生成的学习路径无法匹配到图谱中的知识点，请重试",
            400,
            ErrorCodes.VALIDATION_ERROR,
          );
        }

        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
