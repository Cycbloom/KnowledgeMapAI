// 学习路径周窗口路由（P2 两级排课）：查询、手动重排、一键顺延

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { stageWindowPlannerService } from "../../services/scheduler/planning/stageWindowPlannerService";
import { uuidParamSchema } from "./shared";

const router = Router();

const replanSchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
    .optional(),
});

// 查询路径的 stage 周窗口（含滞后标记）
router.get(
  "/:id/stage-windows",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const windows = await stageWindowPlannerService.getStageWindows(
      req.supabase,
      req.user.id,
      req.params.id,
    );
    res.json({ windows });
  },
);

// 手动重排周窗口（可指定起始日）
router.post(
  "/:id/stage-windows/replan",
  requireAuth,
  validate({ params: uuidParamSchema, body: replanSchema }),
  async (req: AuthedRequest, res: Response) => {
    const result = await stageWindowPlannerService.planStageWindows(
      req.supabase,
      req.user.id,
      req.params.id,
      { start_date: req.body.start_date },
    );
    res.json(result);
  },
);

// 一键顺延：未完成阶段从下周一起重新排窗
router.post(
  "/:id/stage-windows/postpone",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const result = await stageWindowPlannerService.postponePath(
      req.supabase,
      req.user.id,
      req.params.id,
    );
    res.json(result);
  },
);

export default router;
