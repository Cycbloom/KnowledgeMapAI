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
    } catch (error: any) {
      logger.error("确保未分类领域失败", { error: error.message, userId });
      throw new AppError("操作失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
);

export default router;
