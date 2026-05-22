import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { logger } from "../utils/logger";
import { z } from "zod";
import { aiService } from "../services/ai/aiService";
import { getAIProviderForTask } from "../services/ai/factory";

const createDomainSchema = z.object({
  name: z.string().min(2, "名称至少需要2个字符").max(200, "名称最多200个字符"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效，应为HEX格式如#FF5733"),
  description: z.string().max(1000).optional(),
  parent_id: z.string().uuid("无效的父领域ID").nullable().optional(),
  icon: z.string().max(50).optional(),
});

const updateDomainSchema = z.object({
  name: z.string().min(2, "名称至少需要2个字符").max(200, "名称最多200个字符").optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效，应为HEX格式如#FF5733").optional(),
  icon: z.string().max(50).optional(),
  parent_id: z.string().uuid("无效的父领域ID").nullable().optional(),
  sort_order: z.number().int().optional(),
});

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID格式"),
});

const generateColorSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

const recommendDomainsSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

const reorderItemSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0),
});

const reorderSchema = z.object({
  reorder_items: z.array(reorderItemSchema).min(1).max(100),
});

interface DomainRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  user_id: string;
  is_system: boolean;
  deleted_at: string | null;
  created_at: string;
}

interface DomainTreeNode extends DomainRecord {
  children: DomainTreeNode[];
  graphCount?: number;
}

