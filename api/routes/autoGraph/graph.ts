import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { templateGeneratorService } from "../../services/ai";
import { cacheService, CacheKeys } from "../../services/common";
import { logger } from "../../utils/logger";
import { autoGraphService, graphNodeService } from "../../services/graph";
import { appEventBus } from "../../services/core";
import type { NodeCreatedPayload } from "../../../shared/types/events";
import type { TemplateNode } from "@shared/types/graph";
import { z } from "zod";
import { saveNodesSchema } from "../../schemas/index";

interface AIGeneratedTemplateNode extends TemplateNode {
  backboneModule?: string;
  needsRefinement?: boolean;
  suggestedContent?: string;
}

const router = Router();

const initGraphSchema = z.object({
  topic: z.string().min(2).max(200),
  style: z
    .enum(["academic", "practical", "beginner", "custom"])
    .default("academic"),
  customPrompt: z.string().optional(),
  sources: z.array(z.string()).optional(),
  graph_id: z.string().uuid().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  session_id: z.string().uuid().optional(),
  template_type: z.string().optional(),
  storyConfig: z
    .object({
      genre: z.string().optional(),
      coreConflict: z.string().optional(),
      characterHints: z.string().optional(),
    })
    .optional(),
});

const expandNodeSchema = z.object({
  node_id: z.string().min(1),
  node_title: z.string().min(1),
  node_content: z.string().optional(),
  node_level: z.string().optional(),
  graph_id: z.string().uuid().optional(),
  style: z
    .enum(["academic", "practical", "beginner", "custom"])
    .default("academic"),
  customPrompt: z.string().optional(),
  existing_children: z
    .array(
      z.object({
        title: z.string(),
        content: z.string().optional(),
      }),
    )
    .optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

router.post(
  "/init",
  requireAuth,
  validate(initGraphSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      topic,
      style,
      customPrompt,
      sources,
      graph_id,
      provider: providerType,
      model,
      language,
      session_id,
      template_type,
      storyConfig,
    } = req.body;
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    const sessionId = session_id || crypto.randomUUID();

    if (template_type === "topic_research") {
      try {
        const result = await templateGeneratorService.generateTemplates({
          topic,
          templateType: "topic_research",
          provider: providerType as AIProviderType,
          model,
        });

        const template = result.templates[0];
        if (!template) {
          throw new AppError("生成模板失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }

        const rootNode = template.nodes.find((n) => n.level === "root");
        const coreNodes = template.nodes.filter((n) => n.level === "core");

        const rootContent =
          rootNode?.description ||
          rootNode?.suggestedContent ||
          `${topic}：本专题研究的核心主题，涵盖研究背景、文献综述、研究方法、核心概念、应用领域和未来方向六大模块`;

        res.json({
          sessionId,
          root: {
            title: rootNode?.title || topic,
            content: rootContent,
          },
          coreNodes: coreNodes.map((n) => {
            const aiNode = n as AIGeneratedTemplateNode;
            return {
              title: n.title,
              content:
                n.description ||
                n.suggestedContent ||
                `${n.title}：${aiNode.backboneModule ? `${n.title}模块的核心内容` : "该节点的详细内容"}`,
              level: n.level || "core",
              backboneModule: aiNode.backboneModule,
              needsRefinement: aiNode.needsRefinement,
              color: aiNode.color,
            };
          }),
        });
        return;
      } catch (error) {
        const err = error as Error;
        logger.error("Topic Research Template Error:", error);
        throw new AppError(
          err.message || "专题研究模板生成失败",
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
    }

    // Story creation branch
    if (template_type === "story_creation") {
      try {
        const result =
          await templateGeneratorService.generateStoryCreationStructure(
            topic,
            storyConfig as
              | {
                  genre?: string;
                  coreConflict?: string;
                  characterHints?: string;
                }
              | undefined,
            req.user.id,
            graph_id,
          );

        res.json({
          sessionId,
          root: result.root,
          coreNodes: result.coreNodes,
        });
        return;
      } catch (error) {
        const err = error as Error;
        logger.error("Story Creation Template Error:", error);
        throw new AppError(
          err.message || "故事创作模板生成失败",
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }
    }

    try {
      const result = await autoGraphService.initGraph(supabase, {
        topic,
        style,
        customPrompt,
        sources,
        graphId: graph_id,
        providerType,
        model,
        language,
        sessionId,
        userId: req.user.id,
      });

      res.json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Auto Graph Init Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "知识图谱初始化失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/expand",
  requireAuth,
  validate(expandNodeSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      node_id,
      node_title,
      node_content,
      node_level,
      graph_id,
      style,
      customPrompt,
      existing_children,
      provider: providerType,
      model,
      language,
      session_id,
    } = req.body;
    const supabase = req.supabase;

    try {
      const result = await autoGraphService.expandNode(supabase, {
        nodeId: node_id,
        nodeTitle: node_title,
        nodeContent: node_content,
        nodeLevel: node_level,
        graphId: graph_id,
        style,
        customPrompt,
        existingChildren: existing_children,
        providerType,
        model,
        language,
        sessionId: session_id,
        userId: req.user.id,
      });

      res.json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Auto Graph Expand Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "节点展开失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/save-nodes",
  requireAuth,
  validate(saveNodesSchema),
  async (req: AuthedRequest, res: Response) => {
    const { graph_id, nodes } = req.body;

    try {
      const existingGraphNodes = await graphNodeService.getGraphNodes(
        req.supabase,
        graph_id,
      );

      const existingCount = existingGraphNodes?.length || 0;

      const nodesWithTempId = autoGraphService.calculateNodePositions(
        nodes,
        existingCount,
      );

      if (nodesWithTempId.length === 0) {
        return res.json({ success: true, nodeCount: 0, edgeCount: 0 });
      }

      const result = await autoGraphService.processAINodes(
        req.supabase,
        req.user.id,
        graph_id,
        nodesWithTempId,
      );

      await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
      await cacheService.del(CacheKeys.GRAPH_NODES("public", graph_id));

      appEventBus.publish<NodeCreatedPayload>(
          "node_created",
          { nodeId: "", graphId: graph_id, userId: req.user.id, title: "" },
          req.user.id,
          "auto_graph_route",
        );

      const nodeMapping: Record<
        string,
        { graphNodeId: string; knowledgePointId: string }
      > = result.nodeMapping;

      res.json({
        success: true,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
        nodeMapping,
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Save nodes error:", error);
      throw new AppError(
        err.message || "保存节点失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;
