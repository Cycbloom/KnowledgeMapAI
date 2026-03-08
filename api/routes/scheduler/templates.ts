import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import { logger } from "../../utils/logger.js";

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
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { category, search, limit, offset } = req.query as unknown as z.infer<
      typeof getTemplatesQuerySchema
    >;

    let query = supabase
      .from("task_templates")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .order("is_system", { ascending: true })
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("category", category);
    }
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,title_template.ilike.%${search}%`,
      );
    }

    const { data: templates, error, count } = await query;

    if (error) {
      console.error("Get templates error:", error);
      return res.status(500).json({ error: "获取模板列表失败" });
    }

    res.json({ success: true, data: templates, total: count });
  },
);

router.get(
  "/templates/categories",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { data: templates, error } = await supabase
      .from("task_templates")
      .select("category")
      .or(`user_id.eq.${req.user.id},is_system.eq.true`);

    if (error) {
      return res.status(500).json({ error: "获取分类失败" });
    }

    const categories = [
      { value: "study", label: "学习", icon: "📚", color: "blue" },
      { value: "work", label: "工作", icon: "💼", color: "purple" },
      { value: "life", label: "生活", icon: "🏠", color: "green" },
      { value: "health", label: "健康", icon: "💪", color: "red" },
      { value: "custom", label: "自定义", icon: "⭐", color: "amber" },
    ];

    const categoryCounts: Record<string, number> = {};
    for (const t of templates || []) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    }

    const result = categories.map((cat) => ({
      ...cat,
      count: categoryCounts[cat.value] || 0,
    }));

    res.json({ success: true, data: result });
  },
);

router.get(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: template, error } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .single();

    if (error || !template) {
      return res.status(404).json({ error: "模板不存在" });
    }

    res.json({ success: true, data: template });
  },
);

router.post(
  "/templates",
  requireAuth,
  validate({ body: createTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const {
      name,
      description,
      category,
      title_template,
      description_template,
      estimated_duration,
      tags,
      priority,
      is_default,
    } = req.body;

    const { data: template, error } = await supabase
      .from("task_templates")
      .insert({
        user_id: req.user.id,
        name,
        description,
        category: category ?? "custom",
        title_template,
        description_template,
        estimated_duration: estimated_duration ?? 25,
        tags: tags ?? [],
        priority: priority ?? 2,
        is_default: is_default ?? false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create template error:", error);
      return res.status(500).json({ error: "创建模板失败" });
    }

    res.status(201).json({ success: true, data: template });
  },
);

router.put(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const updateData = req.body;

    const { data: template, error } = await supabase
      .from("task_templates")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .eq("is_system", false)
      .select()
      .single();

    if (error || !template) {
      return res.status(404).json({ error: "模板不存在或无法更新" });
    }

    res.json({ success: true, data: template });
  },
);

router.delete(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .eq("is_system", false);

    if (error) {
      return res.status(500).json({ error: "删除模板失败" });
    }

    res.json({ success: true });
  },
);

router.post(
  "/templates/:id/apply",
  requireAuth,
  validate({ params: uuidParamsSchema, body: applyTemplateSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { placeholders, queue_level, knowledge_point_id, deadline } =
      req.body;

    const { data: template, error: templateError } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ error: "模板不存在" });
    }

    let title = template.title_template;
    let description = template.description_template;

    if (placeholders) {
      for (const [key, value] of Object.entries(placeholders)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, "g"), value as string);
        if (description) {
          description = description.replace(
            new RegExp(placeholder, "g"),
            value as string,
          );
        }
      }
    }

    const unresolvedPlaceholders = title.match(/\{\{[^}]+\}\}/g);
    if (unresolvedPlaceholders) {
      for (const placeholder of unresolvedPlaceholders) {
        const key = placeholder.slice(2, -2);
        title = title.replace(placeholder, key);
        if (description) {
          description = description.replace(placeholder, key);
        }
      }
    }

    const { count } = await supabase
      .from("scheduled_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("queue_level", queue_level ?? 0)
      .is("deleted_at", null);

    const { data: task, error: taskError } = await supabase
      .from("scheduled_tasks")
      .insert({
        user_id: req.user.id,
        title,
        description,
        queue_level: queue_level ?? 0,
        position: count ?? 0,
        estimated_duration: template.estimated_duration,
        tags: template.tags,
        priority: template.priority,
        knowledge_point_id,
        deadline,
        status: "pending",
      })
      .select()
      .single();

    if (taskError) {
      console.error("Create task from template error:", taskError);
      return res.status(500).json({ error: "从模板创建任务失败" });
    }

    await supabase
      .from("task_templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", id);

    res.status(201).json({ success: true, data: task });
  },
);

router.post(
  "/templates/:id/duplicate",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { name } = req.body;

    const { data: original, error: fetchError } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${req.user.id},is_system.eq.true`)
      .single();

    if (fetchError || !original) {
      return res.status(404).json({ error: "模板不存在" });
    }

    const { data: template, error } = await supabase
      .from("task_templates")
      .insert({
        user_id: req.user.id,
        name: name || `${original.name} (副本)`,
        description: original.description,
        category: original.category,
        title_template: original.title_template,
        description_template: original.description_template,
        estimated_duration: original.estimated_duration,
        tags: original.tags,
        priority: original.priority,
        is_default: false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Duplicate template error:", error);
      return res.status(500).json({ error: "复制模板失败" });
    }

    res.status(201).json({ success: true, data: template });
  },
);

router.put(
  "/templates/:id/set-default",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: template, error: fetchError } = await supabase
      .from("task_templates")
      .select("category")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (fetchError || !template) {
      return res.status(404).json({ error: "模板不存在" });
    }

    await supabase
      .from("task_templates")
      .update({ is_default: false })
      .eq("user_id", req.user.id)
      .eq("category", template.category);

    const { data: updated, error } = await supabase
      .from("task_templates")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "设置默认模板失败" });
    }

    res.json({ success: true, data: updated });
  },
);

export default router;
