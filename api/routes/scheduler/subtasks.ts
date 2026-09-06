import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { subtaskService } from "../../services/scheduler";

const router = Router();

const createSubtaskBodySchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string().optional(),
  knowledge_point_id: z.string().uuid("无效的知识点ID"),
  priority: z.number().int().min(0).optional(),
  estimated_duration: z.number().int().min(0).optional(),
  due_date: z.string().datetime().optional(),
});

const createSubtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const updateSubtaskBodySchema = z.object({
  title: z.string().min(1, "标题不能为空").optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  priority: z.number().int().min(0).optional(),
  estimated_duration: z.number().int().min(0).optional(),
  actual_duration: z.number().int().min(0).optional(),
  due_date: z.string().datetime().optional().nullable(),
  learning_state: z
    .enum(["learning", "review", "practice", "quiz"])
    .optional(),
  /** @mastery display - 写穿端点：用户/UI 覆盖 mastery_level（仅用于 UI 徽章显示，算法权威源为 knowledge_points） */
  mastery_level: z.number().min(0).max(1).optional(),
});

const updateSubtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  subtaskId: z.string().uuid("无效的子任务ID"),
});

const transitionSubtaskBodySchema = z.object({
  to_state: z.enum(["learning", "review", "practice", "quiz"]),
  /** @schedule decision - FSRS 过渡：算法计算出的 mastery_level（与状态机联动写回） */
  mastery_level: z.number().min(0).max(1),
  reason: z.string().optional(),
});

const transitionSubtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  subtaskId: z.string().uuid("无效的子任务ID"),
});

const subtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  subtaskId: z.string().uuid("无效的子任务ID"),
});

const refreshSubtasksBodySchema = z.object({
  /** sync=自动补齐缺失子任务并按路径重排；reset=在 sync 基础上额外将全部子任务状态重置为待完成 */
  mode: z.enum(["sync", "reset"]).optional().default("sync"),
  /** 目标学习路径；不传=不按路径（展示全部知识点子任务） */
  path_id: z.string().uuid("无效的学习路径ID").optional().nullable(),
});

router.post(
  "/tasks/:id/subtasks",
  requireAuth,
  validate({ body: createSubtaskBodySchema, params: createSubtaskParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const {
      title,
      description,
      knowledge_point_id,
      priority,
      estimated_duration,
      due_date,
    } = req.body;

    const data = await subtaskService.create(req.supabase, req.user.id, id, {
      title,
      description,
      knowledge_point_id,
      priority,
      estimated_duration,
      due_date,
    });

    res.status(201).json({ success: true, data });
  },
);

router.get(
  "/tasks/:id/subtasks",
  requireAuth,
  validate({ params: z.object({ id: z.string().uuid("无效的任务ID") }) }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    const data = await subtaskService.list(req.supabase, req.user.id, id);

    res.json({ success: true, data });
  },
);

// 刷新/重建子任务：自动补齐缺失子任务 + 按学习路径重排 +（可选）重置完成状态
router.post(
  "/tasks/:id/subtasks/refresh",
  requireAuth,
  validate({
    params: z.object({ id: z.string().uuid("无效的任务ID") }),
    body: refreshSubtasksBodySchema,
  }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { mode, path_id } = req.body;

    const data = await subtaskService.refreshSubtasksForTask(
      req.supabase,
      req.user.id,
      id,
      { mode, pathId: path_id ?? undefined },
    );

    res.json({ success: true, data });
  },
);

router.put(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate({ body: updateSubtaskBodySchema, params: updateSubtaskParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, subtaskId } = req.params;
    const updates = req.body;

    const data = await subtaskService.update(
      req.supabase,
      req.user.id,
      id,
      subtaskId,
      updates,
    );

    res.json({ success: true, data });
  },
);

router.delete(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate({ params: subtaskParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, subtaskId } = req.params;

    await subtaskService.delete(req.supabase, req.user.id, id, subtaskId);

    res.json({ success: true });
  },
);

router.post(
  "/tasks/:id/subtasks/:subtaskId/transition",
  requireAuth,
  validate({ body: transitionSubtaskBodySchema, params: transitionSubtaskParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, subtaskId } = req.params;
    const { to_state, mastery_level, reason } = req.body;

    const data = await subtaskService.transition(
      req.supabase,
      req.user.id,
      id,
      subtaskId,
      to_state,
      mastery_level,
      reason,
    );

    res.json({ success: true, data });
  },
);

router.patch(
  "/tasks/:id/subtasks/:subtaskId/mastery",
  requireAuth,
  validate({
    params: subtaskParamsSchema,
    body: z.object({
      /** @mastery display - 单独 mastery 写穿端点：仅用于 UI 展示徽章/进度条，不参与 FSRS 调度计算 */
      mastery_level: z.number().min(0).max(1),
    }),
  }),
  async (req: AuthedRequest, res: Response) => {
    const { id, subtaskId } = req.params;
    const { mastery_level } = req.body;

    const data = await subtaskService.updateMastery(
      req.supabase,
      req.user.id,
      id,
      subtaskId,
      mastery_level,
    );

    res.json({ success: true, data });
  },
);

router.get(
  "/tasks/:id/subtasks/:subtaskId/valid-transitions",
  requireAuth,
  validate({ params: subtaskParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id, subtaskId } = req.params;

    const data = await subtaskService.getValidTransitions(
      req.supabase,
      req.user.id,
      id,
      subtaskId,
    );

    res.json({ success: true, data });
  },
);

export default router;
