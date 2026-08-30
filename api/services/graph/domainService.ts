import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { aiService } from "../ai/aiService";
import { getAIProviderForTask } from "../ai/factory";
import { promptService } from "../ai/promptService";
import { notDeleted } from '../common/softDeleteHelper';
import { cacheService, CacheKeys } from "../common/cacheService";
import i18next from "i18next";

// 余弦相似度：用于领域名 embedding 语义去重
function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

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

// 自动分类：候选领域（一个图谱可同时出现在多个领域，多对多）
export interface AutoClassifiedDomain {
  suggestion_id: string;
  name: string;
  description: string;
  graph_ids: string[];
  graph_titles: string[];
}

export interface AutoClassifyGraphInfo {
  id: string;
  title: string;
  description: string;
  existing_domains: string[];
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
// 后端 i18next 无翻译资源，i18next.t() 对缺失 key 会原样返回 key 字符串，
// 不能用于写入数据库的文案；系统内置领域文案用常量硬编码（与路由一致）。
const UNCATEGORIZED_DOMAIN_NAME = "未分类";
const UNCATEGORIZED_DOMAIN_DESCRIPTION = "未归类到任何领域的图谱";

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
      name: UNCATEGORIZED_DOMAIN_NAME,
      description: UNCATEGORIZED_DOMAIN_DESCRIPTION,
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
        name: UNCATEGORIZED_DOMAIN_NAME,
        description: UNCATEGORIZED_DOMAIN_DESCRIPTION,
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

    // 单次 upsert 完成整批排序更新（行已预检存在，onConflict 走 UPDATE 路径，替代逐条 N 次往返）
    const { error: upsertError } = await supabase
      .from("domains")
      .upsert(
        items.map((item) => ({
          id: item.id,
          parent_id: item.parent_id ?? null,
          sort_order: item.sort_order,
        })),
        { onConflict: "id" },
      );

    if (upsertError) {
      logger.error("更新领域排序失败", {
        error: upsertError.message,
        userId,
        itemCount: items.length,
      });
      throw new AppError(
        i18next.t("graphMap.domains.errors.updateFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    const updatedCount = items.length;

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
          throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, { message: i18next.t("graphMap.domains.errors.extractJsonFailed") });
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

  async autoClassifyGraphs(
    supabase: SupabaseClient,
    userId: string,
    options?: { graph_ids?: string[]; max_domains?: number },
  ): Promise<{ domains: AutoClassifiedDomain[]; graphs: AutoClassifyGraphInfo[] }> {
    let query = notDeleted(
      supabase
        .from("knowledge_graphs")
        .select("id, title, description")
        .eq("user_id", userId),
    );
    if (options?.graph_ids && options.graph_ids.length > 0) {
      query = query.in("id", options.graph_ids);
    }
    const { data: graphs, error } = await query.order("created_at", {
      ascending: true,
    });

    if (error) {
      logger.error("自动分类：查询图谱失败", { error: error.message, userId });
      throw new AppError(
        i18next.t("graphMap.api.errors.queryGraphFailed"),
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    const graphList = (graphs || []).filter(
      (g) => typeof g.title === "string" && g.title.length > 0,
    ) as Array<{ id: string; title: string; description: string | null }>;

    if (graphList.length === 0) {
      return { domains: [], graphs: [] };
    }

    // 已有关联领域（多对多），用于前端展示，避免与既有领域重复
    const graphIdList = graphList.map((g) => g.id);
    const { data: graphDomains } = await supabase
      .from("graph_domains")
      .select("graph_id, domain_id")
      .in("graph_id", graphIdList);

    const domainIds = Array.from(
      new Set((graphDomains || []).map((gd) => gd.domain_id)),
    );
    const { data: domainRows } =
      domainIds.length > 0
        ? await supabase
            .from("domains")
            .select("id, name")
            .in("id", domainIds)
        : { data: [] as Array<{ id: string; name: string }> };

    const domainNameById = new Map(
      (domainRows || []).map((d) => [d.id, d.name]),
    );
    const existingByGraph = new Map<string, string[]>();
    (graphDomains || []).forEach((gd) => {
      const name = domainNameById.get(gd.domain_id);
      if (!name) return;
      const list = existingByGraph.get(gd.graph_id) || [];
      list.push(name);
      existingByGraph.set(gd.graph_id, list);
    });

    const graphsInfo: AutoClassifyGraphInfo[] = graphList.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description || "",
      existing_domains: existingByGraph.get(g.id) || [],
    }));

    // 图谱过多时截断，避免单次 prompt 过大
    const MAX_GRAPHS = 300;
    const sample = graphsInfo.slice(0, MAX_GRAPHS);

    const maxDomains =
      options?.max_domains ??
      Math.min(15, Math.max(3, Math.ceil(sample.length / 3)));

    const graphLines = sample
      .map(
        (g, i) =>
          `${i}. ${g.title}${g.description ? ` | ${g.description.slice(0, 200)}` : ""}`,
      )
      .join("\n");

    const provider = await getAIProviderForTask("text");
    if (!provider.hasKey) {
      logger.warn("自动分类：AI 服务不可用，返回空候选", { userId });
      return { domains: [], graphs: graphsInfo };
    }

    // 提示词由 promptService 统一管理（数据库权威源，可在设置中编辑），
    // 缺失时回退到 DEFAULT_PROMPTS['auto_domain_classify'] 兜底
    let systemPrompt: string;
    try {
      systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "auto_domain_classify",
        { graphList: graphLines, maxDomains },
        userId,
      );
    } catch (promptError) {
      logger.warn("自动分类：加载提示词失败，使用空内容", {
        error:
          promptError instanceof Error ? promptError.message : String(promptError),
      });
      systemPrompt = "";
    }

    if (!systemPrompt) {
      logger.warn("自动分类：未获取到提示词，返回空候选", { userId });
      return { domains: [], graphs: graphsInfo };
    }

    try {
      const response = await aiService.chat(
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: "请根据以上图谱列表按主题进行聚类分类，只输出 JSON 数组。",
          },
        ],
        { timeout: 60000 },
      );

