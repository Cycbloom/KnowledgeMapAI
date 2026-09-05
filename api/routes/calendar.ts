import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { calendarService } from "../services/scheduler";
import { pathSchedulerService } from "../services/scheduler/planning/pathSchedulerService";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

router.get(
  "/export/ics",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    try {
      const { content, filename } = await calendarService.exportICS(supabase, req.user.id);

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      if (error instanceof Error && error.message === "Failed to fetch tasks") {
        throw new AppError(error.message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }
      throw new AppError("Failed to export calendar", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

router.get(
  "/subscribe/:userId",
  async (req, res: Response) => {
    const { userId } = req.params;
    const supabase = req.supabase;

    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    try {
      const { content } = await calendarService.subscribeICS(supabase, userId);

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(content);
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        throw new AppError(error.message, 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      if (error instanceof Error && error.message === "Failed to fetch tasks") {
        throw new AppError(error.message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }
      throw new AppError("Failed to generate calendar feed", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

router.get(
  "/schedule",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { start, end } = req.query;

    try {
      const events = await calendarService.getScheduleEvents(
        supabase,
        req.user.id,
        start as string | undefined,
        end as string | undefined,
      );

      res.json({ success: true, data: events });
    } catch (_err) {
      throw new AppError("Failed to fetch path schedule", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

router.patch(
  "/schedule/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const newDate = (req.body as { new_date?: unknown } | undefined)?.new_date;
    if (typeof newDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      throw new AppError("Invalid date", 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const result = await pathSchedulerService.reschedule(
        supabase,
        req.user.id,
        req.params.id,
        newDate,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to reschedule path schedule", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.get(
  "/review-projections",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { start, end } = req.query;

    try {
      const events = await calendarService.getReviewProjections(
        supabase,
        req.user.id,
        start as string | undefined,
        end as string | undefined,
      );
      res.json({ success: true, data: events });
    } catch (_err) {
      throw new AppError("Failed to fetch review projections", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.get(
  "/events",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { start, end } = req.query;

    try {
      const events = await calendarService.getEvents(
        supabase,
        req.user.id,
        start as string | undefined,
        end as string | undefined,
      );

      res.json({ success: true, data: events });
    } catch (error) {
      if (error instanceof Error && error.message === "Failed to fetch events") {
        throw new AppError(error.message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }
      throw new AppError("Failed to fetch calendar events", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
);

export default router;
