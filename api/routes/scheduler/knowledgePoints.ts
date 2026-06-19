import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { taskKnowledgePointService } from "../../services/scheduler";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const createTaskKPBodySchema = z.object({
  knowledge_point_id: z.string().uuid("无效的知识点ID"),
  relevance_score: z.number().int().min(0).max(100).optional(),
  is_primary: z.boolean().optional(),
  notes: z.string().optional(),
});

const createTaskKPParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const updateTaskKPBodySchema = z.object({
  relevance_score: z.number().int().min(0).max(100).optional(),
  is_primary: z.boolean().optional(),
  notes: z.string().optional(),
});

const updateTaskKPParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  kpId: z.string().uuid("无效的知识点关联ID"),
});

const taskKPParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  kpId: z.string().uuid("无效的知识点关联ID"),
});

router.post(
  "/tasks/:id/knowledge-points",
  requireAuth,
  validate({ body: createTaskKPBodySchema, params: createTaskKPParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { knowledge_point_id, relevance_score, is_primary, notes } = req.body;

    const data = await taskKnowledgePointService.create(
      req.supabase!,
      req.user.id,
      id,
      { knowledge_point_id, relevance_score, is_primary, notes },
    );

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/tasks/:id/knowledge-points",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const data = await taskKnowledgePointService.list(
      req.supabase!,
      req.user.id,
      id,
    );

    res.json({ success: true, data });
  },
);

router.put(
  "/tasks/:id/knowledge-points/:kpId",
  requireAuth,
  validate({ body: updateTaskKPBodySchema, params: updateTaskKPParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, kpId } = req.params;
    const updates = req.body;

    const data = await taskKnowledgePointService.update(
      req.supabase!,
      req.user.id,
      id,
      kpId,
      updates,
    );

    res.json({ success: true, data });
  },
);

router.delete(
  "/tasks/:id/knowledge-points/:kpId",
  requireAuth,
  validate({ params: taskKPParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const { id, kpId } = req.params;

    await taskKnowledgePointService.delete(req.supabase!, req.user.id, id, kpId);

    res.json({ success: true });
  },
);

export default router;
