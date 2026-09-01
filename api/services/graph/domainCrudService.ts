import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';
import i18next from "i18next";
import {
  buildTree,
  detectCycle,
  ensureUncategorizedDomain,
  UNCATEGORIZED_DOMAIN_ICON,
  UNCATEGORIZED_DOMAIN_COLOR,
  UNCATEGORIZED_DOMAIN_NAME,
  UNCATEGORIZED_DOMAIN_DESCRIPTION,
  type DomainRecord,
  type DomainTreeNode,
} from "./domainShared";

/**
 * 领域 CRUD 服务：领域树、详情、增删改、重排序与「未分类」系统领域兜底。
 */
export class DomainCrudService {
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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  ensureUncategorizedDomain(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<string> {
    return ensureUncategorizedDomain(supabase, userId);
  }
}
