import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { taskExecutionService, executionService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID"),
});

const activitySchema = z.object({
  task_id: z.string().uuid().optional(),
  subtask_id: z.string().uuid().optional(),
  knowledge_point_id: z.string().uuid().optional(),
  stage: z.enum(["learning", "review", "practice", "quiz"]).optional(),
  kind: z.enum(["learning", "review", "practice", "quiz"]),
});

const sessionContextSchema = z.object({
  execution_id: z.string().uuid("无效的会话ID"),
  task_id: z.string().uuid().optional(),
  subtask_id: z.string().uuid().optional(),
  knowledge_point_id: z.string().uuid().optional(),
  stage: z.enum(["learning", "review", "practice", "quiz"]).optional(),
  kind: z.enum(["learning", "review", "practice", "quiz"]),
});

const executionIdSchema = z.object({
  execution_id: z.string().uuid("无效的会话ID"),
});

// 会话：开始/延续一次学习活动（真正进入学习/答题才计时）
router.post(
  "/executions/session/start",
  requireAuth,
  validate({ body: activitySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const b = req.body as z.infer<typeof activitySchema>;
    const execution = await executionService.beginActivity(supabase, req.user.id, {
      taskId: b.task_id,
      subtaskId: b.subtask_id,
      knowledgePointId: b.knowledge_point_id,
      stage: b.stage,
      kind: b.kind,
    });
    res.json({ success: true, data: execution });
  },
);

// 会话：会话内追加一个新活动片段（切知识点 / 学习↔做题，不结束会话）
router.post(
  "/executions/session/append",
  requireAuth,
  validate({ body: sessionContextSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const b = req.body as z.infer<typeof sessionContextSchema>;
    const execution = await executionService.appendSlice(supabase, req.user.id, b.execution_id, {
      taskId: b.task_id,
      subtaskId: b.subtask_id,
      knowledgePointId: b.knowledge_point_id,
      stage: b.stage,
      kind: b.kind,
    });
    res.json({ success: true, data: execution });
  },
);

// 会话：结束会话（离开学习/答题界面），结算总时长
router.post(
  "/executions/session/end",
  requireAuth,
  validate({ body: executionIdSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    const { execution_id } = req.body as z.infer<typeof executionIdSchema>;
    const execution = await executionService.endSession(supabase, req.user.id, execution_id);
    res.json({ success: true, data: execution });
  },
);

const getExecutionsQuerySchema = z.object({
  task_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

router.get(
  "/tasks/:id/executions",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;

    const executions = await taskExecutionService.listByTask(
      supabase,
      req.user.id,
      id,
    );

    res.json({ success: true, data: executions });
  },
);

router.get(
  "/executions",
  requireAuth,
  validate({ query: getExecutionsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { task_id, limit, offset } = req.query as unknown as z.infer<
      typeof getExecutionsQuerySchema
    >;

    const result = await taskExecutionService.list(supabase, req.user.id, {
      task_id,
      limit,
      offset,
    });

    res.json({ success: true, data: result.data, total: result.total });
  },
);

router.get(
  "/executions/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const { id } = req.params;

    const execution = await taskExecutionService.get(
      supabase,
      req.user.id,
      id,
    );

    res.json({ success: true, data: execution });
  },
);

export default router;
