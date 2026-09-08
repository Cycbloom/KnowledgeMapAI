import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import {
  generateContentSchema,
  generateLearningMaterialSchema,
  assistLearningSchemaSchema,
} from "../../../schemas/index";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { AppError } from "../../../middleware/errorHandler";
import { asyncTaskService } from "../../../services/asyncTaskService";
import { graphNodeService } from "../../../services/graph";
import {
  aiService,
  getMockResponse,
  getAIProviderForTask,
  getAIProvider,
  promptService,
  performanceMonitor,
  enrichMetadata,
  pricingService,
  annotationService,
} from "../../../services/ai";
import { logger } from "../../../utils/logger";
import {
  setSSEHeaders,
  sendStreamChunk,
  sendStreamDone,
  sendStreamError,
} from "../utils";

const router = Router();

router.post(
  "/generate-content",
  requireAuth,
  validate(generateContentSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      topic,
      context,
      provider: providerType,
      model,
      graph_id,
      level,
      language,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return res.json({ content: getMockResponse("content", topic) as string });
    }

    const templateContext = annotationService.buildTemplateContext(topic, context, level);

    const systemPrompt = await promptService.getRenderedPrompt(
      req.supabase,
      "generate_content",
      templateContext,
      req.user.id,
      graph_id,
      language,
    );

    const enrichedMetadata = await enrichMetadata(req.supabase, {
      graphId: graph_id,
      userId: req.user.id,
      topic,
      nodeLevel: level,
    });

    const startTime = Date.now();
    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Topic: ${topic}\nContext: ${context || "General knowledge"}`,
        },
      ],
      model: model || provider.model,
    });
    const duration = Date.now() - startTime;

    const usage = completion.usage;
    if (usage) {
      const cost = pricingService.calculateCost(
        provider.providerType,
        model || provider.model,
        usage.prompt_tokens,
        usage.completion_tokens,
        0
      );
      await performanceMonitor.recordLog({
        operation: 'generate_content',
        provider: provider.providerType,
        model: model || provider.model,
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.prompt_tokens + usage.completion_tokens,
        cachedInputTokens: 0,
        duration,
        success: true,
        estimatedCost: cost,
        metadata: enrichedMetadata,
      });
    }

    res.json({ content: completion.choices[0].message.content });
  },
);

router.post(
  "/learning-material",
  requireAuth,
  validate(generateLearningMaterialSchema),
  async (req: AuthedRequest, res: Response) => {
    const { topic, context, level, provider, model, graph_id, language, schema_id } =
      req.body;

    const result = await aiService.generateLearningMaterial(topic, context, {
      provider,
      model,
      level,
      userId: req.user.id,
      graphId: graph_id,
      language,
      schema_id,
    });
    res.json({ content: result.content, keywords: result.keywords });
  },
);

// 异步生成学习资料：入队后台任务并返回 taskId，供前端轮询进度（替代同步等待）。
const generateLearningMaterialTaskSchema = z.object({
  knowledge_point_id: z.string().uuid(),
  language: z.string().min(2).max(10).optional(),
  graph_id: z.string().uuid().optional(),
  schema_id: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

router.post(
  "/learning-material/task",
  requireAuth,
  validate(generateLearningMaterialTaskSchema),
  async (req: AuthedRequest, res: Response) => {
    const { knowledge_point_id, language, graph_id, schema_id, force } = req.body;

    // 非强制时去重：该知识点已有在途生成任务则复用，避免重复消耗 AI 额度
    if (!force) {
      const { data: existing } = await req.supabase
        .from("system_tasks")
        .select("id")
        .eq("user_id", req.user.id)
        .eq("title", "generate_learning_material")
        .contains("input_data", { knowledge_point_id })
        .in("status", ["pending", "in_progress", "running", "paused"])
        .order("created_at", { ascending: true })
        .limit(1);

      if (existing && existing.length > 0) {
        res.json({ taskId: existing[0].id, reused: true });
        return;
      }
    }

    const task = await asyncTaskService.createTask(
      req.user.id,
      "generate_learning_material",
      {
        knowledge_point_id,
        language: (language as string) || "zh-CN",
        graph_id,
        schema_id,
        force: force ?? false,
      },
      // title 必须等于 processor 类型 key：asyncTaskService 恢复（retry/resume/重启）
      // 依赖 getOriginalTaskType 用 title 反查 processor，展示标签由前端 getTypeLabel 本地化
      "generate_learning_material",
    );

    res.json({ taskId: task.id, reused: false });
  },
);

// 批量异步生成学习资料：按节点拆分为 N 个 generate_learning_material 后台任务，
// 复用单节点处理器（其内部含"已生成则跳过"的幂等逻辑），返回 taskIds 供前端轮询。
const generateLearningMaterialBatchSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1).max(100),
  language: z.string().min(2).max(10).optional(),
  graph_id: z.string().uuid().optional(),
  schema_id: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

router.post(
  "/learning-material/batch",
  requireAuth,
  validate(generateLearningMaterialBatchSchema),
  async (req: AuthedRequest, res: Response) => {
    const { node_ids, language, graph_id, schema_id, force } = req.body;

    const taskIds: string[] = [];
    const graphNodes = await graphNodeService.getGraphNodesByKnowledgePoints(
      req.supabase,
      node_ids,
    );

    if (graphNodes && graphNodes.length > 0) {
      for (const gn of graphNodes) {
        const task = await asyncTaskService.createTask(
          req.user.id,
          "generate_learning_material",
          {
            knowledge_point_id: gn.knowledge_point_id,
            language: (language as string) || "zh-CN",
            graph_id: gn.graph_id || graph_id,
            schema_id,
            force: force ?? false,
          },
          // title 必须等于 processor 类型 key：恢复（retry/resume/重启）时反查处理器
          "generate_learning_material",
        );
        taskIds.push(task.id);
      }
    }

    res.json({
      success: true,
      taskIds,
      message: `${taskIds.length} tasks started`,
    });
  },
);

// AI 辅助设计/优化学习材料章节结构
router.post(
  "/learning-material-schema/assist",
  requireAuth,
  validate(assistLearningSchemaSchema),
  async (req: AuthedRequest, res: Response) => {
    const { mode, topic, goal, existing_sections, provider, model, language, graph_id } =
      req.body;

    try {
      const result = await aiService.assistLearningSchema(mode, topic, {
        goal,
        existingSections: existing_sections,
        language,
        userId: req.user.id,
        graphId: graph_id,
        provider,
        model,
      });
      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("AI Assist Learning Schema Error:", error);
      throw new AppError(err.message || "AI 辅助章节结构失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/generate-content-stream",
  requireAuth,
  validate(generateContentSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      topic,
      context,
      level,
      provider: providerType,
      model,
      graph_id,
      language,
    } = req.body;
    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    setSSEHeaders(res);

    if (!provider.hasKey) {
      const mockContent = getMockResponse("content", topic) as string;
      const chunks = mockContent.split("");

      const sendMockChunks = async () => {
        for (const chunk of chunks) {
          sendStreamChunk(res, chunk);
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        sendStreamDone(res);
      };

      sendMockChunks();
      return;
    }

    try {
      const templateContext = annotationService.buildTemplateContext(topic, context, level);

      const systemPrompt = await promptService.getRenderedPrompt(
        req.supabase,
        "generate_content",
        templateContext,
        req.user.id,
        graph_id,
        language,
      );

      const enrichedMetadata = await enrichMetadata(req.supabase, {
        graphId: graph_id,
        userId: req.user.id,
        topic,
        nodeLevel: level,
      });

      const startTime = Date.now();
      const stream = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Topic: ${topic}\nContext: ${context || "General knowledge"}`,
          },
        ],
        model: model || provider.model,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          sendStreamChunk(res, content);
        }
      }
      const duration = Date.now() - startTime;

      await performanceMonitor.recordLog({
        operation: 'generate_content_stream',
        provider: provider.providerType,
        model: model || provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        duration,
        success: true,
        estimatedCost: 0,
        metadata: enrichedMetadata,
      });

      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Stream Error:", error);
      sendStreamError(
        res,
        err.message || "AI 生成失败",
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;
