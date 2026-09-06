// 学习路径 CRUD 路由：列表、创建、获取、更新、删除

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { learningPathService } from "../../services/study";
import { uuidParamSchema } from "./shared";

const router = Router();

// 创建学习路径的 schema
const createPathSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  description: z.string().max(2000).optional(),
  goal: z.string().max(500).optional(),
  target_date: z.string().datetime().optional(),
  source_graph_id: z.string().uuid().optional(),
  total_estimated_time: z.number().min(0).optional(),
  ai_generated: z.boolean().optional(),
  daily_minutes_target: z.number().min(5).max(480).optional(),
  nodes: z
    .array(
      z.object({
        knowledge_point_id: z.string().uuid().optional(),
        order_index: z.number().int().min(0),
        title: z.string().min(1, "节点标题不能为空"),
        description: z.string().optional(),
        estimated_time: z.number().min(1).optional(),
        is_milestone: z.boolean().optional(),
        prerequisites: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

// 更新学习路径的 schema
const updatePathSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200).optional(),
  description: z.string().max(2000).optional(),
  goal: z.string().max(500).optional(),
  target_date: z.string().datetime().optional(),
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
  daily_minutes_target: z.number().min(5).max(480).optional(),
});

// 列表查询参数 schema
const listQuerySchema = z.object({
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
  source_graph_id: z.string().uuid("无效的图谱ID").optional(),
});

// 获取学习路径列表
router.get(
  "/",
  requireAuth,
  validate({ query: listQuerySchema }),
  async (req: AuthedRequest, res: Response) => {
    const { status, source_graph_id } = req.query;
    const data = await learningPathService.getLearningPaths(
      req.supabase,
      req.user.id,
      status as string | undefined,
      source_graph_id as string | undefined,
    );
    res.json(data);
  },
);

// 创建学习路径
router.post(
  "/",
  requireAuth,
  validate({ body: createPathSchema }),
  async (req: AuthedRequest, res: Response) => {
    const data = await learningPathService.createLearningPath(
      req.supabase,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

// 获取单个学习路径
router.get(
  "/:id",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.getLearningPath(
      req.supabase,
      id,
      req.user.id,
    );

    if (!data) {
      throw new AppError("学习路径不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    res.json(data);
  },
);

// 更新学习路径
router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamSchema, body: updatePathSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.updateLearningPath(
      req.supabase,
      id,
      req.user.id,
      req.body,
    );
    res.json(data);
  },
);

// 删除（归档）学习路径
router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const hardDelete = req.query.hard === "true";

    await learningPathService.deleteLearningPath(
      req.supabase,
      id,
      req.user.id,
      hardDelete,
    );

    res.json({
      message: hardDelete ? "学习路径已永久删除" : "学习路径已归档",
    });
  },
);

export default router;
