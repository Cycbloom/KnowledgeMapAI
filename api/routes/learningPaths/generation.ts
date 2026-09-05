// 学习路径生成相关路由：生成预览、生成问题、生成并保存、自动排程

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { learningPathService, learningPathRouteService } from "../../services/study";
import { crossGraphLearningPathService } from "../../services/study/crossGraphLearningPathService";
import { logger } from "../../utils/logger";

const router = Router();

// 生成学习路径的 schema
const generatePathSchema = z.object({
  graph_id: z.string().uuid(),
  target_goal: z.string().min(5).max(500).optional(),
  target_knowledge_point_id: z.string().uuid().optional(),
  learning_style: z
    .enum(["sequential", "exploratory", "focused", "custom"])
    .default("sequential"),
  daily_time_minutes: z.number().min(5).max(240).default(180),
  current_knowledge: z.string().max(1000).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  save_path: z.boolean().optional(),
  path_title: z.string().max(200).optional(),
});

// 生成预览路径的 schema
const generatePreviewPathSchema = z.object({
  graph_id: z.string().uuid(),
  target_goal: z.string().min(5).max(500).optional(),
  target_knowledge_point_id: z.string().uuid().optional(),
  learning_style: z
    .enum(["sequential", "exploratory", "focused", "custom"])
    .default("sequential"),
  daily_time_minutes: z.number().min(5).max(240).default(180),
  current_knowledge: z.string().max(1000).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

// 生成问题请求 schema
const getQuestionsSchema = z.object({
  graph_id: z.string().uuid(),
});

// 自动排程请求 schema
const autoScheduleSchema = z.object({
  start_date: z.string().datetime().optional(),
  daily_minutes: z.number().min(5).max(240).optional(),
});

// 跨图谱学习路径生成请求 schema
const generateCrossGraphSchema = z.object({
  daily_time_minutes: z.number().min(5).max(240).optional(),
  title: z.string().max(200).optional(),
  force: z.boolean().optional(),
  target_goal: z.string().min(5).max(500).optional(),
});

// 生成学习路径预览
router.post(
  "/generate-preview",
  requireAuth,
  validate({ body: generatePreviewPathSchema }),
  async (req: AuthedRequest, res: Response) => {
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

    const learningPath = await learningPathRouteService.generatePath(
      req.supabase,
      req.user.id,
      {
        graph_id,
        target_goal,
        target_knowledge_point_id,
        learning_style,
        daily_time_minutes,
        current_knowledge,
        provider: providerType,
        model,
      },
    );
    res.json(learningPath);
  },
);

// 生成学习路径相关问题
router.post(
  "/questions",
  requireAuth,
  validate({ body: getQuestionsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_id } = req.body;
    const result = await learningPathRouteService.generateQuestions(
      req.supabase,
      req.user.id,
      { graph_id },
    );
    res.json(result);
  },
);

// 生成并保存学习路径
router.post(
  "/generate",
  requireAuth,
  validate({ body: generatePathSchema }),
  async (req: AuthedRequest, res: Response) => {
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

    try {
      const learningPath = await learningPathService.generateAndSavePath(
        req.supabase,
        req.user.id,
        graph_id,
        {
          target_goal,
          target_knowledge_point_id,
          learning_style,
          daily_time_minutes,
          current_knowledge,
          provider: providerType,
          model,
          save_path,
          path_title,
        },
      );

      res.json(learningPath);
    } catch (error) {
      logger.error("Learning Path Generation Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        (error as Error).message || "学习路径生成失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

// 自动排程学习路径
router.post(
  "/:id/auto-schedule",
  requireAuth,
  validate({ body: autoScheduleSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { start_date, daily_minutes } = req.body;
    const supabase = req.supabase;

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
    } catch (error) {
      logger.error("Auto Schedule Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        (error as Error).message || "自动排程失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

// 生成并保存跨图谱学习路径（大调度：图谱级学习顺序）
router.post(
  "/generate-cross-graph",
  requireAuth,
  validate({ body: generateCrossGraphSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { daily_time_minutes, title, force, target_goal } = req.body;
    const result = await crossGraphLearningPathService.generateCrossGraphPath(
      req.supabase,
      req.user.id,
      {
        dailyMinutes: daily_time_minutes,
        title,
        force,
        targetGoal: target_goal,
      },
    );
    res.json({ success: true, data: result });
  },
);

// 获取跨图谱学习路径中「下一个该学的图谱」（大调度决策辅助）
// 注意：路径为两段，避免与 crud 的 GET /:id 单段参数路由冲突
router.get(
  "/cross-graph/next",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const next =
      await crossGraphLearningPathService.getNextGraphInPath(
        req.supabase,
        req.user.id,
      );
    res.json({ success: true, data: next });
  },
);

// 获取跨图谱学习路径概览（首页「下一步」/学习路径面板展示）
router.get(
  "/cross-graph/summary",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const summary = await crossGraphLearningPathService.getCrossGraphSummary(
      req.supabase,
      req.user.id,
    );
    res.json({ success: true, data: summary });
  },
);

export default router;
