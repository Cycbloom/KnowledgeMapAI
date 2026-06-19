import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { cacheService, CacheKeys } from "../services/common";
import {
  graphNodeService,
  graphService,
  knowledgePointService,
} from "../services/graph";
import { z } from "zod";

const router = Router();

const createGraphNodeSchema = z.object({
  body: z.object({
    graph_id: z.string().uuid(),
    knowledge_point_id: z.string().uuid(),
    x_position: z.number().optional().default(0),
    y_position: z.number().optional().default(0),
    level: z
      .enum(["root", "core", "sub", "normal", "leaf"])
      .optional()
      .default("normal"),
    is_accepted: z.boolean().optional().default(true),
  }),
});

router.post(
  "/graph-nodes",
  requireAuth,
  validate(createGraphNodeSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
    } = req.body;

    const graph = await graphService.getGraph(
      req.supabase!,
      graph_id,
      req.user.id,
    );

    if (!graph) {
      throw new AppError(
        "Graph not found or unauthorized",
        403,
        ErrorCodes.FORBIDDEN,
      );
    }

    try {
      const data = await graphNodeService.addToGraph(req.supabase!, {
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
      });

      cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));

      res.status(201).json(data);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes("已存在")) {
        throw new AppError(
          "Knowledge point already exists in this graph",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/graph-nodes/add-existing",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graph_id, knowledge_point_id, x_position, y_position, level } =
      req.body;

    const graph = await graphService.getGraph(
      req.supabase!,
      graph_id,
      req.user.id,
    );

    if (!graph) {
      throw new AppError(
        "Graph not found or unauthorized",
        403,
        ErrorCodes.FORBIDDEN,
      );
    }

    const kp = await knowledgePointService.getAccessible(
      req.supabase!,
      knowledge_point_id,
      req.user.id,
    );

    if (!kp) {
      throw new AppError(
        "Knowledge point not found or inaccessible",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    try {
      const data = await graphNodeService.addToGraph(req.supabase!, {
        graph_id,
        knowledge_point_id,
        x_position: x_position || 0,
        y_position: y_position || 0,
        level: level || "normal",
      });

      cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));

      res.status(201).json(data);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes("已存在")) {
        throw new AppError(
          "Knowledge point already exists in this graph",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.delete(
  "/graph-nodes/:id/soft-delete",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const success = await graphNodeService.softDeleteGraphNode(
      req.supabase!,
      id,
      req.user.id,
    );

    if (!success) {
      throw new AppError(
        "Graph node not found or unauthorized",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    res.json({ success: true });
  },
);

export default router;