import { Router, type Response } from "express";
import { requireAuth, requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { aiService } from "../../services/ai";
import {
  knowledgePointService,
  knowledgePointVersionService,
  conceptAggregationService,
} from "../../services/graph";
import { requireKnowledgePointOwnership } from "../../middleware/ownership";
import { logger } from "../../utils/logger";
import { z } from "zod";
import {
  createKnowledgePointSchema,
  updateKnowledgePointSchema,
  searchSimilarSchema,
  submitPublicSchema,
  rejectSuggestionSchema,
} from "../../schemas/index";

const router = Router();

router.get(
  "/",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { visibility } = req.query;

    const data = await knowledgePointService.list(
      req.supabase,
      req.user.id,
      {
        visibility: visibility as "public" | undefined,
      },
    );
    res.json(data);
  },
);

router.get(
  "/:id",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    const data = await knowledgePointService.getAccessible(
      req.supabase,
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
  },
);

router.get(
  "/:id/graphs",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    const data = await knowledgePointService.getGraphs(
      req.supabase,
      id,
      req.user.id,
    );
    res.json(data);
  },
);

router.post(
  "/",
  requireAuth,
  validate(createKnowledgePointSchema),
  async (req: AuthedRequest, res: Response) => {
    const { title, content, summary, learning_material, properties, visibility } =
      req.body;

    const data = await knowledgePointService.create(req.supabase, {
      title,
      content,
      summary,
      learning_material,
      properties,
      visibility,
      owner_id: req.user.id,
    });

    res.status(201).json(data);
  },
);

router.put(
  "/:id",
  requireAuth,
  requireKnowledgePointOwnership,
  validate(updateKnowledgePointSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const data = await knowledgePointService.update(
      req.supabase,
      id,
      updates,
    );
    res.json(data);
  },
);

router.post(
  "/search-similar",
  requireAuth,
  validate(searchSimilarSchema),
  async (req: AuthedRequest, res: Response) => {
    const { query, threshold, limit } = req.body;

    try {
      const embedding = await aiService.generateEmbedding(query);

      if (!embedding) {
        return res.json([]);
      }

      const data = await knowledgePointService.searchSimilar(
        req.supabase,
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
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    const data = await knowledgePointService.delete(
      req.supabase,
      id,
      req.user.id,
    );
    res.json(data);
  },
);

router.get(
  "/public",
  async (req: AuthedRequest, res: Response) => {
    const { search, limit = 20, offset = 0 } = req.query;

    const result = await knowledgePointService.listPublic(req.supabase, {
      search: search as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json(result);
  },
);

router.post(
  "/submit-public",
  requireAuth,
  validate(submitPublicSchema),
  async (req: AuthedRequest, res: Response) => {
    const { knowledge_point_id, suggested_changes } = req.body;

    try {
      const result = await knowledgePointService.submitForPublic(
        req.supabase,
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
        throw new AppError("没有权限执行此操作", 403, ErrorCodes.AUTH_FORBIDDEN);
      }
      throw error;
    }
  },
);

router.get(
  "/admin/knowledge-points/pending",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    const { limit = 20, offset = 0 } = req.query;

    const result = await knowledgePointService.listPending(req.supabase, {
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json(result);
  },
);

router.post(
  "/admin/knowledge-points/suggestions/:id/approve",
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    try {
      const data = await knowledgePointService.approvePublic(
        req.supabase,
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
      throw error;
    }
  },
);

router.post(
  "/admin/knowledge-points/suggestions/:id/reject",
  requireAuth,
  requireAdmin,
  validate(rejectSuggestionSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
      await knowledgePointService.rejectPublic(
        req.supabase,
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
      throw error;
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
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const kp = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);

    if (!kp) {
      throw new AppError(
        "Knowledge point not found",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const result = await knowledgePointVersionService.getVersionHistory(
      req.supabase,
      id,
      { limit: Number(limit), offset: Number(offset) },
    );

    res.json(result);
  },
);

router.get(
  "/:id/versions/:versionNumber",
  requireAuth,
  validate(getVersionSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id, versionNumber } = req.params;

    const kp = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);

    if (!kp) {
      throw new AppError(
        "Knowledge point not found",
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const version = await knowledgePointVersionService.getVersion(
      req.supabase,
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
  },
);

router.get(
  "/:id/versions/compare",
  requireAuth,
  validate(compareVersionsSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { version1, version2 } = req.query;

    try {
      const kp = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);

      if (!kp) {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const result = await knowledgePointVersionService.compareVersions(
        req.supabase,
        id,
        Number(version1),
        Number(version2),
      );

      res.json(result);
    } catch (error) {
      const err = error as Error;
      if (err.message === "One or both versions not found") {
        throw new AppError(
          "One or both versions not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw error;
    }
  },
);

router.post(
  "/:id/versions/:versionNumber/rollback",
  requireAuth,
  requireKnowledgePointOwnership,
  validate(rollbackSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id, versionNumber } = req.params;

    try {
      const result = await knowledgePointVersionService.rollback(
        req.supabase,
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
      if (err.message === "Version not found") {
        throw new AppError(
          "Version not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw error;
    }
  },
);

router.post(
  "/:id/versions",
  requireAuth,
  requireKnowledgePointOwnership,
  validate(createManualVersionSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { change_summary } = req.body;

    try {
      const version = await knowledgePointVersionService.createManualVersion(
        req.supabase,
        id,
        change_summary,
        req.user.id,
      );

      res.status(201).json(version);
    } catch (error) {
      const err = error as Error;
      if (err.message === "Knowledge point not found") {
        throw new AppError(
          "Knowledge point not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }
      throw error;
    }
  },
);

router.put(
  "/:id/aliases",
  requireAuth,
  requireKnowledgePointOwnership,
  validate(updateAliasesSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { aliases } = req.body;

    try {
      logger.info("Updating knowledge point aliases", {
        knowledgePointId: id,
        aliasesCount: aliases.length,
        userId: req.user.id,
      });

      await conceptAggregationService.addAliases(
        req.supabase,
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

      if (err.message === "Knowledge point not found") {
        throw new AppError(
          "知识点不存在",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      throw error;
    }
  },
);

export default router;
