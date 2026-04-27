import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createProgressPlanSchema,
  updateProgressSchema,
} from "../../schemas/index";
import { logger } from "../../utils/logger";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function generateAverageAllocations(
  days: number,
): Array<{ percentage: number }> {
  const basePercentage = 100 / days;
  const allocations: Array<{ percentage: number }> = [];
  let remaining = 100;

  for (let i = 0; i < days; i++) {
    if (i === days - 1) {
      allocations.push({ percentage: Math.round(remaining * 100) / 100 });
    } else {
      const percentage = Math.round(basePercentage * 100) / 100;
      allocations.push({ percentage });
      remaining -= percentage;
    }
  }

  return allocations;
}

function generateDecreasingAllocations(
  days: number,
): Array<{ percentage: number }> {
  const allocations: Array<{ percentage: number }> = [];
  const totalWeight = (days * (days + 1)) / 2;
  let remaining = 100;

  for (let i = 0; i < days; i++) {
    let percentage: number;
    if (i === days - 1) {
      percentage = Math.round(remaining * 100) / 100;
    } else {
      const weight = days - i;
      percentage = Math.round((weight / totalWeight) * 100 * 100) / 100;
      remaining -= percentage;
    }
    allocations.push({ percentage: Math.max(0, percentage) });
  }

  const total = allocations.reduce((sum, a) => sum + a.percentage, 0);
  if (Math.abs(total - 100) > 0.01 && allocations.length > 0) {
    allocations[allocations.length - 1].percentage =
      Math.round(
        (allocations[allocations.length - 1].percentage + (100 - total)) * 100,
      ) / 100;
  }

  return allocations;
}

function generateIncreasingAllocations(
  days: number,
): Array<{ percentage: number }> {
  const decreasing = generateDecreasingAllocations(days);
  return decreasing.reverse();
}

function generateProgressAllocations(
  startDate: Date,
  endDate: Date,
  mode: "average" | "decreasing" | "increasing" | "custom",
  customAllocations?: Array<{ date: string; percentage: number }>,
): Array<{ date: string; percentage: number }> {
  if (mode === "custom" && customAllocations && customAllocations.length > 0) {
    const total = customAllocations.reduce((sum, a) => sum + a.percentage, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error("自定义进度分配百分比总和必须等于100");
    }
    return customAllocations.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  const days = calculateDaysBetween(startDate, endDate);
  let allocations: Array<{ percentage: number }>;

  switch (mode) {
    case "average":
      allocations = generateAverageAllocations(days);
      break;
    case "decreasing":
      allocations = generateDecreasingAllocations(days);
      break;
    case "increasing":
      allocations = generateIncreasingAllocations(days);
      break;
    default:
      allocations = generateAverageAllocations(days);
  }

  const result: Array<{ date: string; percentage: number }> = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    result.push({
      date: date.toISOString().split("T")[0],
      percentage: allocations[i].percentage,
    });
  }

  return result;
}

router.post(
  "/tasks/:id/progress-plan",
  requireAuth,
  validate({ params: uuidParamsSchema, body: createProgressPlanSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { start_date, end_date, progress_mode, custom_allocations } =
      req.body;

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    try {
      const allocations = generateProgressAllocations(
        new Date(start_date),
        new Date(end_date),
        progress_mode,
        custom_allocations,
      );

      const { error: deleteError } = await supabase
        .from("task_progress_plans")
        .delete()
        .eq("task_id", id);

      if (deleteError) {
        logger.error("Delete existing progress plans error:", deleteError);
      }

      const plansToInsert = allocations.map((allocation) => ({
        task_id: id,
        user_id: req.user.id,
        plan_date: allocation.date,
        planned_percentage: allocation.percentage,
        actual_percentage: 0,
      }));

      const { data: plans, error: insertError } = await supabase
        .from("task_progress_plans")
        .insert(plansToInsert)
        .select();

      if (insertError) {
        logger.error("Insert progress plans error:", insertError);
        return res.status(500).json({ error: "创建进度计划失败" });
      }

      await supabase
        .from("user_tasks")
        .update({
          progress_mode,
          progress_percentage: 0,
        })
        .eq("id", id);

      res.status(201).json({ success: true, data: plans });
    } catch (error) {
      const err = error as Error;
      logger.error("Generate progress allocations error:", err);
      res.status(400).json({ error: err.message || "生成进度计划失败" });
    }
  },
);

router.put(
  "/tasks/:id/progress-plan",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { plan_date, planned_percentage, notes } = req.body;

    if (!plan_date) {
      return res.status(400).json({ error: "请提供计划日期" });
    }

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const updateData: Record<string, unknown> = {};
    if (planned_percentage !== undefined) {
      updateData.planned_percentage = planned_percentage;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有有效的更新字段" });
    }

    const { data: plan, error } = await supabase
      .from("task_progress_plans")
      .update(updateData)
      .eq("task_id", id)
      .eq("plan_date", plan_date)
      .select()
      .single();

    if (error || !plan) {
      return res.status(404).json({ error: "进度计划不存在或更新失败" });
    }

    res.json({ success: true, data: plan });
  },
);

router.get(
  "/tasks/:id/progress-plan",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("id, title, progress_mode, progress_percentage")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: plans, error } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", id)
      .order("plan_date", { ascending: true });

    if (error) {
      logger.error("Get progress plans error:", error);
      return res.status(500).json({ error: "获取进度计划失败" });
    }

    res.json({
      success: true,
      data: {
        task,
        plans: plans || [],
      },
    });
  },
);

router.post(
  "/tasks/:id/progress",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateProgressSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { date, percentage, notes } = req.body;

    const progressDate = date || new Date().toISOString().split("T")[0];

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: plan, error: planError } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", id)
      .eq("plan_date", progressDate)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: "该日期没有进度计划" });
    }

    const { error: updatePlanError } = await supabase
      .from("task_progress_plans")
      .update({
        actual_percentage: percentage,
        notes: notes || plan.notes,
      })
      .eq("id", plan.id);

    if (updatePlanError) {
      logger.error("Update progress plan error:", updatePlanError);
      return res.status(500).json({ error: "更新进度失败" });
    }

    const { data: allPlans, error: allPlansError } = await supabase
      .from("task_progress_plans")
      .select("actual_percentage, planned_percentage")
      .eq("task_id", id);

    if (allPlansError) {
      logger.error("Get all plans error:", allPlansError);
    }

    let totalProgress = 0;
    if (allPlans && allPlans.length > 0) {
      const totalActual = allPlans.reduce(
        (sum, p) => sum + (p.actual_percentage || 0),
        0,
      );
      totalProgress = Math.min(100, Math.round(totalActual));
    }

    const taskUpdateData: Record<string, unknown> = {
      progress_percentage: totalProgress,
    };

    if (totalProgress >= 100) {
      taskUpdateData.status = "completed";
      taskUpdateData.completed_at = new Date().toISOString();
    }

    const { data: updatedTask, error: updateTaskError } = await supabase
      .from("user_tasks")
      .update(taskUpdateData)
      .eq("id", id)
      .select()
      .single();

    if (updateTaskError) {
      logger.error("Update task progress error:", updateTaskError);
      return res.status(500).json({ error: "更新任务进度失败" });
    }

    res.json({
      success: true,
      data: {
        task: updatedTask,
        daily_progress: {
          date: progressDate,
          percentage,
          notes,
        },
        total_progress: totalProgress,
      },
    });
  },
);

export default router;
