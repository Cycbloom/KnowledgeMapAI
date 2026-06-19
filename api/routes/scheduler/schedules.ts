import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createTaskScheduleSchema,
  updateTaskScheduleSchema,
  taskScheduleParamsSchema,
} from "../../schemas/index";
import { scheduleService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的调度ID"),
});

router.get("/schedules", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  try {
    const schedules = await scheduleService.listSchedules(supabase, req.user.id);
    res.json({ success: true, data: schedules });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    throw new AppError(err.message || "获取周期性任务列表失败", err.statusCode || 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post(
  "/schedules",
  requireAuth,
  validate({ body: createTaskScheduleSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { task_template_id, schedule_type, schedule_config, is_active } = req.body;

    try {
      const schedule = await scheduleService.createSchedule(supabase, req.user.id, {
        task_template_id, schedule_type, schedule_config, is_active,
      });
      res.status(201).json({ success: true, data: schedule });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "创建周期性任务配置失败", err.statusCode || 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.put(
  "/schedules/:id",
  requireAuth,
  validate({ params: taskScheduleParamsSchema, body: updateTaskScheduleSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { schedule_config, is_active } = req.body;

    try {
      const schedule = await scheduleService.updateSchedule(supabase, req.user.id, id, {
        schedule_config, is_active,
      });
      res.json({ success: true, data: schedule });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "更新周期配置失败", err.statusCode || 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.delete(
  "/schedules/:id",
  requireAuth,
  validate({ params: taskScheduleParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      await scheduleService.deleteSchedule(supabase, req.user.id, id);
      res.json({ success: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "删除周期配置失败", err.statusCode || 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/schedules/:id/run",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      const result = await scheduleService.runSchedule(supabase, req.user.id, id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "手动运行调度失败", err.statusCode || 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;
