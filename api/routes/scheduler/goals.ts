import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { goalService, type GoalMetric, type GoalPeriodType } from "../../services/scheduler/goalService";

const router = Router();

const upsertGoalSchema = z.object({
  period_type: z.enum(["week", "month"]),
  metric: z.enum([
    "focus_minutes",
    "tasks_completed",
    "cards_reviewed",
    "new_knowledge_points",
  ]),
  target_value: z.number().positive(),
});

// GET /scheduler/goals：当前目标列表（含周期进度）
router.get("/goals", requireAuth, async (req: AuthRequest, res: Response) => {
  const goals = await goalService.listGoals(req.supabase, req.user.id);
  res.json({ success: true, data: goals });
});

// PUT /scheduler/goals：创建 / 更新目标（按 period_type + metric upsert）
router.put("/goals", requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = upsertGoalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "Invalid goal payload" });
    return;
  }
  const { period_type, metric, target_value } = parsed.data;
  const goal = await goalService.upsertGoal(req.supabase, req.user.id, {
    periodType: period_type as GoalPeriodType,
    metric: metric as GoalMetric,
    targetValue: target_value,
  });
  res.json({ success: true, data: goal });
});

// DELETE /scheduler/goals/:id：删除目标
router.delete(
  "/goals/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    await goalService.deleteGoal(req.supabase, req.user.id, req.params.id);
    res.json({ success: true });
  },
);

export default router;
