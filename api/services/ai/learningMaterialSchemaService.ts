// =====================================================
// Learning Material Schema Service
// =====================================================
// 管理学习材料章节配置方案的 CRUD，以及按作用域优先级解析

import { SupabaseClient } from "@supabase/supabase-js";
import {
  type LearningMaterialSchema,
  type LearningMaterialSchemaCreate,
  type LearningMaterialSchemaUpdate,
  type LearningMaterialSection,
  type LearningSchemaScope,
  parseSections,
} from "@shared/types";
import { cacheService, CacheKeys } from "../common/cacheService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "@shared/types/errorCodes";

/** 将数据库行转为强类型对象 */
function mapRow(row: Record<string, unknown>): LearningMaterialSchema {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    scope: (row.scope as LearningSchemaScope) ?? "system",
    user_id: (row.user_id as string | null) ?? null,
    graph_id: (row.graph_id as string | null) ?? null,
    sections: parseSections(row.sections as import("@shared/types/database.generated").Json | null | undefined),
    is_default: Boolean(row.is_default ?? false),
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

export class LearningMaterialSchemaService {
  /**
   * 列出用户/图谱可用的所有章节配置方案
   * 包含：system 全部 + 该 user 的 + 该 graph 的
   */
  async list(
    supabase: SupabaseClient,
    userId: string,
    options: { graphId?: string } = {},
  ): Promise<LearningMaterialSchema[]> {
    const { graphId } = options;
    const orConditions: string[] = ["scope.eq.system"];
    orConditions.push(`and(scope.eq.user,user_id.eq.${userId})`);
    if (graphId) {
      orConditions.push(`and(scope.eq.graph,graph_id.eq.${graphId})`);
    }

    const cacheKey = CacheKeys.LEARNING_SCHEMA_LIST(userId, graphId ?? "none");
    return cacheService.getOrSet<LearningMaterialSchema[]>(
      cacheKey,
      async () => {
        const { data, error } = await supabase
          .from("learning_material_schemas")
          .select("*")
          .or(orConditions.join(","))
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data ?? []).map(mapRow);
      },
      300,
    );
  }

  /** 获取单个 schema */
  async get(
    supabase: SupabaseClient,
    id: string,
  ): Promise<LearningMaterialSchema | null> {
    return cacheService.getOrSet<LearningMaterialSchema | null>(
      CacheKeys.LEARNING_SCHEMA(id),
      async () => {
        const { data, error } = await supabase
          .from("learning_material_schemas")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          if (error.code === "PGRST116") return null;
          throw error;
        }
        return data ? mapRow(data) : null;
      },
      60,
    );
  }

  /**
   * 按作用域优先级解析"应使用哪个 schema"
   * 优先级：graph 级默认 → user 级默认 → system 级默认
   */
  async resolveEffectiveSchema(
    supabase: SupabaseClient,
    userId: string,
    graphId?: string,
  ): Promise<LearningMaterialSchema | null> {
    const schemas = await this.list(supabase, userId, { graphId });
    if (schemas.length === 0) return null;

    // 1) graph 级默认
    if (graphId) {
      const graphDefault = schemas.find(
        (s) => s.scope === "graph" && s.graph_id === graphId && s.is_default,
      );
      if (graphDefault) return graphDefault;
    }
    // 2) user 级默认
    const userDefault = schemas.find(
      (s) => s.scope === "user" && s.user_id === userId && s.is_default,
    );
    if (userDefault) return userDefault;
    // 3) system 级默认
    const systemDefault = schemas.find((s) => s.scope === "system" && s.is_default);
    if (systemDefault) return systemDefault;
    // 4) 兜底返回第一个
    return schemas[0] ?? null;
  }

  /** 创建 schema */
  async create(
    supabase: SupabaseClient,
    userId: string,
    data: LearningMaterialSchemaCreate,
  ): Promise<LearningMaterialSchema> {
    this.validateSections(data.sections);
    const insertPayload: Record<string, unknown> = {
      name: data.name.trim(),
      description: data.description ?? null,
      scope: data.scope,
      user_id: userId,
      graph_id: data.scope === "graph" ? data.graph_id ?? null : null,
      sections: data.sections as unknown as Record<string, unknown>[],
      is_default: data.is_default ?? false,
    };

    // scope=graph 必须提供 graph_id
    if (data.scope === "graph" && !insertPayload.graph_id) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "graph 级配置必须提供 graph_id",
      });
    }

    const { data: inserted, error } = await supabase
      .from("learning_material_schemas")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505" && /default_unique/.test(error.message || "")) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, {
          message: "该作用域下已存在默认配置，先取消其他默认再设置",
        });
      }
      throw error;
    }
    this.invalidateCaches(userId, data.scope === "graph" ? data.graph_id : undefined);
    return mapRow(inserted as Record<string, unknown>);
  }

  /** 更新 schema */
  async update(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    data: LearningMaterialSchemaUpdate,
  ): Promise<LearningMaterialSchema> {
    const existing = await this.get(supabase, id);
    if (!existing) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: "配置不存在" });
    }
    if (existing.scope !== "system" && existing.user_id !== userId) {
      throw new AppError(ErrorCodes.AUTH_FORBIDDEN, {
        message: "无权修改他人的配置",
      });
    }
    if (existing.scope === "system") {
      throw new AppError(ErrorCodes.AUTH_FORBIDDEN, {
        message: "系统预设配置不允许修改，请另存为自定义配置",
      });
    }

    if (data.sections) this.validateSections(data.sections);

    const updatePayload: Record<string, unknown> = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.sections !== undefined
        ? { sections: data.sections as unknown as Record<string, unknown>[] }
        : {}),
      ...(data.is_default !== undefined ? { is_default: data.is_default } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from("learning_material_schemas")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505" && /default_unique/.test(error.message || "")) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, {
          message: "该作用域下已存在默认配置，先取消其他默认再设置",
        });
      }
      throw error;
    }
    this.invalidateCaches(userId, existing.graph_id ?? undefined);
    return mapRow(updated as Record<string, unknown>);
  }

  /** 删除 schema */
  async delete(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<void> {
    const existing = await this.get(supabase, id);
    if (!existing) return;
    if (existing.scope === "system") {
      throw new AppError(ErrorCodes.AUTH_FORBIDDEN, {
        message: "系统预设配置不允许删除",
      });
    }
    if (existing.user_id !== userId) {
      throw new AppError(ErrorCodes.AUTH_FORBIDDEN, {
        message: "无权删除他人的配置",
      });
    }
    const { error } = await supabase
      .from("learning_material_schemas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    this.invalidateCaches(userId, existing.graph_id ?? undefined);
  }

  /** 校验 sections 数据 */
  private validateSections(sections: LearningMaterialSection[] | undefined): void {
    if (!Array.isArray(sections)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "sections 必须是数组",
      });
    }
    if (sections.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: "至少需要一个章节",
      });
    }
    const ids = new Set<string>();
    sections.forEach((sec, idx) => {
      if (!sec.id || typeof sec.id !== "string") {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, {
          message: `第 ${idx + 1} 个章节缺少合法 id`,
        });
      }
      if (ids.has(sec.id)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, {
          message: `章节 id 重复: ${sec.id}`,
        });
      }
      ids.add(sec.id);
      if (!sec.title || typeof sec.title !== "string" || !sec.title.trim()) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, {
          message: `第 ${idx + 1} 个章节标题不能为空`,
        });
      }
      if (!sec.instruction || typeof sec.instruction !== "string" || !sec.instruction.trim()) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, {
          message: `第 ${idx + 1} 个章节(${sec.title})缺少写作指令`,
        });
      }
    });
  }

  /** 清理缓存 */
  private invalidateCaches(userId: string, graphId?: string): void {
    cacheService
      .del(CacheKeys.LEARNING_SCHEMA_LIST(userId, graphId ?? "none"))
      .catch(() => {
        /* ignore */
      });
    cacheService
      .del(CacheKeys.LEARNING_SCHEMA_LIST(userId, "none"))
      .catch(() => {
        /* ignore */
      });
  }
}

export const learningMaterialSchemaService = new LearningMaterialSchemaService();
