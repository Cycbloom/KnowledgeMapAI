import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

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

class ProgressPlanService {
  async createProgressPlan(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    data: {
      start_date: string;
      end_date: string;
      progress_mode: "average" | "decreasing" | "increasing" | "custom";
      custom_allocations?: Array<{ date: string; percentage: number }>;
    },
  ): Promise<Array<Record<string, unknown>>> {
    const { start_date, end_date, progress_mode, custom_allocations } = data;

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "任务不存在",
        context: { userId, taskId },
      });
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
        .eq("task_id", taskId);

      if (deleteError) {
        logger.error("Delete existing progress plans error:", deleteError);
      }

      const plansToInsert = allocations.map((allocation) => ({
        task_id: taskId,
        user_id: userId,
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
        throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
          message: "创建进度计划失败",
          context: { userId, taskId },
        });
      }

      await supabase
        .from("user_tasks")
        .update({
          progress_mode,
          progress_percentage: 0,
        })
        .eq("id", taskId);

      return plans as Array<Record<string, unknown>>;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const err = error as Error;
      logger.error("Generate progress allocations error:", err);
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: err.message || "生成进度计划失败",
        context: { userId, taskId },
      });
    }
  }

  async updateProgressPlan(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    data: {
      plan_date: string;
      planned_percentage?: number;
      notes?: string;
    },
  ): Promise<Record<string, unknown>> {
    const { plan_date, planned_percentage, notes } = data;

    if (!plan_date) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "请提供计划日期",
        context: { userId, taskId },
      });
    }

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "任务不存在",
        context: { userId, taskId },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (planned_percentage !== undefined) {
      updateData.planned_percentage = planned_percentage;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "没有有效的更新字段",
        context: { userId, taskId },
      });
    }

    const { data: plan, error } = await supabase
      .from("task_progress_plans")
      .update(updateData)
      .eq("task_id", taskId)
      .eq("plan_date", plan_date)
      .select()
      .single();

    if (error || !plan) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "进度计划不存在或更新失败",
        context: { userId, taskId, plan_date },
      });
    }

    return plan as Record<string, unknown>;
  }

  async listProgressPlans(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
  ): Promise<{ task: Record<string, unknown>; plans: Array<Record<string, unknown>> }> {
    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("id, title, progress_mode, progress_percentage")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "任务不存在",
        context: { userId, taskId },
      });
    }

    const { data: plans, error } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", taskId)
      .order("plan_date", { ascending: true });

    if (error) {
      logger.error("Get progress plans error:", error);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        message: "获取进度计划失败",
        context: { userId, taskId },
      });
    }

    return {
      task: task as Record<string, unknown>,
      plans: (plans || []) as Array<Record<string, unknown>>,
    };
  }

  async updateProgress(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    data: {
      date?: string;
      percentage: number;
      notes?: string;
    },
  ): Promise<{
    task: Record<string, unknown>;
    daily_progress: { date: string; percentage: number; notes?: string };
    total_progress: number;
  }> {
    const { date, percentage, notes } = data;

    const progressDate = date || new Date().toISOString().split("T")[0];

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (taskError || !task) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "任务不存在",
        context: { userId, taskId },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("task_progress_plans")
      .select("*")
      .eq("task_id", taskId)
      .eq("plan_date", progressDate)
      .single();

    if (planError || !plan) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "该日期没有进度计划",
        context: { userId, taskId, progressDate },
      });
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
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        message: "更新进度失败",
        context: { userId, taskId },
      });
    }

    const { data: allPlans, error: allPlansError } = await supabase
      .from("task_progress_plans")
      .select("actual_percentage, planned_percentage")
      .eq("task_id", taskId);

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
      .eq("id", taskId)
      .select()
      .single();

    if (updateTaskError) {
      logger.error("Update task progress error:", updateTaskError);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_EXECUTION_FAILED, {
        message: "更新任务进度失败",
        context: { userId, taskId },
      });
    }

    return {
      task: updatedTask as Record<string, unknown>,
      daily_progress: {
        date: progressDate,
        percentage,
        notes,
      },
      total_progress: totalProgress,
    };
  }
}

export const progressPlanService = new ProgressPlanService();
