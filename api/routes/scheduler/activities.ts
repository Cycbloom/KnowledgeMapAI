import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { activityService, autoTaskGenerator, smartTaskLinker } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const recordActivitySchema = z.object({
  activity_type: z.enum(["focus_study", "review", "path_progress"]),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  duration: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
  knowledge_point_id: z.string().uuid().optional(),
  graph_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
});

const endActivitySchema = z.object({
  ended_at: z.string().optional(),
  duration: z.number().int().min(0).optional(),
});

const autoGenerateSchema = z.object({
  type: z.enum(["learning", "review", "path_node"]),
  knowledge_point_id: z.string().uuid(),
  graph_id: z.string().uuid().optional(),
  path_node_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().optional(),
  interval_days: z.number().int().min(1).optional(),
  estimated_time: z.number().int().min(1).optional(),
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  const parsed = recordActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Invalid request data", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const activity = await activityService.recordActivity(
    supabase,
    req.user.id,
    parsed.data as import("../../services/scheduler/activityService").RecordActivityData,
  );
  res.status(201).json({ success: true, data: activity });
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  const options: Record<string, unknown> = {};
  if (req.query.from_date) options.from_date = req.query.from_date as string;
  if (req.query.to_date) options.to_date = req.query.to_date as string;
  if (req.query.activity_type)
    {options.activity_type = req.query.activity_type as string;}
  if (req.query.knowledge_point_id)
    {options.knowledge_point_id = req.query.knowledge_point_id as string;}
  if (req.query.graph_id) options.graph_id = req.query.graph_id as string;
  if (req.query.limit)
    {options.limit = parseInt(req.query.limit as string, 10);}
  if (req.query.offset)
    {options.offset = parseInt(req.query.offset as string, 10);}

  const result = await activityService.getActivities(
    supabase,
    req.user.id,
    options as Parameters<typeof activityService.getActivities>[2],
  );
  res.json({ success: true, data: result.data, total: result.total });
});

router.get(
  "/daily/:date",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { date } = req.params;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new AppError("Invalid date format, expected YYYY-MM-DD", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const activities = await activityService.getDailyActivities(
      supabase,
      req.user.id,
      date,
    );
    res.json({ success: true, data: activities });
  },
);

router.get("/stats", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    throw new AppError("start_date and end_date query parameters are required", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !dateRegex.test(start_date as string) ||
    !dateRegex.test(end_date as string)
  ) {
    throw new AppError("Invalid date format, expected YYYY-MM-DD", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const stats = await activityService.getActivityStats(
    supabase,
    req.user.id,
    start_date as string,
    end_date as string,
  );
  res.json({ success: true, data: stats });
});

router.put("/:id/end", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase;
  if (!supabase) {
    throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  const parsed = endActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("Invalid request data", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const activity = await activityService.endActivity(
    supabase,
    req.user.id,
    req.params.id,
    parsed.data.ended_at,
    parsed.data.duration,
  );
  res.json({ success: true, data: activity });
});

router.post(
  "/auto-generate",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const parsed = autoGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid request data", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const {
      type,
      knowledge_point_id,
      graph_id,
      path_node_id,
      parent_task_id,
      title,
      interval_days,
      estimated_time,
    } = parsed.data;

    let result;

    switch (type) {
      case "learning":
        result = await autoTaskGenerator.generateLearningTask(
          supabase,
          req.user.id,
          knowledge_point_id,
          { graphId: graph_id, title },
        );
        break;

      case "review":
        result = await autoTaskGenerator.generateReviewTask(
          supabase,
          req.user.id,
          knowledge_point_id,
          { title, intervalDays: interval_days },
        );
        break;

      case "path_node":
        if (!path_node_id || !parent_task_id) {
          throw new AppError(
            "path_node_id and parent_task_id are required for path_node type",
            400,
            ErrorCodes.VALIDATION_ERROR,
          );
        }
        result = await autoTaskGenerator.generatePathNodeTask(
          supabase,
          req.user.id,
          path_node_id,
          parent_task_id,
          { title, estimatedTime: estimated_time },
        );
        break;
    }

    res.status(201).json({ success: true, data: result });
  },
);

router.get(
  "/link-task",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { graph_id, knowledge_point_id, title } = req.query;

    if (!graph_id && !knowledge_point_id) {
      throw new AppError("graph_id or knowledge_point_id is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    let result;

    if (graph_id) {
      result = await smartTaskLinker.getOrCreateTaskForGraph(
        supabase,
        req.user.id,
        graph_id as string,
      );
    } else {
      result = await smartTaskLinker.getOrCreateTaskForKnowledgePoint(
        supabase,
        req.user.id,
        knowledge_point_id as string,
        { title: title as string },
      );
    }

    res.json({ success: true, data: result });
  },
);

export default router;
