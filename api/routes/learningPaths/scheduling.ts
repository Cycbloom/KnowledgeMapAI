// 学习路径日排课路由（P5 小路径×日历）：首排/补排、从今天重排。
// 大路径（cross_graph）不走本路由——排课粒度是自然周，见 stageWindows.ts。

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { pathSchedulerService } from "../../services/scheduler/planning/pathSchedulerService";
import { uuidParamSchema } from "./shared";

const router = Router();

const scheduleSchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD")
    .optional(),
});

// 首排/补排（幂等）：知识点已有排期则复用原日期，只补齐缺排节点；含周窗口联动
router.post(
  "/:id/schedule",
  requireAuth,
  validate({ params: uuidParamSchema, body: scheduleSchema }),
  async (req: AuthedRequest, res: Response) => {
    const result = await pathSchedulerService.planPath(
      req.supabase,
      req.user.id,
      req.params.id,
      { start_date: req.body.start_date },
    );
    res.json(result);
  },
);

// 从今天重排（滞后恢复）：清除本路径参与的 scheduled 行归属后从未完成节点重新装箱
router.post(
  "/:id/schedule/replan",
  requireAuth,
  validate({ params: uuidParamSchema, body: scheduleSchema }),
  async (req: AuthedRequest, res: Response) => {
    const result = await pathSchedulerService.replanFromToday(
      req.supabase,
      req.user.id,
      req.params.id,
      { start_date: req.body.start_date },
    );
    res.json(result);
  },
);

export default router;
