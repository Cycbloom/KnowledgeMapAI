import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { progressSyncService } from "../../services/scheduler";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  taskId: z.string().uuid("无效的任务ID"),
});

const syncStudyDurationSchema = z.object({
  taskId: z.string().uuid("无效的任务ID"),
  durationMinutes: z.number().positive("学习时长必须为正数"),
});

const syncTaskCompletionSchema = z.object({
  taskId: z.string().uuid("无效的任务ID"),
  completionQuality: z.number().min(0).max(5).optional(),
});

const batchSyncStudyDurationSchema = z.object({
  items: z
    .array(
      z.object({
        taskId: z.string().uuid("无效的任务ID"),
        durationMinutes: z.number().positive("学习时长必须为正数"),
      })
    )
    .min(1, "至少需要一个同步项")
    .max(50, "单次最多同步50项"),
});

router.post(
  "/study-duration",
  requireAuth,
  validate({ body: syncStudyDurationSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { taskId, durationMinutes } = req.body;

    try {
      const result = await progressSyncService.syncStudyDuration(supabase, {
        taskId,
        userId: req.user.id,
        durationMinutes,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error("Sync study duration error:", error);
      const message =
        error instanceof Error ? error.message : "同步学习时长失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

router.post(
  "/task-completion",
  requireAuth,
  validate({ body: syncTaskCompletionSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { taskId, completionQuality } = req.body;

    try {
      const result = await progressSyncService.syncTaskCompletion(supabase, {
        taskId,
        userId: req.user.id,
        completionQuality,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error("Sync task completion error:", error);
      const message =
        error instanceof Error ? error.message : "同步任务完成失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

router.get(
  "/task/:taskId/summary",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { taskId } = req.params;

    try {
      const result = await progressSyncService.getTaskProgressSummary(
        supabase,
        taskId,
        req.user.id
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error("Get task progress summary error:", error);
      const message =
        error instanceof Error ? error.message : "获取任务进度摘要失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

router.post(
  "/batch/study-duration",
  requireAuth,
  validate({ body: batchSyncStudyDurationSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { items } = req.body;

    const paramsList = items.map(
      (item: { taskId: string; durationMinutes: number }) => ({
        taskId: item.taskId,
        userId: req.user.id,
        durationMinutes: item.durationMinutes,
      })
    );

    try {
      const results = await progressSyncService.batchSyncStudyDuration(
        supabase,
        paramsList
      );

      const successCount = results.length;
      const failedCount = items.length - successCount;

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: items.length,
            success: successCount,
            failed: failedCount,
          },
        },
      });
    } catch (error) {
      logger.error("Batch sync study duration error:", error);
      const message =
        error instanceof Error ? error.message : "批量同步学习时长失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

export default router;
