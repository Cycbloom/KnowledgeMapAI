import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createTaskDependencySchema,
  taskDependencyParamsSchema,
} from "../../schemas/index";
import { taskDependencyService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

function handleError(error: unknown): never {
  const message =
    error instanceof Error ? error.message : "操作失败";
  const status =
    message === "任务不存在" || message === "一个或多个任务不存在"
      ? 404
      : 400;
  throw new AppError(message, status, status === 404 ? ErrorCodes.NOT_FOUND : ErrorCodes.VALIDATION_ERROR);
}

router.post(
  "/tasks/:id/dependencies",
  requireAuth,
  validate({ params: uuidParamsSchema, body: createTaskDependencySchema }),
  async (req: AuthRequest, res: Response) => {
    if (!req.supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }
    try {
      const { id } = req.params;
      const { depends_on_task_id, dependency_type } = req.body;
      const data = await taskDependencyService.create(
        req.supabase,
        req.user.id,
        id,
        { depends_on_task_id, dependency_type },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      handleError(error);
    }
  },
);

router.delete(
  "/tasks/:id/dependencies/:dependencyId",
  requireAuth,
  validate({ params: taskDependencyParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    if (!req.supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }
    try {
      const { id, dependencyId } = req.params;
      await taskDependencyService.delete(
        req.supabase,
        req.user.id,
        id,
        dependencyId,
      );
      res.json({ success: true });
    } catch (error) {
      handleError(error);
    }
  },
);

router.get(
  "/tasks/:id/dependencies",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    if (!req.supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }
    try {
      const { id } = req.params;
      const data = await taskDependencyService.listDependencies(
        req.supabase,
        req.user.id,
        id,
      );
      res.json({ success: true, data });
    } catch (error) {
      handleError(error);
    }
  },
);

router.get(
  "/tasks/:id/dependents",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    if (!req.supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }
    try {
      const { id } = req.params;
      const data = await taskDependencyService.listDependents(
        req.supabase,
        req.user.id,
        id,
      );
      res.json({ success: true, data });
    } catch (error) {
      handleError(error);
    }
  },
);

export default router;
