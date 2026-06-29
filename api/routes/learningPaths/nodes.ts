// 学习路径节点管理路由：添加、更新状态、重排序、移除

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { learningPathService } from "../../services/study";
import { uuidParamSchema, nodeIdParamSchema } from "./shared";

const router = Router();

// 添加节点到学习路径的 schema
const addNodeSchema = z.object({
  knowledge_point_id: z.string().uuid().optional(),
  order_index: z.number().int().min(0),
  title: z.string().min(1, "节点标题不能为空"),
  description: z.string().optional(),
  estimated_time: z.number().min(1).optional(),
  is_milestone: z.boolean().optional(),
  prerequisites: z.array(z.string()).optional(),
});

// 更新节点状态的 schema
const updateNodeStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
  notes: z.string().max(1000).optional(),
  time_spent: z.number().min(0).optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
});

// 重排序节点的 schema
const reorderNodesSchema = z.object({
  nodeOrders: z
    .array(
      z.object({
        id: z.string().uuid(),
        order_index: z.number().int().min(0),
      }),
    )
    .min(1, "至少需要一个节点"),
});

// 添加节点到学习路径
router.post(
  "/:id/nodes",
  requireAuth,
  validate({ params: uuidParamSchema, body: addNodeSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await learningPathService.addNodeToPath(
      req.supabase,
      id,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

// 更新节点状态
router.put(
  "/:id/nodes/:nodeId/status",
  requireAuth,
  validate({ params: nodeIdParamSchema, body: updateNodeStatusSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, nodeId } = req.params;
    const data = await learningPathService.updateNodeStatus(
      req.supabase,
      id,
      nodeId,
      req.user.id,
      req.body,
    );
    res.json(data);
  },
);

// 重排序学习路径节点
router.put(
  "/:id/nodes/reorder",
  requireAuth,
  validate({ params: uuidParamSchema, body: reorderNodesSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { nodeOrders } = req.body;

    await learningPathService.reorderNodes(
      req.supabase,
      id,
      req.user.id,
      nodeOrders,
    );

    res.json({ message: "节点顺序已更新" });
  },
);

// 从学习路径移除节点
router.delete(
  "/:id/nodes/:nodeId",
  requireAuth,
  validate({ params: nodeIdParamSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, nodeId } = req.params;

    await learningPathService.removeNodeFromPath(
      req.supabase,
      id,
      nodeId,
      req.user.id,
    );

    res.json({ message: "节点已移除" });
  },
);

export default router;
