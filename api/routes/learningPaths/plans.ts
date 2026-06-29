// 学习路径每日计划路由：创建、列表、按日期获取/更新

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { learningPathService } from "../../services/study";
import { uuidParamSchema, dateParamSchema } from "./shared";

const router = Router();

// 创建每日计划的 schema
const createPlanSchema = z.object({
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD"),
  planned_nodes: z.array(z.string().uuid()).min(1, "至少需要一个节点"),
  planned_duration: z.number().min(5).max(480).optional(),
  notes: z.string().max(500).optional(),
});

// 更新计划状态的 schema
const updatePlanSchema = z.object({
  status: z.enum(["pending", "completed", "partial", "skipped"]).optional(),
  actual_duration: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

// 计划查询参数 schema
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

// 创建每日学习计划
router.post(
  "/:id/plans",
  requireAuth,
  validate({ params: uuidParamSchema, body: createPlanSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.createDailyPlan(
      req.supabase,
      id,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

// 获取每日学习计划列表
router.get(
  "/:id/plans",
  requireAuth,
  validate({ params: uuidParamSchema, query: plansQuerySchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const data = await learningPathService.getDailyPlans(
      req.supabase,
      id,
      req.user.id,
      start_date as string | undefined,
      end_date as string | undefined,
    );

    res.json(data);
  },
);

// 按日期获取每日学习计划
router.get(
  "/:id/plans/:date",
  requireAuth,
  validate({ params: dateParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, date } = req.params;

    const data = await learningPathService.getDailyPlan(
      req.supabase,
      id,
      req.user.id,
      date,
    );

    if (!data) {
      throw new AppError("未找到该日期的计划", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json(data);
  },
);

// 按日期更新每日学习计划状态
router.put(
  "/:id/plans/:date",
  requireAuth,
  validate({ params: dateParamSchema, body: updatePlanSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, date } = req.params;

    const existingPlan = await learningPathService.getDailyPlan(
      req.supabase,
      id,
      req.user.id,
      date,
    );

    if (!existingPlan) {
      throw new AppError("未找到该日期的计划", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const data = await learningPathService.updatePlanStatus(
      req.supabase,
      existingPlan.id,
      req.user.id,
      req.body,
    );

    res.json(data);
  },
);

export default router;
