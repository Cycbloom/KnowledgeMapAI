import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { cacheService, CacheKeys } from "../services/common/cacheService.js";
import { aiService } from "../services/ai/aiService.js";
import { knowledgePointService, graphNodeService, graphService, knowledgePointVersionService, } from "../services/graph/index.js";
import { authService } from "../services/core/authService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
const router = Router();
const createKnowledgePointSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(255),
        content: z.string().optional(),
        learning_material: z.string().optional(),
        properties: z.record(z.any()).optional(),
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
        properties: z.record(z.any()).optional(),
        visibility: z.enum(["private", "public", "pending"]).optional(),
    }),
    params: z.object({
        id: z.string().uuid(),
    }),
});
const createGraphNodeSchema = z.object({
    body: z.object({
        graph_id: z.string().uuid(),
        knowledge_point_id: z.string().uuid(),
        x_position: z.number().optional().default(0),
        y_position: z.number().optional().default(0),
        level: z
            .enum(["root", "core", "sub", "normal", "leaf"])
            .optional()
            .default("normal"),
        is_accepted: z.boolean().optional().default(true),
    }),
});
const searchSimilarSchema = z.object({
    body: z.object({
        query: z.string().min(1),
        threshold: z.number().min(0).max(1).optional().default(0.8),
        limit: z.number().min(1).max(20).optional().default(5),
    }),
});
const combinedViewSchema = z.object({
    body: z.object({
        graph_ids: z.array(z.string().uuid()).min(2),
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
router.get("/knowledge-points", requireAuth, async (req, res) => {
    const { visibility } = req.query;
    try {
        const data = await knowledgePointService.list(req.supabase, req.user.id, {
            visibility: visibility,
        });
        res.json(data);
    }
    catch (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/knowledge-points/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const data = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);
        if (!data) {
            throw new AppError("Knowledge point not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        res.json(data);
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/knowledge-points/:id/graphs", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const data = await knowledgePointService.getGraphs(req.supabase, id, req.user.id);
        res.json(data);
    }
    catch (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/knowledge-points", requireAuth, validate(createKnowledgePointSchema), async (req, res) => {
    const { title, content, learning_material, properties, visibility } = req.body;
    try {
        const data = await knowledgePointService.create(req.supabase, {
            title,
            content,
            learning_material,
            properties,
            visibility,
            owner_id: req.user.id,
        });
        res.status(201).json(data);
    }
    catch (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.put("/knowledge-points/:id", requireAuth, validate(updateKnowledgePointSchema), async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
        const isOwner = await knowledgePointService.checkOwnership(req.supabase, id, req.user.id);
        if (!isOwner) {
            throw new AppError("Permission denied", 403, ErrorCodes.FORBIDDEN);
        }
        const data = await knowledgePointService.update(req.supabase, id, updates);
        res.json(data);
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/knowledge-points/search-similar", requireAuth, validate(searchSimilarSchema), async (req, res) => {
    const { query, threshold, limit } = req.body;
    try {
        const embedding = await aiService.generateEmbedding(query);
        if (!embedding) {
            return res.json([]);
        }
        const data = await knowledgePointService.searchSimilar(req.supabase, embedding, req.user.id, threshold, limit);
        res.json(data || []);
    }
    catch (error) {
        logger.error("Search similar error:", error);
        res.json([]);
    }
});
router.delete("/knowledge-points/:id/hard-delete", requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const data = await knowledgePointService.delete(req.supabase, id, req.user.id);
        res.json(data);
    }
    catch (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/graph-nodes", requireAuth, validate(createGraphNodeSchema), async (req, res) => {
    const { graph_id, knowledge_point_id, x_position, y_position, level, is_accepted, } = req.body;
    const graph = await graphService.getGraph(req.supabase, graph_id, req.user.id);
    if (!graph) {
        throw new AppError("Graph not found or unauthorized", 403, ErrorCodes.FORBIDDEN);
    }
    try {
        const data = await graphNodeService.addToGraph(req.supabase, {
            graph_id,
            knowledge_point_id,
            x_position,
            y_position,
            level,
            is_accepted,
        });
        cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
        res.status(201).json(data);
    }
    catch (error) {
        if (error.message?.includes("已存在")) {
            throw new AppError("Knowledge point already exists in this graph", 400, ErrorCodes.VALIDATION_ERROR);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/graph-nodes/add-existing", requireAuth, async (req, res) => {
    const { graph_id, knowledge_point_id, x_position, y_position, level } = req.body;
    const graph = await graphService.getGraph(req.supabase, graph_id, req.user.id);
    if (!graph) {
        throw new AppError("Graph not found or unauthorized", 403, ErrorCodes.FORBIDDEN);
    }
    const kp = await knowledgePointService.getAccessible(req.supabase, knowledge_point_id, req.user.id);
    if (!kp) {
        throw new AppError("Knowledge point not found or inaccessible", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    try {
        const data = await graphNodeService.addToGraph(req.supabase, {
            graph_id,
            knowledge_point_id,
            x_position: x_position || 0,
            y_position: y_position || 0,
            level: level || "normal",
        });
        cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
        res.status(201).json(data);
    }
    catch (error) {
        if (error.message?.includes("已存在")) {
            throw new AppError("Knowledge point already exists in this graph", 400, ErrorCodes.VALIDATION_ERROR);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.delete("/graph-nodes/:id/soft-delete", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await req.supabase.rpc("soft_delete_graph_node", {
        p_graph_node_id: id,
        p_user_id: req.user.id,
    });
    if (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
    if (!data) {
        throw new AppError("Graph node not found or unauthorized", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    res.json({ success: true });
});
router.post("/combined-view", requireAuth, validate(combinedViewSchema), async (req, res) => {
    const { graph_ids } = req.body;
    try {
        const result = await graphService.getCombinedView(req.supabase, req.user.id, graph_ids);
        res.json(result);
    }
    catch (error) {
        if (error.message?.includes("not found or unauthorized")) {
            throw new AppError("Some graphs not found or unauthorized", 403, ErrorCodes.FORBIDDEN);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/knowledge-points/public", async (req, res) => {
    const { search, limit = 20, offset = 0 } = req.query;
    try {
        const result = await knowledgePointService.listPublic(req.supabase, {
            search: search,
            limit: Number(limit),
            offset: Number(offset),
        });
        res.json(result);
    }
    catch (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/knowledge-points/submit-public", requireAuth, validate(submitPublicSchema), async (req, res) => {
    const { knowledge_point_id, suggested_changes } = req.body;
    try {
        const result = await knowledgePointService.submitForPublic(req.supabase, { knowledge_point_id, suggested_changes }, req.user.id);
        res.json(result);
    }
    catch (error) {
        if (error.message === "Knowledge point not found") {
            throw new AppError("Knowledge point not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        if (error.message === "Permission denied") {
            throw new AppError("Permission denied", 403, ErrorCodes.FORBIDDEN);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/admin/knowledge-points/pending", requireAuth, async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const userProfile = await authService.getProfile(req.user.id);
    if (!userProfile || userProfile.role !== "admin") {
        throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
    }
    try {
        const result = await knowledgePointService.listPending(req.supabase, {
            limit: Number(limit),
            offset: Number(offset),
        });
        res.json(result);
    }
    catch (error) {
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/admin/knowledge-points/suggestions/:id/approve", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userProfile = await authService.getProfile(req.user.id);
    if (!userProfile || userProfile.role !== "admin") {
        throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
    }
    try {
        const data = await knowledgePointService.approvePublic(req.supabase, id, req.user.id);
        res.json({
            success: true,
            knowledge_point: data,
        });
    }
    catch (error) {
        if (error.message === "Knowledge point not found or not pending") {
            throw new AppError("Knowledge point not found or not pending", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/admin/knowledge-points/suggestions/:id/reject", requireAuth, validate(rejectSuggestionSchema), async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userProfile = await authService.getProfile(req.user.id);
    if (!userProfile || userProfile.role !== "admin") {
        throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
    }
    try {
        await knowledgePointService.rejectPublic(req.supabase, id, req.user.id, reason);
        res.json({
            success: true,
        });
    }
    catch (error) {
        if (error.message === "Knowledge point not found or not pending") {
            throw new AppError("Knowledge point not found or not pending", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
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
router.get("/knowledge-points/:id/versions", requireAuth, validate(listVersionsSchema), async (req, res) => {
    const { id } = req.params;
    const { limit, offset } = req.query;
    try {
        const kp = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);
        if (!kp) {
            throw new AppError("Knowledge point not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        const result = await knowledgePointVersionService.getVersionHistory(req.supabase, id, { limit: Number(limit), offset: Number(offset) });
        res.json(result);
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/knowledge-points/:id/versions/:versionNumber", requireAuth, validate(getVersionSchema), async (req, res) => {
    const { id, versionNumber } = req.params;
    try {
        const kp = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);
        if (!kp) {
            throw new AppError("Knowledge point not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        const version = await knowledgePointVersionService.getVersion(req.supabase, id, Number(versionNumber));
        if (!version) {
            throw new AppError("Version not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        res.json(version);
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.get("/knowledge-points/:id/versions/compare", requireAuth, validate(compareVersionsSchema), async (req, res) => {
    const { id } = req.params;
    const { version1, version2 } = req.query;
    try {
        const kp = await knowledgePointService.getAccessible(req.supabase, id, req.user.id);
        if (!kp) {
            throw new AppError("Knowledge point not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        const result = await knowledgePointVersionService.compareVersions(req.supabase, id, Number(version1), Number(version2));
        res.json(result);
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        if (error.message === "One or both versions not found") {
            throw new AppError("One or both versions not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/knowledge-points/:id/versions/:versionNumber/rollback", requireAuth, validate(rollbackSchema), async (req, res) => {
    const { id, versionNumber } = req.params;
    try {
        const isOwner = await knowledgePointService.checkOwnership(req.supabase, id, req.user.id);
        if (!isOwner) {
            throw new AppError("Permission denied", 403, ErrorCodes.FORBIDDEN);
        }
        const result = await knowledgePointVersionService.rollback(req.supabase, id, Number(versionNumber), req.user.id);
        res.json({
            success: true,
            knowledge_point: result,
        });
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        if (error.message === "Version not found") {
            throw new AppError("Version not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
router.post("/knowledge-points/:id/versions", requireAuth, validate(createManualVersionSchema), async (req, res) => {
    const { id } = req.params;
    const { change_summary } = req.body;
    try {
        const isOwner = await knowledgePointService.checkOwnership(req.supabase, id, req.user.id);
        if (!isOwner) {
            throw new AppError("Permission denied", 403, ErrorCodes.FORBIDDEN);
        }
        const version = await knowledgePointVersionService.createManualVersion(req.supabase, id, change_summary, req.user.id);
        res.status(201).json(version);
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        if (error.message === "Knowledge point not found") {
            throw new AppError("Knowledge point not found", 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
        throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);
    }
});
export default router;
//# sourceMappingURL=knowledgePoints.js.map