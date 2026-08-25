import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { cacheService, CacheKeys } from "../common/cacheService";
import { notDeleted } from "../common/softDeleteHelper";
import { checkGraphAccess as checkGraphAccessCore } from "../common/graphAccess";
import { logger } from "../../utils/logger";
import {
  checkDuplicateGraphTopic,
  type GraphTopicCheckResult,
} from "../../utils/similaritySearch";
import { aiService } from "../ai/aiService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getSupabaseAdmin } from "../../supabase";
import type { CollaboratorRole, GraphWithCollaborators } from "@shared/types";
import type { NodeStatus } from "@shared/types/graph";
import type { KnowledgeGraphRow } from "@shared/types/database";
import {
  PRESET_MAP,
  ACADEMIC_RESEARCH,
} from "@shared/constants/backboneModulePresets";
import { appEventBus } from "../core/eventBus";
import { graphVersionService } from "./graphVersionService";
import { transactionExecutor } from "../../database/transactionExecutor";
import { graphDomainService } from "./graphDomainService";

import type {
  GraphCreatedPayload,
  GraphUpdatedPayload,
} from "@shared/types/events";

import { GraphQueryService, graphQueryService } from "./graphQueryService";
import { GraphBatchService, graphBatchService } from "./graphBatchService";

/**
 * 图谱服务（Facade）
 *
 * 作为图谱服务的门面，对外保持原有 API 不变。
 * 内部将查询操作委托给 GraphQueryService，
 * 将删除/恢复操作委托给 GraphBatchService，
 * 自身保留核心 CRUD 操作（创建、更新、收藏切换、嵌入向量更新等）。
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
  private queryService: GraphQueryService;
  private batchService: GraphBatchService;

  constructor() {
    this.queryService = graphQueryService;
    this.batchService = graphBatchService;
  }

  // ========== 查询委托方法 ==========

  async listGraphs(supabase: SupabaseClient, userId: string) {
    return this.queryService.listGraphs(supabase, userId);
  }

  async listTrash(supabase: SupabaseClient, userId: string) {
    return this.queryService.listTrash(supabase, userId);
  }

  async getGraph(
    supabase: SupabaseClient,
    graphId: string,
    _userId: string | null,
  ) {
    return this.queryService.getGraph(supabase, graphId, _userId);
  }

  async updateLastUsedAt(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    return this.queryService.updateLastUsedAt(supabase, graphId, userId);
  }

  async checkTopicDuplicate(
    supabase: SupabaseClient,
    userId: string,
    topic: string,
    excludeGraphId?: string,
  ): Promise<GraphTopicCheckResult> {
    return this.queryService.checkTopicDuplicate(supabase, userId, topic, excludeGraphId);
  }

  async getGraphNodes(
    supabase: SupabaseClient,
    userId: string | null,
    graphId: string,
    options?: { includeEmbedding?: boolean; includeStatus?: boolean },
  ) {
    return this.queryService.getGraphNodes(supabase, userId, graphId, options);
  }

  async getGraphNodeStatus(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    return this.queryService.getGraphNodeStatus(supabase, userId, graphId);
  }

  async batchGetGraphNodeStatus(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ): Promise<Record<string, Record<string, NodeStatus>>> {
    return this.queryService.batchGetGraphNodeStatus(supabase, userId, graphIds);
  }

  async getLearningPath(
    supabase: SupabaseClient,
    _userId: string | null,
    graphId: string,
  ) {
    return this.queryService.getLearningPath(supabase, _userId, graphId);
  }

  async analyzeGraph(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
  ) {
    return this.queryService.analyzeGraph(supabase, userId, graphId);
  }

  async findMissingConnections(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    maxSuggestions: number,
  ) {
    return this.queryService.findMissingConnections(supabase, userId, graphId, maxSuggestions);
  }

  async getCombinedView(
    supabase: SupabaseClient,
    userId: string,
    graphIds: string[],
  ) {
    return this.queryService.getCombinedView(supabase, userId, graphIds);
  }

  // ========== 删除/恢复委托方法 ==========

  async deleteGraph(supabase: SupabaseClient, graphId: string, userId: string) {
    return this.batchService.deleteGraph(supabase, graphId, userId);
  }

  async deleteGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    return this.batchService.deleteGraphs(supabase, graphIds, userId);
  }

  async restoreGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    return this.batchService.restoreGraph(supabase, graphId, userId);
  }

  async restoreGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    return this.batchService.restoreGraphs(supabase, graphIds, userId);
  }

  async permanentDeleteGraph(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
  ) {
    return this.batchService.permanentDeleteGraph(supabase, graphId, userId);
  }

  async permanentDeleteGraphs(
    supabase: SupabaseClient,
    graphIds: string[],
    userId: string,
  ) {
    return this.batchService.permanentDeleteGraphs(supabase, graphIds, userId);
  }

  // ========== 核心 CRUD 方法（保留在 Facade 中） ==========

  async createGraph(
    supabase: SupabaseClient,
    userId: string,
    title: string,
    description?: string,
    options?: {
      skipDuplicateCheck?: boolean;
      templateType?: string;
      presetId?: string;
      domains?: Array<{ domain_id: string; is_primary?: boolean }>;
      tags?: string[];
    },
  ) {
    if (!options?.skipDuplicateCheck && process.env.SKIP_DUPLICATE_TOPIC_CHECK !== 'true') {
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

    const domainsList = options?.domains;
    const useTransaction =
      !!domainsList &&
      domainsList.length > 0 &&
      transactionExecutor.isAvailable();

    let data: { id: string; [key: string]: unknown };

    if (useTransaction && domainsList) {
      data = await transactionExecutor.executeInTransaction(async (client) => {
        const graphResult = await client.query(
          `INSERT INTO knowledge_graphs (user_id, title, description, embedding, template_type, tags)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            userId,
            title,
            description || null,
            embedding ? JSON.stringify(embedding) : null,
            options?.templateType || null,
            options?.tags ?? [],
          ],
        );
        const graph = graphResult.rows[0] as { id: string; [key: string]: unknown };

        const hasPrimary = domainsList.some((d) => d.is_primary);
        const normalizedDomains = domainsList.map((d, i) => ({
          domain_id: d.domain_id,
          is_primary: hasPrimary ? d.is_primary ?? false : i === 0,
        }));

        const domainValues: string[] = [];
        const domainParams: unknown[] = [graph.id];
        let paramIdx = 2;
        for (const d of normalizedDomains) {
          domainValues.push(
            `($1, $${paramIdx}, $${paramIdx + 1})`,
          );
          domainParams.push(d.domain_id, d.is_primary);
          paramIdx += 2;
        }

        await client.query(
          `INSERT INTO graph_domains (graph_id, domain_id, is_primary) VALUES ${domainValues.join(", ")}`,
          domainParams,
        );

        return graph;
      });
    } else {
      const { data: graphData, error } = await supabase
        .from("knowledge_graphs")
        .insert({
          user_id: userId,
          title,
          description: description || null,
          embedding: embedding ?? undefined,
          template_type: options?.templateType || null,
          tags: options?.tags ?? [],
        })
        .select()
        .single();

      if (error) throw error;
      data = graphData as { id: string; [key: string]: unknown };

      if (domainsList && domainsList.length > 0) {
        try {
          await graphDomainService.updateGraphDomains(supabase, data.id, domainsList);
        } catch (e) {
          logger.warn(
            "[GraphService] Failed to update graph domains (non-transactional fallback):",
            e,
          );
        }
      }
    }

    // 同步创建 knowledge_graph_contents 记录（1:1 子表）
    try {
      await supabase
        .from("knowledge_graph_contents")
        .insert({ graph_id: data.id });
    } catch (e) {
      logger.warn(
        "[GraphService] Failed to create knowledge_graph_contents record:",
        e,
      );
    }

    if (options?.templateType === "topic_research") {
      const preset = options?.presetId
        ? PRESET_MAP[options.presetId]
        : ACADEMIC_RESEARCH;

      if (preset) {
        const modulesToInsert = preset.modules.map((mod, index) => ({
          graph_id: data.id,
          module_type: mod.module_type,
          title: i18next.t(mod.title),
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

    // Task creation is now handled by the scheduler layer
    // subscribing to the "graph_created" event (see smartTaskLinker.subscribeToGraphCreatedEvents).
    logger.info("[GraphService] Graph created, task will be linked via event:", {
      graphId: data.id,
      userId,
    });

    await Promise.all([
      cacheService.invalidateUserGraphsCache(userId),
      cacheService.del(CacheKeys.USER_TAGS(userId)),
    ]);

    appEventBus.publish(
      "graph_created",
      { graphId: data.id, title, userId } as GraphCreatedPayload,
      userId,
      "graph_service",
    );

    return data;
  }

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
      podcast_script?: string;
      tags?: string[];
    },
  ) {
    if (updates.title && process.env.SKIP_DUPLICATE_TOPIC_CHECK !== 'true') {
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

    // 分离内容性字段（写入 knowledge_graph_contents）和元数据字段（写入 knowledge_graphs）
    const contentFields: Record<string, unknown> = {};
    const metadataUpdates: Record<string, unknown> = {};
    // 预构建 Set，将循环内 includes 的 O(n) 线性扫描降为 has 的 O(1) 查询
    const contentFieldKeys = new Set(['reference_books', 'external_links', 'learning_guide', 'podcast_script']);

    for (const [key, value] of Object.entries(updates)) {
      if (contentFieldKeys.has(key)) {
        contentFields[key] = value;
      } else {
        metadataUpdates[key] = value;
      }
    }

    const updateData: Record<string, unknown> = {
      ...metadataUpdates,
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

    // 如果涉及内容性字段，UPSERT 到 knowledge_graph_contents
    if (Object.keys(contentFields).length > 0) {
      const contentUpsert: Record<string, unknown> = {
        graph_id: graphId,
        ...contentFields,
        updated_at: new Date().toISOString(),
      };
      const { error: contentError } = await supabase
        .from("knowledge_graph_contents")
        .upsert(contentUpsert, { onConflict: 'graph_id' });

      if (contentError) {
        logger.warn("[GraphService] Failed to update knowledge_graph_contents:", contentError);
      }
    }

    // 图谱元数据更新（如 tags）会影响用户图谱列表与标签聚合缓存，需一并失效
    await Promise.all([
      cacheService.invalidateGraphCache(userId, graphId),
      cacheService.invalidateUserGraphsCache(userId),
      cacheService.del(CacheKeys.GRAPH_TAGS(userId)),
      cacheService.del(CacheKeys.USER_TAGS(userId)),
    ]);

    await graphVersionService.recordEvent(
      supabase,
      graphId,
      'graph_updated',
      {
        changes: updates,
      },
      userId,
    ).catch(err => logger.error('Record graph_updated event error:', err));

    appEventBus.publish(
      "graph_updated",
      { graphId, userId, changes: updates } as GraphUpdatedPayload,
      userId,
      "graph_service",
    );

    return data;
  }

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

    appEventBus.publish(
      "graph_updated",
      { graphId, userId } as GraphUpdatedPayload,
      userId,
      "graph_service",
    );

    return data;
  }

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
}

export const graphService = new GraphService();

export async function getUserAccessibleGraphs(
  userId: string,
): Promise<GraphWithCollaborators[]> {
  const { data: ownedGraphs, error: ownedError } = await notDeleted(getSupabaseAdmin()
    .from("knowledge_graphs")
    .select("*")
    .eq("user_id", userId)
    )
    .order("last_used_at", { ascending: false });

  if (ownedError) {
    throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: ownedError.message });
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
    throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: collabError.message });
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
  // 复杂度降低：用 Set 去重，替代 filter 内 findIndex 的 O(n²) 扫描
  const seenIds = new Set<string>();
  const uniqueGraphs = allGraphs.filter((graph) => {
    if (seenIds.has(graph.id)) return false;
    seenIds.add(graph.id);
    return true;
  });

  return uniqueGraphs as unknown as GraphWithCollaborators[];
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
  // 委托公共访问校验模块（admin client 绕过 RLS 做服务端校验，
  // 保留公共图谱 viewer 访问语义）。
  return checkGraphAccessCore(getSupabaseAdmin(), graphId, userId, {
    requiredRole,
    includePublic: true,
  });
}
