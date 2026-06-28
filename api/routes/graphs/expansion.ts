import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthedRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { uuidParamsSchema } from "../../schemas/index";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { relationDiscoveryService } from "../../services/graph";
import { z } from "zod";
import { domainExpansionService } from "../../services/graph";
import { graphExpansionService } from "../../services/graph";

const expandDomainSchema = z
  .object({
    graph_ids: z.array(z.string().uuid()).optional(),
    domain: z.string().uuid().max(100).optional(),
    count: z.number().int().min(1).max(30).default(10),
  })
  .refine(
    (data) => (data.graph_ids && data.graph_ids.length > 0) || data.domain,
    {
      message: "必须提供 graph_ids 或 domain 中的至少一个",
    },
  );

const batchCreateDomainGraphsSchema = z.object({
  graphs: z
    .array(
      z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(30),
  domain: z.string().max(255).optional(),
  domain_id: z.string().uuid().optional(),
  relations: z
    .array(
      z.object({
        from_title: z.string(),
        to_title: z.string(),
        type: z.enum(["prerequisite", "extension", "related"]),
        reason: z.string().optional(),
      }),
    )
    .optional(),
});

const initializeGraphSchema = z.object({
  style: z.enum(["academic", "practical", "beginner"]).default("academic"),
});

const batchInitializeSchema = z.object({
  graph_ids: z.array(z.string().uuid()).min(1).max(50),
  style: z.enum(["academic", "practical", "beginner"]).default("academic"),
});

const discoverRelationsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  max_suggestions: z.number().min(1).max(50).default(20),
  include_cross_domain: z.boolean().default(true),
});

const createRelationFromDiscoverySchema = z.object({
  source_graph_id: z.string().uuid(),
  target_graph_id: z.string().uuid(),
  relation_type: z.enum([
    "prerequisite",
    "extension",
    "related",
    "cross_domain",
  ]),
  context: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1).optional(),
  shared_concepts: z.array(z.string()).optional(),
});

const crossDomainInsightsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  min_intersection: z.number().min(1).max(10).default(2),
});

const learningPathSuggestionsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

const knowledgeGapsSchema = z.object({
  graph_ids: z.array(z.string().uuid()).optional(),
  min_importance: z.enum(["high", "medium", "low"]).optional(),
});

const validateBackboneSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200),
        properties: z
          .object({
            backboneModule: z
              .enum([
                "research_background",
                "literature_review",
                "research_methods",
                "core_concepts",
                "application_domains",
                "future_directions",
              ])
              .optional(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(100),
  context: z.string().max(1000).optional(),
  useAI: z.boolean().optional(),
});

const router = Router();

// Expand from existing graphs (Auth Required)
router.post(
  "/domain/expand",
  requireAuth,
  validate({ body: expandDomainSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids, domain, count = 10 } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase;

    try {
      const result = await domainExpansionService.expandDomain(supabase, userId, {
        graph_ids,
        domain,
        count,
      });

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "领域扩展失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

// Batch create domain graphs (Auth Required)
router.post(
  "/domain/batch-create",
  requireAuth,
  validate({ body: batchCreateDomainGraphsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graphs, domain, domain_id, relations } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase;

    try {
      const result = await domainExpansionService.batchCreateDomainGraphs(supabase, userId, {
        graphs,
        domain,
        domain_id,
        relations,
      });

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "批量创建图谱失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/batch-initialize",
  requireAuth,
  validate({ body: batchInitializeSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids, style = "academic", session_id } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase;

    try {
      const result = await graphExpansionService.batchInitialize(
        supabase,
        userId,
        graph_ids,
        style,
        session_id,
      );

      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "批量初始化失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:id/initialize",
  requireAuth,
  validate({ params: uuidParamsSchema, body: initializeGraphSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { style = "academic" } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase;

    try {
      const result = await graphExpansionService.initializeGraph(
        supabase,
        userId,
        id,
        style,
      );

      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "初始化图谱失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/discover-relations",
  requireAuth,
  validate({ body: discoverRelationsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids, max_suggestions, include_cross_domain } = req.body;
    const userId = req.user.id;

    try {
      const result = await relationDiscoveryService.discoverRelations(
        req.supabase,
        userId,
        {
          graph_ids,
          max_suggestions,
          include_cross_domain,
        },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "图谱关系发现失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/create-discovered-relation",
  requireAuth,
  validate({ body: createRelationFromDiscoverySchema }),
  async (req: AuthedRequest, res: Response) => {
    const {
      source_graph_id,
      target_graph_id,
      relation_type,
      context,
      confidence,
      shared_concepts,
    } = req.body;
    const userId = req.user.id;

    try {
      const result = await relationDiscoveryService.createRelationFromDiscovery(
        req.supabase,
        userId,
        {
          source_graph_id,
          target_graph_id,
          relation_type,
          context,
          confidence,
          shared_concepts,
        },
      );

      res.json({
        success: true,
        relation_id: result.id,
        message: "关系创建成功",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "创建关系失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/cross-domain-insights",
  requireAuth,
  validate({ body: crossDomainInsightsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids, min_intersection = 2 } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Cross-domain insights request", {
        userId,
        graph_ids,
        min_intersection,
      });

      const result = await relationDiscoveryService.analyzeCrossDomainInsights(
        req.supabase,
        userId,
        {
          graph_ids,
          min_intersection,
        },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "跨学科洞察分析失败";
      logger.error("Cross-domain insights failed", error);
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/learning-path-suggestions",
  requireAuth,
  validate({ body: learningPathSuggestionsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids, difficulty } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Learning path suggestions request", {
        userId,
        graph_ids,
        difficulty,
      });

      const result =
        await relationDiscoveryService.generateLearningPathSuggestions(
          req.supabase,
          userId,
          {
            graph_ids,
            difficulty,
          },
        );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "学习路径建议生成失败";
      logger.error("Learning path suggestions failed", error);
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/knowledge-gaps",
  requireAuth,
  validate({ body: knowledgeGapsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graph_ids, min_importance } = req.body;
    const userId = req.user.id;

    try {
      logger.info("Knowledge gaps analysis request", {
        userId,
        graph_ids,
        min_importance,
      });

      const result = await relationDiscoveryService.analyzeKnowledgeGaps(
        req.supabase,
        userId,
        {
          graph_ids,
          min_importance,
        },
      );

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "知识缺口分析失败";
      logger.error("Knowledge gaps analysis failed", error);
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:graphId/nodes/validate-backbone",
  requireAuth,
  validate({ params: uuidParamsSchema, body: validateBackboneSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const { nodes, context, useAI } = req.body;
    const userId = req.user.id;
    const supabase = req.supabase;

    try {
      const result = await graphExpansionService.validateBackbone(
        supabase,
        userId,
        graphId,
        nodes,
        context,
        useAI,
      );

      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message =
        error instanceof Error ? error.message : "骨干节点验证失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:graphId/fix-backbone-modules",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { graphId } = req.params;
    const userId = req.user.id;
    const supabase = req.supabase;

    try {
      const result = await graphExpansionService.fixBackboneModules(
        supabase,
        userId,
        graphId,
      );

      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message =
        error instanceof Error ? error.message : "修复骨干模块失败";
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id/analysis",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const supabase = req.supabase;

    if (!supabase) {
      throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    try {
      const { networkAnalysisService } =
        await import("../../services/graph");

      const analysis = await networkAnalysisService.analyzeGraph(supabase, id);

      res.json({
        graphId: id,
        analysis,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Network Analysis Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "网络分析失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.get(
  "/:id/backbone-suggestions",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const supabase = req.supabase;

    if (!supabase) {
      throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    try {
      const { conceptAggregationService: conceptAggService } =
        await import("../../services/graph");

      const [newModuleNeeds, moduleOverlaps] = await Promise.all([
        conceptAggService.detectNewModuleNeeds(supabase, id),
        conceptAggService.detectModuleOverlap(supabase, id),
      ]);

      res.json({
        graphId: id,
        newModuleNeeds,
        moduleOverlaps: moduleOverlaps.overlaps,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Backbone Suggestions Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "骨干模块建议分析失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;