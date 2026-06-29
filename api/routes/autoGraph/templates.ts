import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { templateGeneratorService } from "../../services/ai";
import { logger } from "../../utils/logger";
import { autoGraphService } from "../../services/graph";
import type {
  TemplateCategory,
  TemplateType,
  LayoutSuggestion,
} from "@shared/types/graph";
import { z } from "zod";

const router = Router();

const generateTemplatesSchema = z.object({
  topic: z.string().min(2).max(200),
  context: z.string().max(1000).optional(),
  category: z
    .enum(["knowledge", "project", "analysis", "architecture"])
    .optional(),
  template_type: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  graph_id: z.string().uuid().optional(),
  maxNodes: z.number().min(5).max(50).optional(),
  preferredLayout: z
    .enum(["radial", "tree", "network", "hierarchical"])
    .optional(),
});

const applyTemplateSchema = z.object({
  template: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      nodes: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          level: z.enum(["root", "core", "sub", "normal", "leaf"]),
          parentId: z.string().optional(),
          suggestedContent: z.string().optional(),
          color: z.string().optional(),
        }),
      ),
      edges: z.array(
        z.object({
          source: z.string().min(1),
          target: z.string().min(1),
          relationship_type: z.string().optional(),
          description: z.string().optional(),
        }),
      ),
      layoutSuggestion: z.enum(["radial", "tree", "network", "hierarchical"]),
      estimatedNodes: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.array(z.string()).optional(),
      reasoning: z.string().optional(),
    })
    .optional(),
  templateId: z.string().optional(),
  topic: z.string().min(2).max(200),
  style: z
    .enum(["academic", "practical", "beginner", "custom"])
    .default("academic"),
  customPrompt: z.string().optional(),
  graph_id: z.string().uuid(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

router.post(
  "/generate-templates",
  requireAuth,
  validate(generateTemplatesSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      topic,
      context,
      category,
      template_type,
      provider: providerType,
      model,
      graph_id,
      maxNodes,
      preferredLayout,
    } = req.body;

    try {
      logger.info("Generating templates", {
        topic,
        category,
        userId: req.user.id,
        graphId: graph_id,
      });

      const result = await templateGeneratorService.generateTemplates({
        topic,
        context,
        category: category as TemplateCategory | undefined,
        templateType: template_type as TemplateType | undefined,
        provider: providerType as AIProviderType | undefined,
        model,
        userId: req.user.id,
        graphId: graph_id,
        maxNodes,
        preferredLayout: preferredLayout as LayoutSuggestion | undefined,
      });

      logger.info("Templates generated successfully", {
        topic,
        templateCount: result.templates.length,
        provider: result.metadata.provider,
        model: result.metadata.model,
      });

      res.json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Generate templates error:", {
        topic,
        error: err.message,
        stack: err.stack,
      });

      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "模板生成失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/apply-template",
  requireAuth,
  validate(applyTemplateSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      template,
      templateId,
      topic,
      style,
      customPrompt,
      graph_id,
      provider: providerType,
      model,
    } = req.body;

    const supabase = req.supabase;

    try {
      logger.info("Applying template", {
        topic,
        templateId: template?.id || templateId,
        style,
        userId: req.user.id,
        graphId: graph_id,
      });

      const result = await autoGraphService.applyTemplate(supabase, {
        template,
        templateId,
        topic,
        style,
        customPrompt,
        graphId: graph_id,
        providerType,
        model,
        userId: req.user.id,
      });

      res.json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Apply template error:", {
        topic,
        error: err.message,
        stack: err.stack,
      });

      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "模板应用失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;