      let parsed: Array<{
        name: string;
        description: string;
        graph_indices: unknown;
      }>;
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return { domains: [], graphs: graphsInfo };
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.warn("自动分类：AI 响应解析失败", {
          rawResponse: response.slice(0, 300),
          error:
            parseError instanceof Error ? parseError.message : String(parseError),
        });
        return { domains: [], graphs: graphsInfo };
      }

      const indexSet = new Set(sample.map((_, i) => i));
      const domains: AutoClassifiedDomain[] = [];
      parsed.forEach((candidate, idx) => {
        if (
          !candidate ||
          typeof candidate.name !== "string" ||
          candidate.name.trim().length < 2
        ) {
          return;
        }
        const indices = Array.isArray(candidate.graph_indices)
          ? (candidate.graph_indices as unknown[])
              .map((n) => Number(n))
              .filter((n) => indexSet.has(n))
          : [];
        const uniqueIndices = Array.from(new Set(indices));
        if (uniqueIndices.length === 0) return;
        const assigned = uniqueIndices.map((i) => sample[i]);
        domains.push({
          suggestion_id: String(idx),
          name: candidate.name.trim().slice(0, 200),
          description: (candidate.description || "").trim().slice(0, 1000),
          graph_ids: assigned.map((g) => g.id),
          graph_titles: assigned.map((g) => g.title),
        });
      });

      // 领域至少要包含足够图谱才建议为独立领域，避免单薄领域泛滥
      const MIN_GRAPHS_PER_DOMAIN = 4;
      const validDomains = domains
        .filter((d) => d.graph_ids.length >= MIN_GRAPHS_PER_DOMAIN)
        .slice(0, maxDomains);
      if (domains.length !== validDomains.length) {
        logger.info("自动分类：过滤掉图谱数过少的候选领域", {
          before: domains.length,
          after: validDomains.length,
          minGraphs: MIN_GRAPHS_PER_DOMAIN,
          userId,
        });
      }

      return { domains: validDomains, graphs: graphsInfo };
    } catch (error) {
      logger.warn("自动分类：AI 服务调用失败，返回空候选", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return { domains: [], graphs: graphsInfo };
    }
  },

  async applyClassifiedDomains(
    supabase: SupabaseClient,
    userId: string,
    items: Array<{
      name: string;
      description?: string;
      color?: string;
      graph_ids: string[];
    }>,
  ): Promise<{
    created: Array<{ id: string; name: string; graphCount: number }>;
  }> {
    const created: Array<{ id: string; name: string; graphCount: number }> =
      [];

    const { data: ownedRows } = await notDeleted(
      supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("user_id", userId),
    );
    const ownedIds = new Set((ownedRows || []).map((g) => g.id));

    // 领域语义去重：预取用户已有领域，用 embedding 余弦相似度判断候选是否与现有领域重复
    const SIMILARITY_THRESHOLD = 0.85;
    const { data: existingDomainsRows } = await notDeleted(
      supabase
        .from("domains")
        .select("id, name"),
    );
    const existingDomains = (existingDomainsRows || []).filter(
      (d) =>
        typeof d.name === "string" && (d.name as string).trim().length > 0,
    ) as Array<{ id: string; name: string }>;
    const domainVecCache = new Map<string, number[]>();
    const getDomainVec = async (name: string): Promise<number[] | null> => {
      const cached = domainVecCache.get(name);
      if (cached) return cached;
      const vec = await aiService.generateEmbedding(name);
      if (vec) domainVecCache.set(name, vec);
      return vec;
    };

    for (const item of items) {
      const name = item.name.trim();
      if (name.length < 2) continue;

      const validGraphIds = Array.from(
        new Set((item.graph_ids || []).filter((id) => ownedIds.has(id))),
      );

      // 1) 尝试语义去重：候选名与已有领域名高度相似 → 复用该领域，仅追加关联
      let reusedDomainId = "";
      let reusedDomainName = "";
      try {
        const candidateVec = await aiService.generateEmbedding(name);
        if (candidateVec) {
          let bestSim = 0;
          for (const ed of existingDomains) {
            const edVec = await getDomainVec(ed.name);
            if (!edVec) continue;
            const sim = cosineSimilarity(candidateVec, edVec);
            if (sim > bestSim) {
              bestSim = sim;
              reusedDomainId = ed.id;
              reusedDomainName = ed.name;
            }
          }
          if (bestSim < SIMILARITY_THRESHOLD) {
            reusedDomainId = "";
          } else {
            logger.info("自动分类：嵌入去重命中，复用已有领域", {
              candidate: name,
              existing: reusedDomainName,
              similarity: bestSim,
              userId,
            });
          }
        } else {
          reusedDomainId = "";
        }
      } catch (embedError) {
        // embedding 服务不可用时不强行去重，退回新建
        logger.warn("自动分类：领域去重嵌入失败，转为新建", {
          error: embedError instanceof Error ? embedError.message : String(embedError),
          name,
          userId,
        });
        reusedDomainId = "";
      }

      if (reusedDomainId) {
        if (validGraphIds.length > 0) {
          const rows = validGraphIds.map((graphId) => ({
            graph_id: graphId,
            domain_id: reusedDomainId,
            is_primary: false,
          }));
          const { error } = await supabase
            .from("graph_domains")
            .upsert(rows, { onConflict: "graph_id,domain_id" });
          if (error) {
            logger.error("自动分类：复用领域建立图谱-领域关联失败", {
              error: error.message,
              domainId: reusedDomainId,
              userId,
            });
            throw new AppError(
              i18next.t("graphMap.domainPicker.setFailed"),
              500,
              ErrorCodes.SYSTEM_INTERNAL_ERROR,
            );
          }
        }
        created.push({
          id: reusedDomainId,
          name: reusedDomainName,
          graphCount: validGraphIds.length,
        });
        continue;
      }

      // 2) 无重复 → 新建领域并归类
      let color = item.color;
      if (!color) {
        color = (await this.generateColor(name, item.description || undefined))
          .color;
      }

      const domain = await this.createDomain(supabase, userId, {
        name,
        color,
        description: item.description?.trim() || undefined,
      });

      if (validGraphIds.length > 0) {
        const rows = validGraphIds.map((graphId) => ({
          graph_id: graphId,
          domain_id: domain.id,
          is_primary: false,
        }));
        const { error } = await supabase
          .from("graph_domains")
          .upsert(rows, { onConflict: "graph_id,domain_id" });

        if (error) {
          logger.error("自动分类：建立图谱-领域关联失败", {
            error: error.message,
            domainId: domain.id,
            userId,
          });
          throw new AppError(
            i18next.t("graphMap.domainPicker.setFailed"),
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }
      }

      created.push({
        id: domain.id,
        name: domain.name,
        graphCount: validGraphIds.length,
      });
    }

    // 使后端图谱地图/领域缓存失效，前端重新拉取到含新领域关联的最新数据
    try {
      await cacheService.del([
        CacheKeys.GRAPH_MAP(userId),
        CacheKeys.GRAPH_DOMAINS(userId),
      ]);
    } catch (cacheError) {
      logger.warn("自动分类：清理图谱地图缓存失败", {
        error:
          cacheError instanceof Error ? cacheError.message : String(cacheError),
        userId,
      });
    }

    return { created };
  },

  async ensureUncategorizedDomain(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<string> {
    return ensureUncategorizedDomain(supabase, userId);
  },
};

export type { DomainRecord, DomainTreeNode };