function buildTree(domains: DomainRecord[]): DomainTreeNode[] {
  const domainMap = new Map<string, DomainTreeNode>();
  const roots: DomainTreeNode[] = [];

  domains.forEach((domain) => {
    domainMap.set(domain.id, { ...domain, children: [] });
  });

  domains.forEach((domain) => {
    const node = domainMap.get(domain.id)!;
    if (domain.parent_id && domainMap.has(domain.parent_id)) {
      domainMap.get(domain.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  roots.sort((a, b) => a.sort_order - b.sort_order);
  const sortChildren = (nodes: DomainTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

async function ensureUncategorizedDomain(
  supabase: AuthRequest["supabase"],
  userId: string,
): Promise<string> {
  const sb = supabase!;
  const { data: existing } = await sb
    .from("domains")
    .select("id")
    .eq("name", "未分类")
    .eq("is_system", true)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newDomain, error } = await sb
    .from("domains")
    .insert({
      name: "未分类",
      description: "未归类到任何领域的图谱",
      color: "#94A3B8",
      icon: "FolderOpen",
      is_system: true,
      user_id: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return newDomain.id;
}

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;
  const userId = req.user.id;

  const { data: domains, error } = await supabase
    .from("domains")
    .select("*")
    .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    logger.error("获取领域列表失败", { error: error.message, userId });
    throw new AppError("获取领域列表失败", 500, ErrorCodes.INTERNAL_ERROR);
  }

  let tree = buildTree(domains as DomainRecord[]);

  const hasUncategorized = tree.some((d) => d.name === "未分类");
  if (!hasUncategorized) {
    const uncategorizedId = await ensureUncategorizedDomain(supabase, userId);
    const uncategorizedNode: DomainTreeNode = {
      id: uncategorizedId,
      name: "未分类",
      description: "未归类到任何领域的图谱",
      color: "#94A3B8",
      icon: "FolderOpen",
      parent_id: null,
      sort_order: 9999,
      user_id: userId,
      is_system: true,
      deleted_at: null,
      created_at: new Date().toISOString(),
      children: [],
    };
    tree.push(uncategorizedNode);
  }

  logger.info("获取领域列表成功", { userId, count: tree.length });

  res.json(tree);
});

router.get(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const { id } = req.params;
    const userId = req.user.id;

    const { data: domain, error } = await supabase
      .from("domains")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !domain) {
      throw new AppError("领域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    const isOwner = domain.user_id === userId;
    const isSystem = domain.is_system;

    if (!isOwner && !isSystem) {
      throw new AppError("无权访问该领域", 403, ErrorCodes.FORBIDDEN);
    }

    const { count: graphCount } = await supabase
      .from("graph_domains")
      .select("*", { count: "exact", head: true })
      .eq("domain_id", id);

    const { data: children } = await supabase
      .from("domains")
      .select("id, name, color, icon, sort_order, is_system")
      .eq("parent_id", id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    logger.info("获取领域详情成功", { domainId: id, userId });

    res.json({
      ...domain,
      graphCount: graphCount || 0,
      children: children || [],
    });
  },
);

router.post(
  "/",
  requireAuth,
  validate({ body: createDomainSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const userId = req.user.id;
    const { name, color, description, parent_id, icon } = req.body;

    if (parent_id) {
      const { data: parentDomain, error: parentError } = await supabase
        .from("domains")
        .select("id, user_id, is_system, deleted_at")
        .eq("id", parent_id)
        .single();

      if (parentError || !parentDomain) {
        throw new AppError("父领域不存在", 404, ErrorCodes.NOT_FOUND);
      }

      if (parentDomain.deleted_at) {
        throw new AppError("父领域已被删除", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const isParentAccessible =
        parentDomain.user_id === userId || parentDomain.is_system;

      if (!isParentAccessible) {
        throw new AppError("无权在该父领域下创建子领域", 403, ErrorCodes.FORBIDDEN);
      }
    }

    const { data: newDomain, error } = await supabase
      .from("domains")
      .insert({
        name,
        color,
        description: description || null,
        parent_id: parent_id || null,
        icon: icon || null,
        user_id: userId,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        logger.warn("领域名称已存在", { name, userId, parent_id });
        throw new AppError(
          "该领域名称已存在",
          409,
          ErrorCodes.DATABASE_DUPLICATE_ENTRY,
        );
      }
      logger.error("创建领域失败", { error: error.message, userId, name });
      throw new AppError("创建领域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("创建领域成功", { domainId: newDomain.id, userId, name });

    res.status(201).json(newDomain);
  },
);

router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateDomainSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from("domains")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      throw new AppError("领域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    if (existing.user_id !== userId) {
      throw new AppError("只有领域所有者才能修改该领域", 403, ErrorCodes.FORBIDDEN);
    }

    if (existing.is_system) {
      throw new AppError("系统预置领域不可修改", 403, ErrorCodes.FORBIDDEN);
    }

    if (updates.parent_id !== undefined) {
      if (updates.parent_id === id) {
        throw new AppError("不能将领域设置为自己的子领域", 400, ErrorCodes.VALIDATION_ERROR);
      }

      if (updates.parent_id !== null) {
        const { data: parentDomain, error: parentError } = await supabase
          .from("domains")
          .select("id, user_id, is_system, deleted_at")
          .eq("id", updates.parent_id)
          .single();

        if (parentError || !parentDomain) {
          throw new AppError("父领域不存在", 404, ErrorCodes.NOT_FOUND);
        }

        if (parentDomain.deleted_at) {
          throw new AppError("目标父领域已被删除", 400, ErrorCodes.VALIDATION_ERROR);
        }
      }
    }

    const { data: updated, error } = await supabase
      .from("domains")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError(
          "该领域名称已存在",
          409,
          ErrorCodes.DATABASE_DUPLICATE_ENTRY,
        );
      }
      logger.error("更新领域失败", { error: error.message, domainId: id, userId });
      throw new AppError("更新领域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("更新领域成功", { domainId: id, userId });

    res.json(updated);
  },
);

router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const { id } = req.params;
    const userId = req.user.id;

    const { data: existing, error: fetchError } = await supabase
      .from("domains")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      throw new AppError("领域不存在", 404, ErrorCodes.NOT_FOUND);
    }

    if (existing.user_id !== userId) {
      throw new AppError("只有领域所有者才能删除该领域", 403, ErrorCodes.FORBIDDEN);
    }

    if (existing.is_system) {
      throw new AppError("系统预置领域不可删除", 403, ErrorCodes.FORBIDDEN);
    }

    const { error } = await supabase
      .from("domains")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      logger.error("删除领域失败", { error: error.message, domainId: id, userId });
      throw new AppError("删除领域失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    logger.info("删除领域成功（软删除）", { domainId: id, userId });

    res.json({ message: "领域已删除" });
  },
);

router.get(
  "/ensure-uncategorized",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const userId = req.user!.id;

    try {
      const domainId = await ensureUncategorizedDomain(supabase, userId);
      res.json({ id: domainId, name: "未分类" });
    } catch (error) {
      logger.error("确保未分类领域失败", { error: (error as Error).message, userId });
      throw new AppError("操作失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
);

router.post(
  "/generate-color",
  requireAuth,
  validate({ body: generateColorSchema }),
  async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body;
    const DEFAULT_COLOR = "#6366F1";

    try {
      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        logger.warn("AI 服务不可用，使用默认颜色", { name });
        return res.json({
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        });
      }

      const prompt = `你是一个色彩设计专家。根据以下领域的名称和描述，推荐一个合适的 HEX 颜色值。

领域名称：${name}
${description ? `领域描述：${description}` : ""}

要求：
1. 返回一个 HEX 格式的颜色值（#RRGGBB）
2. 颜色应该与领域的语义、情感或联想相关（例如：海洋→蓝色系，火焰→红色/橙色系）
3. 只返回 JSON 格式：{"color": "#HEX值", "reason": "推荐理由"}`;

      const response = await aiService.chat([
        { role: "user", content: prompt },
      ]);

      let parsed: { color: string; reason: string };
      try {
        const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        logger.warn("AI 返回的 JSON 解析失败，使用默认颜色", {
          name,
          rawResponse: response.slice(0, 200),
        });
        return res.json({
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        });
      }

      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!colorRegex.test(parsed.color)) {
        logger.warn("AI 返回的颜色格式无效，使用默认颜色", {
          name,
          color: parsed.color,
        });
        return res.json({
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        });
      }

      logger.info("AI 生成领域颜色成功", { name, color: parsed.color });

      res.json({
        color: parsed.color,
        reason: parsed.reason || "",
      });
    } catch (error) {
      const err = error as Error;
      logger.error("AI 生成领域颜色失败", { error: err.message, name });
      res.json({
        color: DEFAULT_COLOR,
        reason: "使用了默认颜色",
      });
    }
  }
);

router.post(
  "/recommend",
  requireAuth,
  validate({ body: recommendDomainsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const userId = req.user.id;
    const { title, description } = req.body;

    const { data: domains, error } = await supabase
      .from("domains")
      .select("id, name, description, color")
      .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
      .is("deleted_at", null);

    if (error) {
      logger.error("获取领域列表失败", { error: error.message, userId });
      throw new AppError("获取领域列表失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    if (!domains || domains.length === 0) {
      res.json({ recommendations: [] });
      return;
    }

    const prompt = `你是知识分类专家。根据以下图谱信息，从给定的领域列表中选择最匹配的 3-5 个领域。

图谱标题：${title}
${description ? `图谱描述：${description}` : ''}

可选领域列表：
${domains.map((d, i) => `${i + 1}. ${d.name}${d.description ? ` (${d.description})` : ``}`).join('\n')}

要求：
1. 分析图谱内容与哪个领域最相关
2. 返回 JSON 数组，每个元素包含：
   - id: 领域ID
   - name: 领域名称
   - confidence: 匹配置信度 (0-1之间的数字)
   - reason: 推荐理由（一句话）
3. 只返回最相关的 3-5 个领域
4. confidence 总和不需要等于 1，每个独立评分`;

    try {
      const response = await aiService.chat(
        [
          { role: "system", content: "你是一个知识分类专家，擅长分析内容并推荐合适的分类。" },
          { role: "user", content: prompt },
        ],
        { timeout: 30000 },
      );

      let parsed: Array<{ id: string; name: string; confidence: number; reason: string }>;
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error("无法提取 JSON 数组");
        }
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.warn("AI 推荐响应解析失败", { response, error: parseError instanceof Error ? parseError.message : String(parseError) });
        res.json({ recommendations: [] });
        return;
      }

      const validDomainIds = new Set(domains.map((d) => d.id));
      const validRecommendations = parsed
        .filter((rec) => validDomainIds.has(rec.id))
        .slice(0, 5);

      res.json({ recommendations: validRecommendations });
    } catch (error) {
      logger.warn("AI 领域推荐服务不可用，返回空数组", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      res.json({ recommendations: [] });
    }
  },
);

function detectCycle(
  items: Array<{ id: string; parent_id: string | null | undefined }>,
): boolean {
  const graph = new Map<string, string | null>();
  items.forEach((item) => {
    graph.set(item.id, item.parent_id ?? null);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): boolean {
    if (recursionStack.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const parent = graph.get(nodeId);
    if (parent && graph.has(parent)) {
      if (dfs(parent, path)) {
        return true;
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.keys()) {
    visited.clear();
    recursionStack.clear();
    if (dfs(nodeId, [])) {
      return true;
    }
  }

  return false;
}

router.put(
  "/reorder",
  requireAuth,
  validate({ body: reorderSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase!;
    const userId = req.user.id;
    const { reorder_items } = req.body;

    const domainIds = reorder_items.map((item: { id: string }) => item.id);

    const { data: domains, error } = await supabase
      .from("domains")
      .select("id, user_id, is_system, deleted_at")
      .in("id", domainIds)
      .is("deleted_at", null);

    if (error) {
      logger.error("查询领域信息失败", { error: error.message, userId });
      throw new AppError("查询领域信息失败", 500, ErrorCodes.INTERNAL_ERROR);
    }

    if (!domains || domains.length !== domainIds.length) {
      const foundIds = new Set(domains?.map((d) => d.id) ?? []);
      const missingIds = domainIds.filter((id: string) => !foundIds.has(id));
      logger.warn("部分领域不存在或已被删除", { missingIds, userId });
      throw new AppError("部分领域不存在或已被删除", 404, ErrorCodes.NOT_FOUND);
    }

    for (const domain of domains) {
      const isOwner = domain.user_id === userId;
      const isSystem = domain.is_system;

      if (!isOwner && !isSystem) {
        logger.warn("用户尝试重排序无权访问的领域", { domainId: domain.id, userId });
        throw new AppError("无权操作该领域", 403, ErrorCodes.FORBIDDEN);
      }
    }

    const hasCycle = detectCycle(reorder_items);
    if (hasCycle) {
      logger.warn("检测到领域循环引用", { userId, itemCount: reorder_items.length });
      throw new AppError(
        "检测到循环引用，无法将领域设置为自己的后代",
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    let updatedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of reorder_items) {
      const { error: updateError } = await supabase
        .from("domains")
        .update({
          parent_id: item.parent_id ?? null,
          sort_order: item.sort_order,
        })
        .eq("id", item.id);

      if (updateError) {
        errors.push({ id: item.id, error: updateError.message });
        logger.error("更新领域排序失败", {
          domainId: item.id,
          error: updateError.message,
          userId,
        });
      } else {
        updatedCount++;
      }
    }

    if (errors.length > 0) {
      logger.warn("部分领域更新失败", { errors, successCount: updatedCount, userId });
    }

    logger.info("领域重排序完成", { userId, totalCount: reorder_items.length, updatedCount });

    res.json({
      success: true,
      updated_count: updatedCount,
    });
  },
);

export default router;
