import { SupabaseClient } from "@supabase/supabase-js";
import { cacheService, CacheKeys, CacheTTL } from "../common/cacheService";
import {
  buildNodeFromGraphNode,
  GRAPH_NODES_SELECT,
  GRAPH_NODES_SELECT_WITH_EMBEDDING,
} from "../../utils/nodeHelpers";
import { softDelete } from "../../utils/softDelete";
import { logger } from "../../utils/logger";
import { getLevelIndex } from "../../utils/levelUtils";
import { withRpcFallback } from "../../utils/rpcFallback";
import {
  checkDuplicateGraphTopic,
  GraphTopicCheckResult,
} from "../../utils/similaritySearch";
import { aiService } from "../ai/index";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getSupabaseAdmin } from "../../supabase";
import type { CollaboratorRole, GraphWithCollaborators } from "@shared/types";
import type { NodeStatus } from "@shared/types/graph";
import type { StudyCardRow, KnowledgeGraphRow } from "@shared/types/database";
import {
  PRESET_MAP,
  ACADEMIC_RESEARCH,
} from "@shared/constants/backboneModulePresets";
import { appEventBus } from "../core/eventBus";
import { smartTaskLinker } from "../scheduler/smartTaskLinker";
import { graphVersionService } from "./graphVersionService";
import { transactionExecutor } from "../../database/transactionExecutor";
import type {
  GraphCreatedPayload,
  GraphUpdatedPayload,
  GraphDeletedPayload,
} from "@shared/types/events";

interface KnowledgePointWithProperties {
  properties?: {
    tags?: string[];
  };
}

interface GraphNodeWithKnowledgePointData {
  graph_id: string;
  knowledge_points: KnowledgePointWithProperties | KnowledgePointWithProperties[] | null;
}

interface GraphWithCount {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  nodes_count: number;
  template_type?: string;
  tags?: string[];
}

interface GraphNodeForCombined {
  graph_id: string;
  knowledge_point_id: string;
  knowledge_points: KnowledgePointWithProperties | KnowledgePointWithProperties[] | null;
}

interface EdgeForCombined {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type: string;
  weight: number;
}

interface SharedKnowledgePoint {
  knowledge_point_id: string;
  knowledge_point: KnowledgePointWithProperties | KnowledgePointWithProperties[] | null;
  graph_nodes: GraphNodeForCombined[];
}

/**
 * 图谱服务
 *
 * 提供知识图谱的 CRUD 操作、缓存管理、事件发布等功能。
 * 支持图谱的创建、更新、删除、恢复、永久删除等操作，
 * 并自动处理缓存失效和事件通知。
 *
 * ## 主要功能
 *
 * - 图谱列表查询（支持缓存）
 * - 图谱创建（含主题重复检测）
 * - 图谱更新（含嵌入向量更新）
 * - 图谱删除/恢复（软删除机制）
 * - 图谱节点查询
 * - 图谱分析（统计、连接建议）
 *
 * @example
 * ```typescript
 * const graphService = new GraphService();
 *
 * // 创建图谱
 * const graph = await graphService.createGraph(supabase, userId, '我的图谱');
 *
 * // 获取图谱列表
 * const graphs = await graphService.listGraphs(supabase, userId);
 *
 * // 更新图谱
 * await graphService.updateGraph(supabase, graphId, userId, { title: '新标题' });
 * ```
 */
