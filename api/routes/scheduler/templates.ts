import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { templateService } from "../../services/scheduler";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "模板名称不能为空")
    .max(50, "模板名称不能超过50个字符"),
  description: z.string().max(200, "描述不能超过200个字符").optional(),
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  title_template: z
    .string()
    .min(1, "标题模板不能为空")
    .max(100, "标题模板不能超过100个字符"),
  description_template: z
    .string()
    .max(500, "描述模板不能超过500个字符")
    .optional(),
  estimated_duration: z.number().int().min(1).max(480).optional(),
  tags: z.array(z.string()).max(5, "最多5个标签").optional(),
  priority: z.number().int().min(1).max(4).optional(),
  is_default: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  title_template: z.string().min(1).max(100).optional(),
  description_template: z.string().max(500).optional(),
  estimated_duration: z.number().int().min(1).max(480).optional(),
  tags: z.array(z.string()).max(5).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  is_default: z.boolean().optional(),
});

const getTemplatesQuerySchema = z.object({
  category: z.enum(["study", "work", "life", "health", "custom"]).optional(),
  search: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const applyTemplateSchema = z.object({
  placeholders: z.record(z.string()).optional(),
  queue_level: z.number().int().min(0).max(2).optional(),
  knowledge_point_id: z.string().uuid().optional(),
  deadline: z.string().datetime().optional(),
});

router.get(
  "/templates",
  requireAuth,
  validate({ query: getTemplatesQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { category, search, limit, offset } = req.query as unknown as z.infer<
      typeof getTemplatesQuerySchema
    >;

    try {
      const result = await templateService.listTemplates(supabase, req.user.id, { category, search, limit, offset });
      res.json({ success: true, data: result.templates, total: result.total });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "获取模板列表失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/templates/categories",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    try {
      const categories = await templateService.getTemplateCategories(supabase, req.user.id);
      res.json({ success: true, data: categories });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "获取分类失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.get(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      const template = await templateService.getTemplate(supabase, req.user.id, id);
      res.json({ success: true, data: template });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "模板不存在", err.statusCode || 404, ErrorCodes.NOT_FOUND);
    }
  },
);

router.post(
  "/templates",
  requireAuth,
  validate({ body: createTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    try {
      const template = await templateService.createTemplate(supabase, req.user.id, req.body);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "创建模板失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.put(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      const template = await templateService.updateTemplate(supabase, req.user.id, id, req.body);
      res.json({ success: true, data: template });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "模板不存在或无法更新", err.statusCode || 404, ErrorCodes.NOT_FOUND);
    }
  },
);

router.delete(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      await templateService.deleteTemplate(supabase, req.user.id, id);
      res.json({ success: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "删除模板失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/templates/:id/apply",
  requireAuth,
  validate({ params: uuidParamsSchema, body: applyTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { placeholders, queue_level, knowledge_point_id, deadline } = req.body;

    try {
      const task = await templateService.applyTemplate(supabase, req.user.id, id, {
        placeholders, queue_level, knowledge_point_id, deadline,
      });
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "从模板创建任务失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/templates/:id/duplicate",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;
    const { name } = req.body;

    try {
      const template = await templateService.duplicateTemplate(supabase, req.user.id, id, name);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "复制模板失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.put(
  "/templates/:id/set-default",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      throw new AppError("Database connection not available", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const { id } = req.params;

    try {
      const template = await templateService.setDefaultTemplate(supabase, req.user.id, id);
      res.json({ success: true, data: template });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      throw new AppError(err.message || "设置默认模板失败", err.statusCode || 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

export default router;
