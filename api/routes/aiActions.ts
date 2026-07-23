import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createActionSchema,
  updateActionSchema,
  executeActionSchema,
} from "../schemas/aiAction";
import { aiActionService, type AIAction } from "../services/ai";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

// List Actions
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId: string | undefined = req.user?.id;
  const supabase = req.supabase;
  if (!supabase || !userId) {
    throw new AppError("未授权访问", 401, ErrorCodes.AUTH_UNAUTHORIZED);
  }
  const graphId = req.query.graph_id as string | undefined;

  const actions = await aiActionService.listActions(supabase, userId, graphId);
  res.json(actions);
});

// Create Action
router.post(
  "/",
  requireAuth,
  validate({ body: createActionSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId: string | undefined = req.user?.id;
    const supabase = req.supabase;
    if (!supabase || !userId) {
      throw new AppError("未授权访问", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const action: Partial<AIAction> = { ...req.body };

    // Enforce user ownership if scope is user/graph
    if (action.scope === "user") {
      action.user_id = userId;
    } else if (action.scope === "graph") {
      // Verify graph ownership (graph_id presence is business logic bound to scope)
      if (!action.graph_id) {
        throw new AppError(
          "图谱级别操作需要提供图谱ID",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const graph = await aiActionService.getGraphOwner(
        supabase,
        action.graph_id,
      );

      if (!graph) {
        throw new AppError("图谱不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (graph.user_id !== userId) {
        throw new AppError(
          "没有权限为此图谱创建操作",
          403,
          ErrorCodes.AUTH_FORBIDDEN,
        );
      }

      action.user_id = userId; // Assign creator
    }

    const newAction = await aiActionService.createAction(supabase, action);
    res.status(201).json(newAction);
  },
);

// Update Action
router.put(
  "/:id",
  requireAuth,
  validate({ body: updateActionSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId: string | undefined = req.user?.id;
    const supabase = req.supabase;
    if (!supabase || !userId) {
      throw new AppError("未授权访问", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const updates = req.body;

    // Check ownership
    const existing = await aiActionService.getAction(supabase, id);
    if (!existing) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);

    if (existing.scope !== "system" && existing.user_id !== userId) {
      throw new AppError(ErrorCodes.AUTH_FORBIDDEN);
    }

    const updated = await aiActionService.updateAction(supabase, id, updates);
    res.json(updated);
  },
);

// Delete Action
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId: string | undefined = req.user?.id;
  const supabase = req.supabase;
  if (!supabase || !userId) {
    throw new AppError("未授权访问", 401, ErrorCodes.AUTH_UNAUTHORIZED);
  }

  // Check ownership
  const existing = await aiActionService.getAction(supabase, id);
  if (!existing) throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);

  if (existing.scope !== "system" && existing.user_id !== userId) {
    throw new AppError(ErrorCodes.AUTH_FORBIDDEN);
  }

  await aiActionService.deleteAction(supabase, id);
  res.json({ success: true });
});

// Execute Action
router.post(
  "/execute",
  requireAuth,
  validate({ body: executeActionSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId: string | undefined = req.user?.id;
    const supabase = req.supabase;
    if (!supabase || !userId) {
      throw new AppError("未授权访问", 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const { action_id, node_id, graph_id } = req.body;

    const result = await aiActionService.executeAction(
      action_id,
      node_id,
      userId,
      graph_id ?? "none",
    );

    res.json(result);
  },
);

export default router;