export class GraphService {
  /**
   * 获取用户的图谱列表
   *
   * 返回用户的所有图谱，包含节点数量和标签信息。
   * 结果会被缓存以提高性能。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @returns 图谱列表，包含节点数量
   *
   * @example
   * ```typescript
   * const graphs = await graphService.listGraphs(supabase, 'user-123');
   * console.log(graphs[0].nodes_count); // 节点数量
   * ```
   */
  async listGraphs(supabase: SupabaseClient, userId: string) {
    const cacheKey = CacheKeys.USER_GRAPHS(userId);

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        return withRpcFallback<GraphWithCount[]>(supabase, {
          rpcName: "get_user_graphs_with_counts",
          rpcParams: { p_user_id: userId },
          fallbackFn: () => this.listGraphsFallback(supabase, userId),
        });
      },
      CacheTTL.DYNAMIC,
      [`user:${userId}`],
    );
  }

  private async listGraphsFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("is_favorite", { ascending: false })
      .order("last_used_at", { ascending: false });

    if (error) throw error;

    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const [nodeCountsResult, graphNodesDataResult] = await Promise.all([
      supabase
        .from("graph_nodes")
        .select("graph_id")
        .in("graph_id", graphIds)
        .is("deleted_at", null),
      supabase
        .from("graph_nodes")
        .select(
          `
          graph_id,
          knowledge_points (
            properties
          )
        `,
        )
        .in("graph_id", graphIds)
        .is("deleted_at", null),
    ]);

    const countMap = new Map<string, number>();
    nodeCountsResult.data?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });

    const tagsMap = new Map<string, Set<string>>();
    graphNodesDataResult.data?.forEach(
      (gn: GraphNodeWithKnowledgePointData) => {
        const kp = Array.isArray(gn.knowledge_points) ? gn.knowledge_points[0] : gn.knowledge_points;
        const tags = kp?.properties?.tags || [];
        if (!tagsMap.has(gn.graph_id)) {
          tagsMap.set(gn.graph_id, new Set());
        }
        tags.forEach((tag: string) => tagsMap.get(gn.graph_id)!.add(tag));
      },
    );

    return (graphs?.map((g: Record<string, unknown>) => ({
      id: g.id as string,
      user_id: g.user_id as string,
      title: g.title as string,
      description: g.description as string | null,
      is_public: g.is_public as boolean,
      is_favorite: g.is_favorite as boolean,
      created_at: g.created_at as string,
      updated_at: g.updated_at as string,
      deleted_at: g.deleted_at as string | null,
      nodes_count: countMap.get(g.id as string) || 0,
      tags: Array.from(tagsMap.get(g.id as string) || []),
      template_type: g.template_type as string | undefined,
    })) || []) as GraphWithCount[];
  }

  /**
   * 获取回收站中的图谱列表
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @returns 已删除的图谱列表
   */
  async listTrash(supabase: SupabaseClient, userId: string) {
    return withRpcFallback<GraphWithCount[]>(supabase, {
      rpcName: "get_user_trashed_graphs",
      rpcParams: { p_user_id: userId },
      fallbackFn: () => this.listTrashFallback(supabase, userId),
    });
  }

  private async listTrashFallback(supabase: SupabaseClient, userId: string) {
    const { data: graphs, error } = await supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) throw error;

    const graphIds = graphs?.map((g: { id: string }) => g.id) || [];

    if (graphIds.length === 0) {
      return [];
    }

    const { data: nodeCounts } = await supabase
      .from("graph_nodes")
      .select("graph_id")
      .in("graph_id", graphIds)
      .is("deleted_at", null);

    const countMap = new Map<string, number>();
    nodeCounts?.forEach((n: { graph_id: string }) => {
      countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
    });

    return (graphs?.map((g: Record<string, unknown>) => ({
      id: g.id as string,
      user_id: g.user_id as string,
      title: g.title as string,
      description: g.description as string | null,
      is_public: g.is_public as boolean,
      is_favorite: g.is_favorite as boolean,
      created_at: g.created_at as string,
      updated_at: g.updated_at as string,
      deleted_at: g.deleted_at as string | null,
      nodes_count: countMap.get(g.id as string) || 0,
    })) || []) as GraphWithCount[];
  }

  /**
   * 获取单个图谱详情
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param _userId - 用户 ID（可选，用于权限验证）
   * @returns 图谱详情，如果不存在则返回 null
   */
  async getGraph(
    supabase: SupabaseClient,
    graphId: string,
    _userId: string | null,
  ) {
    const { data, error } = await supabase
      .from("knowledge_graphs")
      .select("*")
      .eq("id", graphId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      logger.error("getGraph error:", error);
      throw error;
    }

    return data;
  }

  /**
   * 更新图谱最后使用时间
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param userId - 用户 ID
   */
  async updateLastUsedAt(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    await supabase
      .from("knowledge_graphs")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", graphId)
      .eq("user_id", userId);
  }

  /**
   * 创建新图谱
   *
   * 创建图谱时会自动：
   * 1. 检测主题是否重复（可通过 skipDuplicateCheck 跳过）
   * 2. 生成标题的嵌入向量
   * 3. 创建关联的学习任务
   * 4. 发布 graph_created 事件
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @param title - 图谱标题
   * @param description - 图谱描述（可选）
   * @param options - 可选配置
   * @param options.skipDuplicateCheck - 跳过主题重复检测
   * @param options.templateType - 模板类型
   * @param options.presetId - 骨干模块预设 ID
   * @returns 创建的图谱数据
   * @throws {AppError} 如果主题重复（DUPLICATE_TOPIC）
   *
   * @example
   * ```typescript
   * const graph = await graphService.createGraph(
   *   supabase,
   *   'user-123',
   *   'TypeScript 学习笔记',
   *   '记录 TypeScript 学习过程中的知识点'
   * );
   * ```
   */
  async createGraph(
    supabase: SupabaseClient,
    userId: string,
    title: string,
    description?: string,
    options?: {
      skipDuplicateCheck?: boolean;
      templateType?: string;
      presetId?: string;
    },
  ) {
    if (!options?.skipDuplicateCheck) {
      const duplicateCheck = await checkDuplicateGraphTopic(
        supabase,
        userId,
        title,
        { threshold: 0.85 },
      );
      if (duplicateCheck.isDuplicate) {
        const similarGraph = duplicateCheck.similarGraphs[0];
        throw new AppError(
          `主题重复：与现有图谱「${similarGraph.title}」相似度为 ${(
            similarGraph.similarity * 100
          ).toFixed(1)}%`,
          400,
          ErrorCodes.DUPLICATE_TOPIC,
        );
      }
    }

    let embedding: number[] | null;
    try {
      embedding = await aiService.generateEmbedding(title);
    } catch (e) {
      logger.warn("Failed to generate embedding for graph topic:", e);
      embedding = null;
    }

    const { data, error } = await supabase
      .from("knowledge_graphs")
      .insert({
        user_id: userId,
        title,
        description: description || null,
        embedding: embedding ?? undefined,
        template_type: options?.templateType || null,
      })
      .select()
      .single();

    if (error) throw error;

    if (options?.templateType === "topic_research") {
      const preset = options?.presetId
        ? PRESET_MAP[options.presetId]
        : ACADEMIC_RESEARCH;

      if (preset) {
        const modulesToInsert = preset.modules.map((mod, index) => ({
          graph_id: data.id,
          module_type: mod.module_type,
          title: mod.title,
          icon: mod.icon,
          color: mod.color,
          display_order: index,
        }));

        const { error: modulesError } = await supabase
          .from("graph_backbone_modules")
          .insert(modulesToInsert);

        if (modulesError) {
          logger.warn(
            "[GraphService] Failed to create backbone modules:",
            modulesError,
          );
        } else {
          logger.info(
            "[GraphService] Created backbone modules for topic_research graph:",
            { graphId: data.id, presetId: preset.id },
          );
        }
      }
    }

    try {
      const taskInfo = await smartTaskLinker.getOrCreateTaskForGraph(
        supabase,
        userId,
        data.id,
      );
      logger.info("[GraphService] Created task for new graph:", {
        graphId: data.id,
        taskId: taskInfo.mainTaskId,
      });
    } catch (taskError) {
      logger.warn("[GraphService] Failed to create task for graph:", taskError);
    }

    await cacheService.invalidateUserGraphsCache(userId);

    await appEventBus.publish(
      "graph_created",
      { graphId: data.id, title, userId } as GraphCreatedPayload,
      userId,
      "graph_service",
    );

    return data;
  }

  /**
   * 检查主题是否重复
   *
   * 使用向量相似度检测是否存在相似主题的图谱。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @param topic - 要检查的主题
   * @param excludeGraphId - 排除的图谱 ID（用于更新时排除自身）
   * @returns 检查结果，包含是否重复和相似图谱列表
   */
  async checkTopicDuplicate(
    supabase: SupabaseClient,
    userId: string,
    topic: string,
    excludeGraphId?: string,
  ): Promise<GraphTopicCheckResult> {
    return checkDuplicateGraphTopic(supabase, userId, topic, {
      excludeGraphId,
    });
  }

  /**
   * 更新图谱的嵌入向量
   *
   * 根据标题重新生成嵌入向量并更新到数据库。
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param title - 新标题
   */
  async updateGraphEmbedding(
    supabase: SupabaseClient,
    graphId: string,
    title: string,
  ) {
    try {
      const embedding = await aiService.generateEmbedding(title);
      if (embedding) {
        await supabase
          .from("knowledge_graphs")
          .update({ embedding })
          .eq("id", graphId);
      }
    } catch (e) {
      logger.warn("Failed to update graph embedding:", e);
    }
  }

  /**
   * 更新图谱信息
   *
   * 更新图谱的标题、描述、可见性等信息。
   * 如果更新标题，会自动检测重复并更新嵌入向量。
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param userId - 用户 ID
   * @param updates - 要更新的字段
   * @param updates.title - 新标题
   * @param updates.description - 新描述
   * @param updates.is_public - 是否公开
   * @param updates.reference_books - 参考书籍
   * @param updates.external_links - 外部链接
   * @param updates.learning_guide - 学习指南
   * @returns 更新后的图谱数据
   * @throws {AppError} 如果标题重复（DUPLICATE_TOPIC）
   *
   * @example
   * ```typescript
   * await graphService.updateGraph(supabase, graphId, userId, {
   *   title: '新标题',
   *   is_public: true
   * });
   * ```
   */
  async updateGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      is_public?: boolean;
      reference_books?: unknown;
      external_links?: unknown;
      learning_guide?: string;
    },
  ) {
    if (updates.title) {
      const duplicateCheck = await checkDuplicateGraphTopic(
        supabase,
        userId,
        updates.title,
        {
          excludeGraphId: graphId,
        },
      );
      if (duplicateCheck.isDuplicate) {
        const similarGraph = duplicateCheck.similarGraphs[0];
        throw new AppError(
          `主题重复：与现有图谱「${similarGraph.title}」相似度为 ${(
            similarGraph.similarity * 100
          ).toFixed(1)}%`,
          400,
          ErrorCodes.DUPLICATE_TOPIC,
        );
      }
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.title) {
      try {
        const embedding = await aiService.generateEmbedding(updates.title);
        if (embedding) {
          updateData.embedding = embedding;
        }
      } catch (e) {
        logger.warn("Failed to generate embedding for updated graph topic:", e);
      }
    }

    const { data, error } = await supabase
      .from("knowledge_graphs")
      .update(updateData)
      .eq("id", graphId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    await cacheService.invalidateGraphCache(userId, graphId);

    await graphVersionService.recordEvent(
      supabase,
      graphId,
      'graph_updated',
      {
        changes: updates,
      },
      userId,
    ).catch(err => logger.error('Record graph_updated event error:', err));

    await appEventBus.publish(
      "graph_updated",
      { graphId, userId, changes: updates } as GraphUpdatedPayload,
      userId,
      "graph_service",
    );

    return data;
  }

  /**
   * 切换图谱收藏状态
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param userId - 用户 ID
   * @param isFavorite - 是否收藏
   * @returns 更新后的图谱数据
   */
  async toggleFavorite(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    isFavorite: boolean,
  ) {
    const { data, error } = await supabase
      .from("knowledge_graphs")
      .update({
        is_favorite: isFavorite,
        updated_at: new Date().toISOString(),
      })
      .eq("id", graphId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    await cacheService.invalidateUserGraphsCache(userId);

    await appEventBus.publish(
      "graph_updated",
      { graphId, userId } as GraphUpdatedPayload,
      userId,
      "graph_service",
    );

    return data;
  }

  /**
   * 删除图谱（软删除）
   *
   * 将图谱移动到回收站，不会真正删除数据。
   * 可以通过 restoreGraph 恢复。
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param userId - 用户 ID
   * @throws {AppError} 如果图谱不存在（RESOURCE_GRAPH_NOT_FOUND）
   */
  async deleteGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    try {
      const { error } = await supabase.rpc('soft_delete_graph_with_branches', {
        p_graph_id: graphId,
        p_user_id: userId,
      });
      if (error) throw error;

      // RPC succeeded — publish events and invalidate cache
      const { data: branches } = await supabase
        .from("knowledge_graphs")
        .select("id")
        .eq("parent_graph_id", graphId)
        .eq("is_branch", true)
        .not("deleted_at", "is", null);

      for (const branch of branches ?? []) {
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }

      await cacheService.invalidateAllGraphRelated(userId, graphId);

      await appEventBus.publish(
        "graph_deleted",
        { graphId, userId } as GraphDeletedPayload,
        userId,
        "graph_service",
      );

      return;
    } catch (rpcError) {
      logger.warn('RPC soft_delete_graph_with_branches failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: transactional sequential implementation
    if (transactionExecutor.isAvailable()) {
      try {
        const branchIds = await transactionExecutor.executeInTransaction(async (client) => {
          const { rows: branches } = await client.query(
            `SELECT id FROM knowledge_graphs WHERE parent_graph_id = $1 AND is_branch = true AND deleted_at IS NULL`,
            [graphId],
          );

          if (branches.length > 0) {
            const ids = branches.map((b: { id: string }) => b.id);
            await client.query(
              `UPDATE knowledge_graphs SET deleted_at = $1 WHERE id = ANY($2)`,
              [new Date().toISOString(), ids],
            );
            return ids;
          }
          return [];
        });

        for (const branchId of branchIds) {
          await appEventBus.publish(
            "graph_deleted",
            { graphId: branchId, userId } as GraphDeletedPayload,
            userId,
            "graph_service",
          );
        }

        const result = await softDelete(supabase, "knowledge_graphs", graphId);
        if (!result.success) {
          throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
        }

        await cacheService.invalidateAllGraphRelated(userId, graphId);

        await appEventBus.publish(
          "graph_deleted",
          { graphId, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );

        return;
      } catch (txError) {
        logger.warn('Transaction failed in deleteGraph fallback, falling back to non-transactional operations', { error: txError });
      }
    } else {
      logger.warn('TransactionExecutor not available, using non-transactional fallback for deleteGraph');
    }

    // Non-transactional fallback
    const { data: branches } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("parent_graph_id", graphId)
      .eq("is_branch", true)
      .is("deleted_at", null);

    if (branches && branches.length > 0) {
      const branchIds = branches.map((b: { id: string }) => b.id);
      await supabase
        .from("knowledge_graphs")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", branchIds);

      for (const branch of branches) {
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }
    }

    const result = await softDelete(supabase, "knowledge_graphs", graphId);
    if (!result.success) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    await cacheService.invalidateAllGraphRelated(userId, graphId);

    await appEventBus.publish(
      "graph_deleted",
      { graphId, userId } as GraphDeletedPayload,
      userId,
      "graph_service",
    );
  }

  /**
   * 批量删除图谱（软删除）
   *
   * @param supabase - Supabase 客户端
   * @param graphIds - 图谱 ID 数组
   * @param userId - 用户 ID
   * @returns 删除的图谱数量
   */
  async deleteGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    // Get branch IDs before RPC for event publishing
    const { data: allBranches } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .in("parent_graph_id", graphIds)
      .eq("is_branch", true)
      .is("deleted_at", null);

    try {
      const { data, error } = await supabase.rpc('batch_soft_delete_graphs', {
        p_graph_ids: graphIds,
        p_user_id: userId,
      });
      if (error) throw error;

      // RPC succeeded — publish events and invalidate cache
      for (const branch of allBranches ?? []) {
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }

      await cacheService.invalidateUserGraphsCache(userId);

      for (const id of graphIds) {
        await appEventBus.publish(
          "graph_deleted",
          { graphId: id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }

      return { count: (data as { graph_count: number })?.graph_count ?? graphIds.length };
    } catch (rpcError) {
      logger.warn('RPC batch_soft_delete_graphs failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: original sequential implementation
    const { data, error } = await supabase
      .from("knowledge_graphs")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", graphIds)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;

    if (allBranches && allBranches.length > 0) {
      const branchIds = allBranches.map((b: { id: string }) => b.id);
      await supabase
        .from("knowledge_graphs")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", branchIds);

      for (const branch of allBranches) {
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }
    }

    await cacheService.invalidateUserGraphsCache(userId);

    for (const id of data?.map((g: { id: string }) => g.id) || []) {
      await appEventBus.publish(
        "graph_deleted",
        { graphId: id, userId } as GraphDeletedPayload,
        userId,
        "graph_service",
      );
    }

    return { count: data?.length || 0 };
  }

  /**
   * 从回收站恢复图谱
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param userId - 用户 ID
   */
  async restoreGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    const { error } = await supabase
      .from("knowledge_graphs")
      .update({ deleted_at: null })
      .eq("id", graphId)
      .eq("user_id", userId);

    if (error) throw error;

    await cacheService.invalidateUserGraphsCache(userId);

    await appEventBus.publish(
      "graph_updated",
      { graphId, userId } as GraphUpdatedPayload,
      userId,
      "graph_service",
    );
  }

  /**
   * 永久删除图谱
   *
   * 彻底删除图谱及其所有数据，无法恢复。
   *
   * @param supabase - Supabase 客户端
   * @param graphId - 图谱 ID
   * @param userId - 用户 ID
   */
  async permanentDeleteGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    // Get branch IDs before RPC since they will be hard-deleted
    const { data: branches } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("parent_graph_id", graphId)
      .eq("is_branch", true);

    try {
      const { error } = await supabase.rpc('permanent_delete_graph', {
        p_graph_id: graphId,
        p_user_id: userId,
      });
      if (error) throw error;

      // RPC succeeded — publish events and invalidate cache
      for (const branch of branches ?? []) {
        await cacheService.invalidateAllGraphRelated(userId, branch.id);
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }

      await cacheService.invalidateAllGraphRelated(userId, graphId);

      await appEventBus.publish(
        "graph_deleted",
        { graphId, userId } as GraphDeletedPayload,
        userId,
        "graph_service",
      );

      return;
    } catch (rpcError) {
      logger.warn('RPC permanent_delete_graph failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: original sequential implementation
    if (branches && branches.length > 0) {
      const branchIds = branches.map((b: { id: string }) => b.id);
      await supabase
        .from("knowledge_graphs")
        .delete()
        .in("id", branchIds);

      for (const branch of branches) {
        await cacheService.invalidateAllGraphRelated(userId, branch.id);
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }
    }

    const { error } = await supabase
      .from("knowledge_graphs")
      .delete()
      .eq("id", graphId)
      .eq("user_id", userId);

    if (error) throw error;

    await cacheService.invalidateAllGraphRelated(userId, graphId);

    await appEventBus.publish(
      "graph_deleted",
      { graphId, userId } as GraphDeletedPayload,
      userId,
      "graph_service",
    );
  }

  /**
   * 批量恢复图谱
   *
   * @param supabase - Supabase 客户端
   * @param graphIds - 图谱 ID 数组
   * @param userId - 用户 ID
   * @returns 恢复的图谱数量
   */
  async restoreGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    const { data, error } = await supabase
      .from("knowledge_graphs")
      .update({ deleted_at: null })
      .in("id", graphIds)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;

    await cacheService.invalidateUserGraphsCache(userId);

    for (const id of data?.map((g: { id: string }) => g.id) || []) {
      await appEventBus.publish(
        "graph_updated",
        { graphId: id, userId } as GraphUpdatedPayload,
        userId,
        "graph_service",
      );
    }

    return { count: data?.length || 0 };
  }

  /**
   * 批量永久删除图谱
   *
   * @param supabase - Supabase 客户端
   * @param graphIds - 图谱 ID 数组
   * @param userId - 用户 ID
   * @returns 删除的图谱数量
   */
  async permanentDeleteGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    // Get branch IDs before RPC since they will be hard-deleted
    const { data: allBranches } = await supabase
      .from("knowledge_graphs")
      .select("id")
      .in("parent_graph_id", graphIds)
      .eq("is_branch", true);

    try {
      const { data, error } = await supabase.rpc('batch_permanent_delete_graphs', {
        p_graph_ids: graphIds,
        p_user_id: userId,
      });
      if (error) throw error;

      // RPC succeeded — publish events and invalidate cache
      for (const branch of allBranches ?? []) {
        await cacheService.invalidateAllGraphRelated(userId, branch.id);
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }

      await cacheService.invalidateUserGraphsCache(userId);

      for (const id of graphIds) {
        await appEventBus.publish(
          "graph_deleted",
          { graphId: id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }

      return { count: (data as { graph_count: number })?.graph_count ?? graphIds.length };
    } catch (rpcError) {
      logger.warn('RPC batch_permanent_delete_graphs failed, falling back to sequential operations', { error: rpcError });
    }

    // Fallback: original sequential implementation
    const { data, error } = await supabase
      .from("knowledge_graphs")
      .delete()
      .in("id", graphIds)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;

    if (allBranches && allBranches.length > 0) {
      const branchIds = allBranches.map((b: { id: string }) => b.id);
      await supabase
        .from("knowledge_graphs")
        .delete()
        .in("id", branchIds);

      for (const branch of allBranches) {
        await cacheService.invalidateAllGraphRelated(userId, branch.id);
        await appEventBus.publish(
          "graph_deleted",
          { graphId: branch.id, userId } as GraphDeletedPayload,
          userId,
          "graph_service",
        );
      }
    }

    await cacheService.invalidateUserGraphsCache(userId);

    for (const id of data?.map((g: { id: string }) => g.id) || []) {
      await appEventBus.publish(
        "graph_deleted",
        { graphId: id, userId } as GraphDeletedPayload,
        userId,
        "graph_service",
      );
    }

    return { count: data?.length || 0 };
  }

  /**
   * 获取图谱的所有节点和边
   *
   * 返回图谱中的所有节点和边数据，结果会被缓存。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID（可选）
   * @param graphId - 图谱 ID
   * @returns 包含节点和边的对象
   *
   * @example
   * ```typescript
   * const { nodes, edges } = await graphService.getGraphNodes(supabase, userId, graphId);
   * console.log(`图谱有 ${nodes.length} 个节点`);
   * ```
   */
  async getGraphNodes(
    supabase: SupabaseClient,
    userId: string | null,
    graphId: string,
    options?: { includeEmbedding?: boolean },
  ) {
    const { includeEmbedding } = options ?? {};

    // When embedding is requested, skip cache to avoid storing large vector data
    if (includeEmbedding) {
      const { data: graphNodes, error: gnError } = await supabase
        .from("graph_nodes")
        .select(GRAPH_NODES_SELECT_WITH_EMBEDDING)
        .eq("graph_id", graphId)
        .is("deleted_at", null);

      if (gnError) {
        logger.error("getGraphNodes error:", gnError);
        throw gnError;
      }

      const nodes = (graphNodes || [])
        .map((gn: any) => {
          const node = buildNodeFromGraphNode(gn);
          if (!node) return null;
          return {
            id: node.id,
            graph_id: node.graph_id,
            graph_node_id: gn.id,
            title: node.title,
            content: node.content,
            summary: node.summary,
            x_position: node.x_position,
            y_position: node.y_position,
            level: node.level,
            properties: node.properties,
            learning_material: node.learning_material,
            is_accepted: node.is_accepted,
            knowledge_point_id: node.knowledge_point_id,
            visibility: node.visibility,
            owner_id: node.owner_id,
            created_at: node.created_at,
            updated_at: node.updated_at,
            embedding: node.embedding,
          };
        })
        .filter(Boolean);

      const { data: edges, error: edgesError } = await supabase
        .from("edges")
        .select("*")
        .eq("graph_id", graphId)
        .is("deleted_at", null);

      if (edgesError) throw edgesError;

      return { nodes, edges: edges || [] };
    }

    const cacheKey = userId
      ? CacheKeys.GRAPH_NODES(userId, graphId)
      : `graph_nodes_${graphId}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const { data: graphNodes, error: gnError } = await supabase
          .from("graph_nodes")
          .select(GRAPH_NODES_SELECT)
          .eq("graph_id", graphId)
          .is("deleted_at", null);

        if (gnError) {
          logger.error("getGraphNodes error:", gnError);
          throw gnError;
        }

        const nodes = (graphNodes || [])
          .map((gn: any) => {
            const node = buildNodeFromGraphNode(gn);
            if (!node) return null;
            return {
              id: node.id,
              graph_id: node.graph_id,
              graph_node_id: gn.id,
              title: node.title,
              content: node.content,
              summary: node.summary,
              x_position: node.x_position,
              y_position: node.y_position,
              level: node.level,
              properties: node.properties,
              learning_material: node.learning_material,
              is_accepted: node.is_accepted,
              knowledge_point_id: node.knowledge_point_id,
              visibility: node.visibility,
              owner_id: node.owner_id,
              created_at: node.created_at,
              updated_at: node.updated_at,
            };
          })
          .filter(Boolean);

        const { data: edges, error: edgesError } = await supabase
          .from("edges")
          .select("*")
          .eq("graph_id", graphId)
          .is("deleted_at", null);

        if (edgesError) throw edgesError;

        return { nodes, edges: edges || [] };
      },
      CacheTTL.GRAPH_NODES,
      userId ? [`user:${userId}`, `graph:${graphId}`] : [`graph:${graphId}`],
    );
  }

  /**
   * 获取图谱节点的学习状态
   *
   * 返回每个节点的掌握情况、复习次数、下次复习时间等信息。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @param graphId - 图谱 ID
   * @returns 节点状态映射表
   */
  async getGraphNodeStatus(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    return cacheService.getOrSet(
      CacheKeys.GRAPH_NODE_STATUS(userId, graphId),
      async () => {
        const { data: cards, error } = await supabase
          .from("study_cards")
          .select(
            "knowledge_point_id, next_review, fsrs_stability, fsrs_difficulty, fsrs_retrievability, review_count",
          )
          .eq("user_id", userId)
          .eq("graph_id", graphId);

        if (error) {
          logger.error("getGraphNodeStatus error:", error);
          return {};
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const statusMap: Record<string, NodeStatus> = {};

        // Group cards by knowledge_point_id and aggregate FSRS data
        type CardPick = Pick<StudyCardRow, 'knowledge_point_id' | 'next_review' | 'fsrs_stability' | 'fsrs_retrievability' | 'review_count'>;
        const cardGroups = new Map<string, { cards: CardPick[]; stabilitySum: number; weightedRetrievabilitySum: number; reviewCountSum: number }>();

        (cards || []).forEach((card: CardPick) => {
          const kpId = card.knowledge_point_id;
          if (!cardGroups.has(kpId)) {
            cardGroups.set(kpId, { cards: [], stabilitySum: 0, weightedRetrievabilitySum: 0, reviewCountSum: 0 });
          }
          const group = cardGroups.get(kpId)!;
          group.cards.push(card);
          const stability = card.fsrs_stability ?? 0;
          const retrievability = card.fsrs_retrievability ?? 0;

          // 使用 stability 加权，与 masteryCalculationService 一致
          if (stability > 0) {
            group.stabilitySum += stability;
            group.weightedRetrievabilitySum += retrievability * stability;
          } else {
            group.stabilitySum += 1; // 新卡片等权
            group.weightedRetrievabilitySum += retrievability;
          }
          group.reviewCountSum += card.review_count || 0;
        });

        cardGroups.forEach((group, kpId) => {
          const card = group.cards[0];
          const nextReview = card.next_review ? new Date(card.next_review) : null;
          const isDue = nextReview && nextReview <= now;
          const isDueToday =
            nextReview &&
            nextReview <= new Date(today.getTime() + 24 * 60 * 60 * 1000);

          // stability 加权平均 retrievability，与 masteryCalculationService 一致
          const weightedRetrievability = group.stabilitySum > 0
            ? group.weightedRetrievabilitySum / group.stabilitySum
            : 0;
          const avgStability = group.cards.length > 0
            ? group.cards.reduce((sum, c) => sum + (c.fsrs_stability ?? 0), 0) / group.cards.length
            : 0;
          const isMastered = avgStability > 21;

          statusMap[kpId] = {
            mastered: isMastered,
            locked: false,
            review_count: group.reviewCountSum,
            next_review: card.next_review ?? undefined,
            due: !!isDue,
            due_today: !!isDueToday,
            fsrs_stability: avgStability,
            fsrs_retrievability: weightedRetrievability,
          };
        });

        return statusMap;
      },
      CacheTTL.NODE_STATUS,
      [`graph:${graphId}`, 'status'],
    );
  }

  /**
   * 获取图谱的学习路径
   *
   * @param supabase - Supabase 客户端
   * @param _userId - 用户 ID（可选）
   * @param graphId - 图谱 ID
   * @returns 学习路径列表
   */
  async getLearningPath(
    supabase: SupabaseClient,
    _userId: string | null,
    graphId: string,
  ) {
    const { data, error } = await supabase
      .from("learning_paths")
      .select("*")
      .eq("graph_id", graphId)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * 分析图谱统计信息
   *
   * 计算图谱的节点数、边数、平均连接数、层级分布、密度等统计指标。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @param graphId - 图谱 ID
   * @returns 图谱统计信息
   */
  async analyzeGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    const { nodes, edges } = await this.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    const validNodes = nodes.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );
    const nodeCount = validNodes.length;
    const edgeCount = edges.length;
    const avgConnections = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

    const levels = validNodes.reduce((acc: Record<number, number>, node) => {
      const level =
        typeof node.level === "string"
          ? parseInt(node.level, 10) || 0
          : (node.level as number) || 0;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    return {
      nodeCount,
      edgeCount,
      avgConnections: Math.round(avgConnections * 100) / 100,
      levels,
      density:
        nodeCount > 1 ? edgeCount / ((nodeCount * (nodeCount - 1)) / 2) : 0,
    };
  }

  /**
   * 查找缺失的连接
   *
   * 分析图谱中可能缺失的连接，返回建议的节点对。
   * 基于节点层级差异计算建议分数。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @param graphId - 图谱 ID
   * @param maxSuggestions - 最大建议数量
   * @returns 建议连接列表，按分数排序
   */
  async findMissingConnections(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    maxSuggestions: number,
  ) {
    const { nodes, edges } = await this.getGraphNodes(
      supabase,
      userId,
      graphId,
    );

    const connectedPairs = new Set<string>();
    edges.forEach((edge: Record<string, unknown>) => {
      connectedPairs.add(
        `${edge.source_knowledge_point_id}-${edge.target_knowledge_point_id}`,
      );
      connectedPairs.add(
        `${edge.target_knowledge_point_id}-${edge.source_knowledge_point_id}`,
      );
    });

    const suggestions: Array<{
      source: string;
      target: string;
      score: number;
    }> = [];

    const validNodes = nodes.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );

    for (
      let i = 0;
      i < validNodes.length && suggestions.length < maxSuggestions;
      i++
    ) {
      for (
        let j = i + 1;
        j < validNodes.length && suggestions.length < maxSuggestions;
        j++
      ) {
        const sourceId = validNodes[i].id as string;
        const targetId = validNodes[j].id as string;
        const key = `${sourceId}-${targetId}`;

        if (!connectedPairs.has(key)) {
          const sourceLevel = getLevelIndex(validNodes[i].level as string) || 0;
          const targetLevel = getLevelIndex(validNodes[j].level as string) || 0;
          const score = Math.abs(sourceLevel - targetLevel);

          suggestions.push({
            source: sourceId,
            target: targetId,
            score,
          });
        }
      }
    }

    return suggestions
      .sort((a, b) => a.score - b.score)
      .slice(0, maxSuggestions);
  }

  /**
   * 获取多图谱合并视图
   *
   * 合并多个图谱的数据，并识别共享的知识点。
   *
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   * @param graphIds - 图谱 ID 数组
   * @returns 合并视图数据，包含各图谱节点/边和共享知识点
   * @throws {AppError} 如果图谱不存在
   */
  async getCombinedView(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ) {
    const { data: graphs, error: graphsError } = await supabase
      .from("knowledge_graphs")
      .select("id, title")
      .in("id", graphIds)
      .eq("user_id", userId);

    if (graphsError) {
      throw graphsError;
    }

    if (!graphs || graphs.length !== graphIds.length) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    const { data: graphNodes, error: nodesError } = await supabase
      .from("graph_nodes")
      .select(
        `
        id,
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties,
          visibility,
          owner_id
        )
      `,
      )
      .in("graph_id", graphIds)
      .is("deleted_at", null);

    if (nodesError) {
      throw nodesError;
    }

    const { data: edges, error: edgesError } = await supabase
      .from("edges")
      .select(
        "id, graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight",
      )
      .in("graph_id", graphIds)
      .is("deleted_at", null);

    if (edgesError) {
      throw edgesError;
    }

    const graphMap = new Map(graphs.map((g) => [g.id, g]));
    const result = {
      graphs: graphIds.map((gid: string) => ({
        graph_id: gid,
        graph_title: graphMap.get(gid)?.title || "",
        color: "",
        nodes: (graphNodes || []).filter((gn: GraphNodeForCombined) => gn.graph_id === gid),
        edges: (edges || []).filter((e: EdgeForCombined) => e.graph_id === gid),
      })),
      shared_knowledge_points: [] as SharedKnowledgePoint[],
    };

    const kpGraphMap = new Map<string, GraphNodeForCombined[]>();
    (graphNodes || []).forEach((gn: GraphNodeForCombined) => {
      const kpId = gn.knowledge_point_id;
      if (!kpGraphMap.has(kpId)) {
        kpGraphMap.set(kpId, []);
      }
      kpGraphMap.get(kpId)!.push(gn);
    });

    kpGraphMap.forEach((nodes, kpId) => {
      if (nodes.length > 1) {
        result.shared_knowledge_points.push({
          knowledge_point_id: kpId,
          knowledge_point: nodes[0].knowledge_points,
          graph_nodes: nodes,
        });
      }
    });

    return result;
  }
}

export const graphService = new GraphService();

export async function getUserAccessibleGraphs(
  userId: string,
): Promise<GraphWithCollaborators[]> {
  const { data: ownedGraphs, error: ownedError } = await getSupabaseAdmin()
    .from("knowledge_graphs")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("last_used_at", { ascending: false });

  if (ownedError) {
    throw new Error(ownedError.message);
  }

  const { data: collaboratedGraphs, error: collabError } =
    await getSupabaseAdmin()
      .from("graph_collaborators")
      .select(
        `
      role,
      graph:knowledge_graphs (*)
    `,
      )
      .eq("user_id", userId)
      .not("accepted_at", "is", null);

  if (collabError) {
    throw new Error(collabError.message);
  }

  const ownedResults = (ownedGraphs || []).map((g: KnowledgeGraphRow) => ({
    ...g,
    user_role: "owner" as CollaboratorRole,
  }));

  const collabResults = (collaboratedGraphs || [])
    .filter((c: { graph: KnowledgeGraphRow | KnowledgeGraphRow[] }) => {
      const graphData = Array.isArray(c.graph) ? c.graph[0] : c.graph;
      return graphData && !graphData.deleted_at;
    })
    .map((c: { graph: KnowledgeGraphRow | KnowledgeGraphRow[]; role: CollaboratorRole }) => {
      const graphData = Array.isArray(c.graph) ? c.graph[0] : c.graph;
      return {
        ...graphData,
        user_role: c.role as CollaboratorRole,
      };
    });

  const allGraphs = [...ownedResults, ...collabResults];
  const uniqueGraphs = allGraphs.filter(
    (graph, index, self) => index === self.findIndex((g) => g.id === graph.id),
  );

  return uniqueGraphs as GraphWithCollaborators[];
}

export async function getGraphWithUserRole(
  graphId: string,
  userId: string,
): Promise<{ graph: GraphWithCollaborators | null; error?: string }> {
  const { data: graph, error } = await getSupabaseAdmin()
    .from("knowledge_graphs")
    .select("*")
    .eq("id", graphId)
    .single();

  if (error) {
    return { graph: null, error: error.message };
  }

  if (!graph) {
    return { graph: null, error: "图谱不存在" };
  }

  let userRole: CollaboratorRole | undefined;

  if (graph.user_id === userId) {
    userRole = "owner";
  } else {
    const { data: collaborator } = await getSupabaseAdmin()
      .from("graph_collaborators")
      .select("role")
      .eq("graph_id", graphId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .single();

    userRole = collaborator?.role as CollaboratorRole;
  }

  return {
    graph: {
      ...graph,
      user_role: userRole,
    } as GraphWithCollaborators,
  };
}

export async function checkGraphAccess(
  graphId: string,
  userId: string,
  requiredRole: "viewer" | "editor" | "owner" = "viewer",
): Promise<{ hasAccess: boolean; role?: CollaboratorRole; error?: string }> {
  const { data: graph, error } = await getSupabaseAdmin()
    .from("knowledge_graphs")
    .select("user_id, is_public")
    .eq("id", graphId)
    .single();

  if (error || !graph) {
    return { hasAccess: false, error: "图谱不存在" };
  }

  if (graph.user_id === userId) {
    return { hasAccess: true, role: "owner" };
  }

  if (graph.is_public && requiredRole === "viewer") {
    return { hasAccess: true, role: undefined };
  }

  const { data: collaborator } = await getSupabaseAdmin()
    .from("graph_collaborators")
    .select("role")
    .eq("graph_id", graphId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .single();

  if (!collaborator) {
    return { hasAccess: false, error: "无权访问此图谱" };
  }

  const role = collaborator.role as CollaboratorRole;
  const roleHierarchy: Record<CollaboratorRole, number> = {
    owner: 3,
    editor: 2,
    viewer: 1,
  };

  const hasAccess = roleHierarchy[role] >= roleHierarchy[requiredRole];

  return { hasAccess, role };
}
