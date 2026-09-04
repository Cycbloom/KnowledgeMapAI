// 目标驱动跨图谱学习路径：AI 对话澄清学习目标 → 生成候选路径 → 保存选中项

import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { goalDrivenPathService } from "../../services/study/goalDrivenPathService";
import { setSSEHeaders } from "../ai/utils";

const router = Router();

// AI 对话澄清学习目标（SSE 流式）
const dialogSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  session_id: z.string().optional(),
  selected_graph_ids: z.array(z.string().uuid()).max(100).optional(),
  selected_domain_ids: z.array(z.string().uuid()).max(100).optional(),
});

// 生成学习目标建议
const suggestGoalsSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  selected_graph_ids: z.array(z.string().uuid()).max(100).optional(),
  selected_domain_ids: z.array(z.string().uuid()).max(100).optional(),
});

// 生成候选跨图谱学习路径
const generateVariantsSchema = z.object({
  target_goal: z.string().min(5).max(2000),
  conversation_transcript: z.string().max(4000).optional(),
  daily_time_minutes: z.number().min(5).max(240).optional(),
  variant_count: z.number().int().min(2).max(3).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  selected_graph_ids: z.array(z.string().uuid()).max(100).optional(),
  selected_domain_ids: z.array(z.string().uuid()).max(100).optional(),
});

// 保存用户选中的候选路径
const saveVariantSchema = z.object({
  variant: z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    emphasis: z
      .enum(["goal_oriented", "systematic", "quick_overview"])
      .optional(),
    stages: z
      .array(
        z.object({
          graph_id: z.string().uuid(),
          graph_title: z.string().min(1),
          order: z.number().int().min(0),
          priority: z.enum(["high", "medium", "low"]),
          reason: z.string().max(200).optional(),
          estimated_time: z.number().int().min(5).max(240).default(30),
        }),
      )
      .min(1),
  }),
  target_goal: z.string().max(2000).optional(),
  daily_time_minutes: z.number().min(5).max(240).optional(),
});

// AI 对话澄清学习目标（SSE 流式）
router.post(
  "/cross-graph/goal/dialog",
  requireAuth,
  validate({ body: dialogSchema }),
  async (req: AuthedRequest, res: Response) => {
    const {
      message,
      history,
      provider,
      model,
      language,
      session_id,
      selected_graph_ids,
      selected_domain_ids,
    } = req.body;
    const sessionId = session_id || crypto.randomUUID();
    setSSEHeaders(res);
    res.setHeader("X-Session-Id", sessionId);
    await goalDrivenPathService.dialogStream(req, res, {
      message,
      history,
      provider,
      model,
      language,
      sessionId,
      selectedGraphIds: selected_graph_ids,
      selectedDomainIds: selected_domain_ids,
    });
  },
);

// 生成学习目标建议
router.post(
  "/cross-graph/goal/suggest",
  requireAuth,
  validate({ body: suggestGoalsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { provider, model, selected_graph_ids, selected_domain_ids } =
      req.body;
    const result = await goalDrivenPathService.suggestGoals(
      req.supabase,
      req.user.id,
      {
        provider,
        model,
        selectedGraphIds: selected_graph_ids,
        selectedDomainIds: selected_domain_ids,
      },
    );
    res.json({ success: true, data: result });
  },
);

// 生成候选跨图谱学习路径
router.post(
  "/cross-graph/goal/variants",
  requireAuth,
  validate({ body: generateVariantsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const {
      target_goal,
      conversation_transcript,
      daily_time_minutes,
      variant_count,
      provider,
      model,
      selected_graph_ids,
      selected_domain_ids,
    } = req.body;
    const result = await goalDrivenPathService.generateVariants(
      req.supabase,
      req.user.id,
      {
        targetGoal: target_goal,
        conversationTranscript: conversation_transcript,
        dailyMinutes: daily_time_minutes,
        variantCount: variant_count,
        provider,
        model,
        selectedGraphIds: selected_graph_ids,
        selectedDomainIds: selected_domain_ids,
      },
    );
    res.json({ success: true, data: result });
  },
);

// 保存选中的候选路径
router.post(
  "/cross-graph/goal/save",
  requireAuth,
  validate({ body: saveVariantSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { variant, target_goal, daily_time_minutes } = req.body;
    const result = await goalDrivenPathService.saveVariant(
      req.supabase,
      req.user.id,
      {
        variant,
        targetGoal: target_goal,
        dailyMinutes: daily_time_minutes,
      },
    );
    res.json({ success: true, data: result });
  },
);

export default router;
