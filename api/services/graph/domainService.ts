import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { aiService } from "../ai/aiService";
import { getAIProviderForTask } from "../ai/factory";
import { notDeleted } from '../common/softDeleteHelper';
import i18next from "i18next";

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
    const node = domainMap.get(domain.id);
    if (!node) return;
    if (domain.parent_id && domainMap.has(domain.parent_id)) {
      const parent = domainMap.get(domain.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
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

function detectCycle(
  items: Array<{ id: string; parent_id?: string | null }>,
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

const UNCATEGORIZED_DOMAIN_ICON = "FolderOpen";
const UNCATEGORIZED_DOMAIN_COLOR = "#94A3B8";

async function ensureUncategorizedDomain(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("domains")
    .select("id")
    .eq("is_system", true)
    .eq("icon", UNCATEGORIZED_DOMAIN_ICON)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newDomain, error } = await supabase
    .from("domains")
    .insert({
      name: i18next.t("graphMap.domains.uncategorized.name"),
      description: i18next.t("graphMap.domains.uncategorized.description"),
      color: UNCATEGORIZED_DOMAIN_COLOR,
      icon: UNCATEGORIZED_DOMAIN_ICON,
      is_system: true,
      user_id: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return newDomain.id;
}

export const domainService = {
  async listDomainsTree(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<DomainTreeNode[]> {
    const { data: domains, error } = await notDeleted(supabase
      .from("domains")
      .select("*")
      .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
      )
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error("获取领域列表失败", { error: error.message, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.fetchListFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const tree = buildTree(domains as DomainRecord[]);

    const hasUncategorized = tree.some(
      (d) => d.is_system === true && d.icon === UNCATEGORIZED_DOMAIN_ICON,
    );
    if (!hasUncategorized) {
      const uncategorizedId = await ensureUncategorizedDomain(supabase, userId);
      const uncategorizedNode: DomainTreeNode = {
        id: uncategorizedId,
        name: i18next.t("graphMap.domains.uncategorized.name"),
        description: i18next.t("graphMap.domains.uncategorized.description"),
        color: UNCATEGORIZED_DOMAIN_COLOR,
        icon: UNCATEGORIZED_DOMAIN_ICON,
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

    return tree;
  },

  async getDomain(
    supabase: SupabaseClient,
    id: string,
    userId: string,
  ): Promise<DomainRecord & { graphCount: number; children: unknown[] }> {
    const { data: domain, error } = await notDeleted(supabase
      .from("domains")
      .select("*")
      .eq("id", id)
      )
      .single();

    if (error || !domain) {
      throw new AppError(i18next.t("graphMap.domains.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const isOwner = domain.user_id === userId;
    const isSystem = domain.is_system;

    if (!isOwner && !isSystem) {
      throw new AppError(i18next.t("graphMap.domains.errors.accessDenied"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const { count: graphCount } = await supabase
      .from("graph_domains")
      .select("*", { count: "exact", head: true })
      .eq("domain_id", id);

    const { data: children } = await notDeleted(supabase
      .from("domains")
      .select("id, name, color, icon, sort_order, is_system")
      .eq("parent_id", id)
      )
      .order("sort_order", { ascending: true });

    logger.info("获取领域详情成功", { domainId: id, userId });

    return {
      ...domain,
      graphCount: graphCount || 0,
      children: children || [],
    };
  },

  async createDomain(
    supabase: SupabaseClient,
    userId: string,
    data: {
      name: string;
      color: string;
      description?: string;
      parent_id?: string | null;
      icon?: string;
    },
  ): Promise<DomainRecord> {
    const { name, color, description, parent_id, icon } = data;

    if (parent_id) {
      const { data: parentDomain, error: parentError } = await supabase
        .from("domains")
        .select("id, user_id, is_system, deleted_at")
        .eq("id", parent_id)
        .single();

      if (parentError || !parentDomain) {
        throw new AppError(i18next.t("graphMap.domains.errors.parentNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (parentDomain.deleted_at) {
        throw new AppError(i18next.t("graphMap.domains.errors.parentDeleted"), 400, ErrorCodes.VALIDATION_ERROR);
      }

      const isParentAccessible =
        parentDomain.user_id === userId || parentDomain.is_system;

      if (!isParentAccessible) {
        throw new AppError(i18next.t("graphMap.domains.errors.noPermissionToCreateUnderParent"), 403, ErrorCodes.AUTH_FORBIDDEN);
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
      throw new AppError(i18next.t("graphMap.domains.errors.createFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    logger.info("创建领域成功", { domainId: newDomain.id, userId, name });

    return newDomain;
  },

  async updateDomain(
    supabase: SupabaseClient,
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      parent_id?: string | null;
      sort_order?: number;
    },
  ): Promise<DomainRecord> {
    const updates = data;

    const { data: existing, error: fetchError } = await notDeleted(supabase
      .from("domains")
      .select("*")
      .eq("id", id)
      )
      .single();

    if (fetchError || !existing) {
      throw new AppError(i18next.t("graphMap.domains.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (existing.user_id !== userId) {
      throw new AppError(i18next.t("graphMap.domains.errors.onlyOwnerCanModify"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    if (existing.is_system) {
      throw new AppError(i18next.t("graphMap.domains.errors.systemCannotModify"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    if (updates.parent_id !== undefined) {
      if (updates.parent_id === id) {
        throw new AppError(i18next.t("graphMap.domains.errors.cannotSetAsOwnChild"), 400, ErrorCodes.VALIDATION_ERROR);
      }

      if (updates.parent_id !== null) {
        const { data: parentDomain, error: parentError } = await supabase
          .from("domains")
          .select("id, user_id, is_system, deleted_at")
          .eq("id", updates.parent_id)
          .single();

        if (parentError || !parentDomain) {
          throw new AppError(i18next.t("graphMap.domains.errors.targetParentNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }

        if (parentDomain.deleted_at) {
          throw new AppError(i18next.t("graphMap.domains.errors.targetParentDeleted"), 400, ErrorCodes.VALIDATION_ERROR);
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
          i18next.t("graphMap.domains.errors.nameAlreadyExists"),
          409,
          ErrorCodes.DATABASE_DUPLICATE_ENTRY,
        );
      }
      logger.error("更新领域失败", { error: error.message, domainId: id, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.updateFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    logger.info("更新领域成功", { domainId: id, userId });

    return updated;
  },

  async deleteDomain(
    supabase: SupabaseClient,
    id: string,
    userId: string,
  ): Promise<void> {
    const { data: existing, error: fetchError } = await notDeleted(supabase
      .from("domains")
      .select("*")
      .eq("id", id)
      )
      .single();

    if (fetchError || !existing) {
      throw new AppError(i18next.t("graphMap.domains.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (existing.user_id !== userId) {
      throw new AppError(i18next.t("graphMap.domains.errors.onlyOwnerCanDelete"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    if (existing.is_system) {
      throw new AppError(i18next.t("graphMap.domains.errors.systemCannotDelete"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const { error } = await supabase
      .from("domains")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      logger.error("删除领域失败", { error: error.message, domainId: id, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.deleteFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    logger.info("删除领域成功（软删除）", { domainId: id, userId });
  },

  async reorderDomains(
    supabase: SupabaseClient,
    userId: string,
    items: Array<{ id: string; parent_id?: string | null; sort_order: number }>,
  ): Promise<{ success: boolean; updated_count: number }> {
    const domainIds = items.map((item) => item.id);

    const { data: domains, error } = await notDeleted(supabase
      .from("domains")
      .select("id, user_id, is_system, deleted_at")
      .in("id", domainIds)
      );

    if (error) {
      logger.error("查询领域信息失败", { error: error.message, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.queryInfoFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!domains || domains.length !== domainIds.length) {
      const foundIds = new Set(domains?.map((d) => d.id) ?? []);
      const missingIds = domainIds.filter((id) => !foundIds.has(id));
      logger.warn("部分领域不存在或已被删除", { missingIds, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.partialNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    for (const domain of domains) {
      const isOwner = domain.user_id === userId;
      const isSystem = domain.is_system;

      if (!isOwner && !isSystem) {
        logger.warn("用户尝试重排序无权访问的领域", { domainId: domain.id, userId });
        throw new AppError(i18next.t("graphMap.domains.errors.noPermissionToOperate"), 403, ErrorCodes.AUTH_FORBIDDEN);
      }
    }

    const hasCycle = detectCycle(items);
    if (hasCycle) {
      logger.warn("检测到领域循环引用", { userId, itemCount: items.length });
      throw new AppError(
        i18next.t("graphMap.domains.errors.cycleDetected"),
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    let updatedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const item of items) {
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

    logger.info("领域重排序完成", { userId, totalCount: items.length, updatedCount });

    return {
      success: true,
      updated_count: updatedCount,
    };
  },

  async generateColor(
    name: string,
    description?: string,
  ): Promise<{ color: string; reason: string }> {
    const DEFAULT_COLOR = "#6366F1";

    try {
      const provider = await getAIProviderForTask("text");

      if (!provider.hasKey) {
        logger.warn("AI 服务不可用，使用默认颜色", { name });
        return {
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        };
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
        return {
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        };
      }

      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!colorRegex.test(parsed.color)) {
        logger.warn("AI 返回的颜色格式无效，使用默认颜色", {
          name,
          color: parsed.color,
        });
        return {
          color: DEFAULT_COLOR,
          reason: "使用了默认颜色",
        };
      }

      logger.info("AI 生成领域颜色成功", { name, color: parsed.color });

      return {
        color: parsed.color,
        reason: parsed.reason || "",
      };
    } catch (error) {
      const err = error as Error;
      logger.error("AI 生成领域颜色失败", { error: err.message, name });
      return {
        color: DEFAULT_COLOR,
        reason: "使用了默认颜色",
      };
    }
  },

  async recommendDomains(
    supabase: SupabaseClient,
    userId: string,
    title: string,
    description?: string,
  ): Promise<{
    recommendations: Array<{
      id: string;
      name: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    const { data: domains, error } = await notDeleted(supabase
      .from("domains")
      .select("id, name, description, color")
      .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
      );

    if (error) {
      logger.error("获取领域列表失败", { error: error.message, userId });
      throw new AppError(i18next.t("graphMap.domains.errors.fetchListFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!domains || domains.length === 0) {
      return { recommendations: [] };
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
          throw new Error(i18next.t("graphMap.domains.errors.extractJsonFailed"));
        }
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.warn("AI 推荐响应解析失败", { response, error: parseError instanceof Error ? parseError.message : String(parseError) });
        return { recommendations: [] };
      }

      const validDomainIds = new Set(domains.map((d) => d.id));
      const validRecommendations = parsed
        .filter((rec) => validDomainIds.has(rec.id))
        .slice(0, 5);

      return { recommendations: validRecommendations };
    } catch (error) {
      logger.warn("AI 领域推荐服务不可用，返回空数组", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return { recommendations: [] };
    }
  },

  async ensureUncategorizedDomain(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<string> {
    return ensureUncategorizedDomain(supabase, userId);
  },
};

export type { DomainRecord, DomainTreeNode };
