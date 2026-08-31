import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { schedulerDecisionService } from "../../services/scheduler/schedulerDecisionService";

const router = Router();

const nextStepQuerySchema = z.object({
  overdue_threshold: z.coerce.number().int().min(1).max(20).optional(),
});

const nextActionQuerySchema = z.object({
  task_id: z.string().uuid("无效的任务ID"),
});

/** 调度决策：返回「现在最该做的下一步」（复习打断 / 队列推进） */
router.get(
  "/scheduler/next-step",
  requireAuth,
  validate({ query: nextStepQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { overdue_threshold } = req.query as { overdue_threshold?: string };

    const decision = await schedulerDecisionService.getNextStep(
      req.supabase,
      req.user.id,
      {
        overdueThreshold: overdue_threshold
          ? Number(overdue_threshold)
          : undefined,
      },
    );

    res.json({ success: true, data: decision });
  },
);

/** 是否需要记忆打断（供 UI 提示） */
router.get(
  "/scheduler/review-interrupt",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const result = await schedulerDecisionService.needsReviewInterrupt(
      req.supabase,
      req.user.id,
    );
    res.json({ success: true, data: result });
  },
);

/** 大循环 + 小循环两层决策（供概览/编排面板展示「推进哪个图 / 下一步做哪个知识点」） */
router.get(
  "/scheduler/decision/loops",
  requireAuth,
  validate({ query: nextStepQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { overdue_threshold } = req.query as { overdue_threshold?: string };
    const big = await schedulerDecisionService.decideBigLoop(
      req.supabase,
      req.user.id,
      {
        overdueThreshold: overdue_threshold
          ? Number(overdue_threshold)
          : undefined,
      },
    );

    let small: Awaited<ReturnType<typeof schedulerDecisionService.decideSmallLoop>> | undefined;
    if (big.type === "graph" && big.graphTask) {
      small = await schedulerDecisionService.decideSmallLoop(
        req.supabase,
        big.graphTask,
        undefined,
        req.user.id,
      );
    }

    res.json({ success: true, data: { big, small } });
  },
);

/** 执行动作：给定图谱大任务，返回小循环「下一步」对应跳转（把推荐喂给跳转） */
router.get(
  "/scheduler/decision/next-action",
  requireAuth,
  validate({ query: nextActionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const { task_id } = req.query as { task_id: string };
    const result = await schedulerDecisionService.getNextActionForTask(
      req.supabase,
      task_id,
      req.user.id,
    );
    res.json({ success: true, data: result });
  },
);

export default router;