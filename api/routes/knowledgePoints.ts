import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { aiService } from "../services/ai/aiService";
import {
  knowledgePointService,
  knowledgePointVersionService,
} from "../services/graph/index";
import { authService } from "../services/core/authService";
import {
  conceptAggregationService,
} from "../services/graph/conceptAggregationService";
import { logger } from "../utils/logger";
import { z } from "zod";

const router = Router();

const createKnowledgePointSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    content: z.string().optional(),
    learning_material: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
    visibility: z
      .enum(["private", "public", "pending"])
      .optional()
      .default("private"),
  }),
});

const updateKnowledgePointSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().optional(),
    learning_material: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
    visibility: z.enum(["private", "public", "pending"]).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

const searchSimilarSchema = z.object({
  body: z.object({
    query: z.string().min(1),
    threshold: z.number().min(0).max(1).optional().default(0.8),
    limit: z.number().min(1).max(20).optional().default(5),
  }),
});

const submitPublicSchema = z.object({
  body: z.object({
    knowledge_point_id: z.string().uuid(),
    suggested_changes: z
      .object({
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
        learning_material: z.string().optional(),
      })
      .optional(),
  }),
});

const rejectSuggestionSchema = z.object({
  body: z.object({
    reason: z.string().min(1),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

router.get(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { visibility } = req.query;

    try {
      const data = await knowledgePointService.list(
        req.supabase!,
        req.user.id,
        {
          visibility: visibility as "public" | undefined,
        },
      );
      res.json(data);
    } catch (error) {
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const data = await knowledgePointService.getAccessible(
        req.supabase!,
        id,
        req.user.id,
      );

      if (!data) {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      res.json(data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id/graphs",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const data = await knowledgePointService.getGraphs(
        req.supabase!,
        id,
        req.user.id,
      );
      res.json(data);
    } catch (error) {
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/",
  requireAuth,
  validate(createKnowledgePointSchema),
  async (req: AuthRequest, res: Response) => {
    const { title, content, learning_material, properties, visibility } =
      req.body;

    try {
      const data = await knowledgePointService.create(req.supabase!, {
        title,
        content,
        learning_material,
        properties,
        visibility,
        owner_id: req.user.id,
      });

      res.status(201).json(data);
    } catch (error) {
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  validate(updateKnowledgePointSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    try {
      const isOwner = await knowledgePointService.checkOwnership(
        req.supabase!,
        id,
        req.user.id,
      );

      if (!isOwner) {
        throw new AppError("没有权限执行此操作", 403, ErrorCodes.FORBIDDEN);
      }

      const data = await knowledgePointService.update(
        req.supabase!,
        id,
        updates,
      );
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/search-similar",
  requireAuth,
  validate(searchSimilarSchema),
  async (req: AuthRequest, res: Response) => {
    const { query, threshold, limit } = req.body;

    try {
      const embedding = await aiService.generateEmbedding(query);

      if (!embedding) {
        return res.json([]);
      }

      const data = await knowledgePointService.searchSimilar(
        req.supabase!,
        embedding,
        req.user.id,
        threshold,
        limit,
      );

      res.json(data || []);
    } catch (error) {
      logger.error("Search similar error:", error);
      res.json([]);
    }
  },
);

router.delete(
  "/:id/hard-delete",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const data = await knowledgePointService.delete(
        req.supabase!,
        id,
        req.user.id,
      );
      res.json(data);
    } catch (error) {
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/public",
  async (req: AuthRequest, res: Response) => {
    const { search, limit = 20, offset = 0 } = req.query;

    try {
      const result = await knowledgePointService.listPublic(req.supabase!, {
        search: search as string,
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json(result);
    } catch (error) {
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/submit-public",
  requireAuth,
  validate(submitPublicSchema),
  async (req: AuthRequest, res: Response) => {
    const { knowledge_point_id, suggested_changes } = req.body;

    try {
      const result = await knowledgePointService.submitForPublic(
        req.supabase!,
        { knowledge_point_id, suggested_changes },
        req.user.id,
      );

      res.json(result);
    } catch (error) {
      const err = error as Error;
      if (err.message === "Knowledge point not found") {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      if (err.message === "Permission denied") {
        throw new AppError("没有权限执行此操作", 403, ErrorCodes.FORBIDDEN);
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/admin/knowledge-points/pending",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { limit = 20, offset = 0 } = req.query;

    const userProfile = await authService.getProfile(req.user.id);

    if (!userProfile || userProfile.role !== "admin") {
      throw new AppError("需要管理员权限", 403, ErrorCodes.FORBIDDEN);
    }

    try {
      const result = await knowledgePointService.listPending(req.supabase!, {
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json(result);
    } catch (error) {
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/admin/knowledge-points/suggestions/:id/approve",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const userProfile = await authService.getProfile(req.user.id);

    if (!userProfile || userProfile.role !== "admin") {
      throw new AppError("需要管理员权限", 403, ErrorCodes.FORBIDDEN);
    }

    try {
      const data = await knowledgePointService.approvePublic(
        req.supabase!,
        id,
        req.user.id,
      );

      res.json({
        success: true,
        knowledge_point: data,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Knowledge point not found or not pending") {
        throw new AppError(
          "Knowledge point not found or not pending",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/admin/knowledge-points/suggestions/:id/reject",
  requireAuth,
  validate(rejectSuggestionSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    const userProfile = await authService.getProfile(req.user.id);

    if (!userProfile || userProfile.role !== "admin") {
      throw new AppError("需要管理员权限", 403, ErrorCodes.FORBIDDEN);
    }

    try {
      await knowledgePointService.rejectPublic(
        req.supabase!,
        id,
        req.user.id,
        reason,
      );

      res.json({
        success: true,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Knowledge point not found or not pending") {
        throw new AppError(
          "Knowledge point not found or not pending",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

const listVersionsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0),
  }),
});

const getVersionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    versionNumber: z.coerce.number().int().min(1),
  }),
});

const compareVersionsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    version1: z.coerce.number().int().min(1),
    version2: z.coerce.number().int().min(1),
  }),
});

const rollbackSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    versionNumber: z.coerce.number().int().min(1),
  }),
});

const createManualVersionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    change_summary: z.string().min(1).max(500),
  }),
});

const updateAliasesSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    aliases: z.array(z.string()).max(20),
  }),
});

router.get(
  "/:id/versions",
  requireAuth,
  validate(listVersionsSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { limit, offset } = req.query;

    try {
      const kp = await knowledgePointService.getAccessible(req.supabase!, id, req.user.id);

      if (!kp) {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const result = await knowledgePointVersionService.getVersionHistory(
        req.supabase!,
        id,
        { limit: Number(limit), offset: Number(offset) },
      );

      res.json(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id/versions/:versionNumber",
  requireAuth,
  validate(getVersionSchema),
  async (req: AuthRequest, res: Response) => {
    const { id, versionNumber } = req.params;

    try {
      const kp = await knowledgePointService.getAccessible(req.supabase!, id, req.user.id);

      if (!kp) {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const version = await knowledgePointVersionService.getVersion(
        req.supabase!,
        id,
        Number(versionNumber),
      );

      if (!version) {
        throw new AppError(
          "Version not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      res.json(version);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError((error as Error).message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/:id/versions/compare",
  requireAuth,
  validate(compareVersionsSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { version1, version2 } = req.query;

    try {
      const kp = await knowledgePointService.getAccessible(req.supabase!, id, req.user.id);

      if (!kp) {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const result = await knowledgePointVersionService.compareVersions(
        req.supabase!,
        id,
        Number(version1),
        Number(version2),
      );

      res.json(result);
    } catch (error) {
      const err = error as Error;
      if (error instanceof AppError) throw error;
      if (err.message === "One or both versions not found") {
        throw new AppError(
          "One or both versions not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:id/versions/:versionNumber/rollback",
  requireAuth,
  validate(rollbackSchema),
  async (req: AuthRequest, res: Response) => {
    const { id, versionNumber } = req.params;

    try {
      const isOwner = await knowledgePointService.checkOwnership(
        req.supabase!,
        id,
        req.user.id,
      );

      if (!isOwner) {
        throw new AppError("没有权限执行此操作", 403, ErrorCodes.FORBIDDEN);
      }

      const result = await knowledgePointVersionService.rollback(
        req.supabase!,
        id,
        Number(versionNumber),
        req.user.id,
      );

      res.json({
        success: true,
        knowledge_point: result,
      });
    } catch (error) {
      const err = error as Error;
      if (error instanceof AppError) throw error;
      if (err.message === "Version not found") {
        throw new AppError(
          "Version not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/:id/versions",
  requireAuth,
  validate(createManualVersionSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { change_summary } = req.body;

    try {
      const isOwner = await knowledgePointService.checkOwnership(
        req.supabase!,
        id,
        req.user.id,
      );

      if (!isOwner) {
        throw new AppError("没有权限执行此操作", 403, ErrorCodes.FORBIDDEN);
      }

      const version = await knowledgePointVersionService.createManualVersion(
        req.supabase!,
        id,
        change_summary,
        req.user.id,
      );

      res.status(201).json(version);
    } catch (error) {
      const err = error as Error;
      if (error instanceof AppError) throw error;
      if (err.message === "Knowledge point not found") {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw new AppError(err.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.put(
  "/:id/aliases",
  requireAuth,
  validate(updateAliasesSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { aliases } = req.body;

    try {
      const isOwner = await knowledgePointService.checkOwnership(
        req.supabase!,
        id,
        req.user.id,
      );

      if (!isOwner) {
        throw new AppError("没有权限执行此操作", 403, ErrorCodes.FORBIDDEN);
      }

      logger.info("Updating knowledge point aliases", {
        knowledgePointId: id,
        aliasesCount: aliases.length,
        userId: req.user.id,
      });

      await conceptAggregationService.addAliases(
        req.supabase!,
        id,
        aliases,
      );

      logger.info("Knowledge point aliases updated successfully", {
        knowledgePointId: id,
        aliases,
        userId: req.user.id,
      });

      res.json({
        success: true,
        message: "别名更新成功",
        aliases,
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to update knowledge point aliases", {
        error: err.message,
        stack: err.stack,
        knowledgePointId: id,
        userId: req.user.id,
      });

      if (error instanceof AppError) throw error;
      if (err.message === "Knowledge point not found") {
        throw new AppError(
          "知识点不存在",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      throw new AppError(
        err.message || "更新别名失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
