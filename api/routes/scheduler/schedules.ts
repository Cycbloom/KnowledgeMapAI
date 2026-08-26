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

  const schedules = await scheduleService.listSchedules(supabase, req.user.id);
  res.json({ success: true, data: schedules });
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

    const schedule = await scheduleService.createSchedule(supabase, req.user.id, {
      task_template_id, schedule_type, schedule_config, is_active,
    });
    res.status(201).json({ success: true, data: schedule });
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

    const schedule = await scheduleService.updateSchedule(supabase, req.user.id, id, {
      schedule_config, is_active,
    });
    res.json({ success: true, data: schedule });
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

    await scheduleService.deleteSchedule(supabase, req.user.id, id);
    res.json({ success: true });
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

    const result = await scheduleService.runSchedule(supabase, req.user.id, id);
    res.status(201).json({ success: true, data: result });
  },
);

export default router;
