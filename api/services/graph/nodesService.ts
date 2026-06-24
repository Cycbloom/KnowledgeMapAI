import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService } from '../common/cacheService';
import { aiService } from '../ai/aiService';
import { knowledgePointService, graphNodeService, edgeService } from './index';
import { graphVersionService } from './graphVersionService';
import { buildNodeFromGraphNode, createKnowledgePointWithGraphNode } from '../../utils/nodeHelpers';
import { appEventBus } from '../core/eventBus';
import type { NodeCreatedPayload, EdgeCreatedPayload } from '../../../shared/types/events';
import { BackboneModule, type NodeLevel } from '../../../shared/types/graph';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { transactionExecutor } from '../../database/transactionExecutor';
import { withThreeLevelFallback } from '../../utils/rpcFallback';

const REUSE_SIMILARITY_THRESHOLD = 0.85;

interface CreateNodeData {
  graph_id: string;
  title?: string;
  content?: string;
  summary?: string;
  x_position?: number;
  y_position?: number;
  properties?: Record<string, unknown>;
  level?: string;
  is_accepted?: boolean;
  learning_material?: string;
  knowledge_point_id?: string;
  reuse_existing?: boolean;
}

interface UpdateNodeData {
  title?: string;
  content?: string;
  summary?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  visibility?: 'private' | 'public';
  keywords?: string[];
  x_position?: number;
  y_position?: number;
  level?: string;
  is_accepted?: boolean;
}

interface BatchUpdateNodeItem {
  id: string;
  title?: string;
  content?: string;
  summary?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  x_position?: number;
  y_position?: number;
  level?: string;
  is_accepted?: boolean;
}

interface PositionUpdate {
  id: string;
  x_position: number;
  y_position: number;
}

interface CreateEdgeData {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
}

export class NodesService {
  async createNode(
    supabase: SupabaseClient,
    userId: string,
    data: CreateNodeData,
  ) {
    const {
      graph_id,
      title,
      content,
      summary,
      x_position,
      y_position,
      properties,
      level,
      is_accepted,
      learning_material,
      knowledge_point_id: existingKpId,
      reuse_existing = true,
    } = data;

    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('id, user_id')
      .eq('id', graph_id)
      .single();

    if (!graph) {
      throw new AppError('未经授权访问图谱', 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    let knowledgePointId = existingKpId;
    let graphNodeId: string | undefined;

    // 当不需要复用且没有已有知识点时，使用 RPC 原子性创建
    if (!knowledgePointId && !reuse_existing) {
      const result = await createKnowledgePointWithGraphNode(supabase, userId, {
        graph_id,
        title: title || '',
        content: content || '',
        summary,
        learning_material,
        x_position,
        y_position,
        level,
        properties,
      });

      if (!result) {
        throw new AppError(
          '创建知识点节点失败',
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }

      knowledgePointId = result.knowledge_point_id;
      graphNodeId = result.graph_node_id;
    }

    // 复用路径或已有知识点：仅创建 knowledge_point（如需要）+ graph_node
    if (!knowledgePointId) {
      const newKp = await knowledgePointService.create(supabase, {
        title: title || '',
        content: content || '',
        summary,
        learning_material: learning_material || '',
        properties: properties || {},
        visibility: 'private',
        owner_id: userId,
      });

      knowledgePointId = newKp.id;
    }

    try {
      let result: NonNullable<ReturnType<typeof buildNodeFromGraphNode>>;

      if (graphNodeId) {
        // 已通过 RPC 创建了 graph_node，直接查询返回
        const { data: gn, error: gnError } = await supabase
          .from('graph_nodes')
          .select(
            `
          id,
          graph_id,
          knowledge_point_id,
          x_position,
          y_position,
          level,
          is_accepted,
          deleted_at,
          created_at,
          updated_at,
          knowledge_points (
            id,
            title,
            content,
            summary,
            learning_material,
            properties,
            visibility,
            owner_id,
            created_at,
            updated_at,
            keywords
          )
        `,
          )
          .eq('id', graphNodeId)
          .single();

        if (gnError || !gn) {
          throw new AppError(
            '获取创建的图谱节点失败',
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }
        const built = buildNodeFromGraphNode(gn);
        if (!built) {
          throw new AppError(
            '构建节点数据失败',
            500,
            ErrorCodes.SYSTEM_INTERNAL_ERROR,
          );
        }
        result = built;
      } else {
        const graphNode = await graphNodeService.addToGraph(supabase, {
          graph_id,
          knowledge_point_id: knowledgePointId,
          x_position,
          y_position,
          level: level as NodeLevel | undefined,
          is_accepted,
        });
        result = graphNode;
      }

      await cacheService.invalidateGraphCache(userId, graph_id);
      await cacheService.invalidateUserGraphsCache(userId);

      appEventBus
        .publish<NodeCreatedPayload>(
          'node_created',
          {
            nodeId: result.id,
            graphId: graph_id,
            userId,
            title: result.title,
          },
          userId,
          'graph_node_service',
        )
        .catch((err) => logger.error('node_created event publish failed:', err));

      // 异步处理 embedding（不阻塞返回）
      if (!existingKpId && title) {
        this.processEmbeddingAsync(supabase, userId, knowledgePointId, title, reuse_existing).catch((err) => {
          logger.warn('Async embedding processing failed:', err);
        });
      }

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('已存在于当前图谱中')) {
        throw new AppError(
          '该知识点已存在于当前图谱中',
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      logger.error('Create graph node error:', error);
      throw new AppError(
        message || '创建图谱节点失败',
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  private async processEmbeddingAsync(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    title: string,
    reuseExisting: boolean,
  ): Promise<void> {
    try {
      const embedding = await aiService.generateEmbedding(title);
      if (!embedding) return;

      // 回填 embedding 到 knowledge_point
      await supabase
        .from('knowledge_points')
        .update({ embedding })
        .eq('id', knowledgePointId);

      // 如果启用了复用检查，执行相似度搜索（仅日志记录）
      if (reuseExisting) {
        const similarKps = await knowledgePointService.searchSimilar(
          supabase,
          embedding,
          userId,
          REUSE_SIMILARITY_THRESHOLD,
          1,
        );
        if (similarKps && similarKps.length > 0) {
          logger.info(
            `Async similarity check found existing KP: ${similarKps[0].id} for title: ${title}`,
          );
        }
      }
    } catch (error) {
      logger.warn('processEmbeddingAsync failed:', error);
    }
  }

  async getNode(
    supabase: SupabaseClient,
    _userId: string,
    knowledgePointId: string,
  ) {
    const { data: graphNode, error } = await supabase
      .from('graph_nodes')
      .select(
        `
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      deleted_at,
      created_at,
      updated_at,
      knowledge_points (
        id,
        title,
        content,
        summary,
        learning_material,
        properties,
        visibility,
        owner_id,
        created_at,
        updated_at,
        keywords
      )
    `,
      )
      .eq('knowledge_point_id', knowledgePointId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      logger.error('Get node error:', error);
      throw new AppError('获取节点失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    if (!graphNode) {
      throw new AppError('节点不存在', 404, ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    return buildNodeFromGraphNode(graphNode);
  }

  async updateNode(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    updates: UpdateNodeData,
  ) {
    const { data: existingNode, error: findError } = await supabase
      .from('graph_nodes')
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
        summary,
        learning_material,
        properties,
        visibility,
        owner_id,
        keywords
      )
    `,
      )
      .eq('knowledge_point_id', knowledgePointId)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError) {
      logger.error('Find node error:', findError);
    }

    if (!existingNode) {
      throw new AppError(
        'Node not found or unauthorized',
        404,
        ErrorCodes.RESOURCE_NODE_NOT_FOUND,
      );
    }

    interface KnowledgePointData {
      id: string;
      title?: string;
      properties?: {
        backboneModule?: string;
      };
    }

    const kpArray = existingNode.knowledge_points as KnowledgePointData[] | null;
    const kp = kpArray?.[0];
    const isBackboneNode =
      kp?.properties?.backboneModule &&
      Object.values(BackboneModule).includes(kp.properties.backboneModule as BackboneModule);

    if (
      isBackboneNode &&
      updates.title !== undefined &&
      updates.title !== kp?.title
    ) {
      throw new AppError('骨干节点标题不可修改', 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const kpUpdates: {
      title?: string;
      content?: string;
      summary?: string;
      learning_material?: string;
      properties?: Record<string, unknown>;
      visibility?: 'private' | 'public';
      keywords?: string[];
    } = {};
    const gnUpdates: {
      x_position?: number;
      y_position?: number;
      level?: string;
      is_accepted?: boolean;
    } = {};

    if (updates.title !== undefined) kpUpdates.title = updates.title;
    if (updates.content !== undefined) kpUpdates.content = updates.content;
    if (updates.summary !== undefined) kpUpdates.summary = updates.summary;
    if (updates.learning_material !== undefined)
      kpUpdates.learning_material = updates.learning_material;
    if (updates.properties !== undefined)
      kpUpdates.properties = updates.properties;
    if (updates.visibility !== undefined)
      kpUpdates.visibility = updates.visibility;
    if (updates.keywords !== undefined) kpUpdates.keywords = updates.keywords;

    if (updates.x_position !== undefined)
      gnUpdates.x_position = updates.x_position;
    if (updates.y_position !== undefined)
      gnUpdates.y_position = updates.y_position;
    if (updates.level !== undefined) gnUpdates.level = updates.level;
    if (updates.is_accepted !== undefined)
      gnUpdates.is_accepted = updates.is_accepted;

    if (Object.keys(kpUpdates).length > 0 || Object.keys(gnUpdates).length > 0) {
      if (transactionExecutor.isAvailable()) {
        try {
          await transactionExecutor.executeInTransaction(async (client) => {
            if (Object.keys(kpUpdates).length > 0) {
              const kpSetClauses: string[] = [];
              const kpParams: unknown[] = [];
              let paramIdx = 1;
              for (const [key, value] of Object.entries(kpUpdates)) {
                kpSetClauses.push(`${key} = $${paramIdx}`);
                kpParams.push(value);
                paramIdx++;
              }
              kpSetClauses.push(`updated_at = $${paramIdx}`);
              kpParams.push(new Date().toISOString());
              paramIdx++;
              kpParams.push(existingNode.knowledge_point_id);

              await client.query(
                `UPDATE knowledge_points SET ${kpSetClauses.join(', ')} WHERE id = $${paramIdx}`,
                kpParams,
              );
            }

            if (Object.keys(gnUpdates).length > 0) {
              const gnSetClauses: string[] = [];
              const gnParams: unknown[] = [];
              let paramIdx = 1;
              for (const [key, value] of Object.entries(gnUpdates)) {
                gnSetClauses.push(`${key} = $${paramIdx}`);
                gnParams.push(value);
                paramIdx++;
              }
              gnSetClauses.push(`updated_at = $${paramIdx}`);
              gnParams.push(new Date().toISOString());
              paramIdx++;
              gnParams.push(existingNode.id);

              await client.query(
                `UPDATE graph_nodes SET ${gnSetClauses.join(', ')} WHERE id = $${paramIdx}`,
                gnParams,
              );
            }
          });
        } catch (txError) {
          logger.warn('updateNode transaction failed, falling back to non-transactional update:', txError);
          // 降级路径：保留原有逻辑
          if (Object.keys(kpUpdates).length > 0) {
            try {
              await knowledgePointService.update(
                supabase,
                existingNode.knowledge_point_id,
                kpUpdates,
              );
            } catch (error: unknown) {
              logger.error('Update knowledge point error:', error);
              const message =
                error instanceof Error ? error.message : '更新知识点失败';
              throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
            }
          }

          if (Object.keys(gnUpdates).length > 0) {
            const { error: gnError } = await supabase
              .from('graph_nodes')
              .update(gnUpdates)
              .eq('id', existingNode.id);

            if (gnError) {
              logger.error('Update graph node error:', gnError);
              throw new AppError(
                gnError.message || '更新图谱节点失败',
                500,
                ErrorCodes.SYSTEM_INTERNAL_ERROR,
              );
            }
          }
        }
      } else {
        // transactionExecutor 不可用，使用降级路径
        logger.warn('transactionExecutor not available, using non-transactional updateNode');
        if (Object.keys(kpUpdates).length > 0) {
          try {
            await knowledgePointService.update(
              supabase,
              existingNode.knowledge_point_id,
              kpUpdates,
            );
          } catch (error: unknown) {
            logger.error('Update knowledge point error:', error);
            const message =
              error instanceof Error ? error.message : '更新知识点失败';
            throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
          }
        }

        if (Object.keys(gnUpdates).length > 0) {
          const { error: gnError } = await supabase
            .from('graph_nodes')
            .update(gnUpdates)
            .eq('id', existingNode.id);

          if (gnError) {
            logger.error('Update graph node error:', gnError);
            throw new AppError(
              gnError.message || '更新图谱节点失败',
              500,
              ErrorCodes.SYSTEM_INTERNAL_ERROR,
            );
          }
        }
      }
    }

    const { data: updatedNode, error: refetchError } = await supabase
      .from('graph_nodes')
      .select(
        `
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      created_at,
      updated_at,
      knowledge_points (
        id,
        title,
        content,
        summary,
        learning_material,
        properties,
        visibility,
        owner_id,
        created_at,
        updated_at,
        keywords
      )
    `,
      )
      .eq('id', existingNode.id)
      .single();

    if (refetchError || !updatedNode) {
      throw new AppError(
        '获取更新后的节点失败',
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    await cacheService.invalidateGraphCache(userId, existingNode.graph_id);
    await cacheService.invalidateStudyCache(existingNode.graph_id);

    return buildNodeFromGraphNode(updatedNode);
  }

  async deleteNode(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    hardDelete: boolean,
  ) {
    const { data: graphNode, error: findError } = await supabase
      .from('graph_nodes')
      .select(
        `
      id,
      graph_id,
      knowledge_point_id,
      knowledge_points (
        id,
        owner_id
      )
    `,
      )
      .eq('knowledge_point_id', knowledgePointId)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError) {
      logger.error('Find node for delete error:', findError);
    }

    if (!graphNode) {
      throw new AppError(
        'Node not found or unauthorized',
        404,
        ErrorCodes.RESOURCE_NODE_NOT_FOUND,
      );
    }

    if (hardDelete) {
      const result = await knowledgePointService.delete(
        supabase,
        knowledgePointId,
        userId,
      );

      if (!result?.success) {
        throw new AppError('删除失败', 400, ErrorCodes.VALIDATION_ERROR);
      }

      await cacheService.invalidateGraphCache(userId, graphNode.graph_id);

      return {
        message: '知识点已彻底删除',
        affected_graphs: result.affected_graphs,
        deleted_graph_nodes: result.deleted_graph_nodes,
        deleted_edges: result.deleted_edges,
        deleted_cards: result.deleted_cards,
      };
    }

    const { error: softDeleteError } = await supabase.rpc(
      'soft_delete_graph_node',
      {
        p_graph_node_id: graphNode.id,
        p_user_id: userId,
      },
    );

    if (softDeleteError) {
      logger.error('Soft delete graph node error:', softDeleteError);
      throw new AppError(
        softDeleteError.message || '删除节点失败',
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    await cacheService.invalidateGraphCache(userId, graphNode.graph_id);

    return { message: '节点已从当前图谱移除' };
  }

  async batchDeleteNodes(
    supabase: SupabaseClient,
    userId: string,
    nodeIds: string[],
  ) {
    const { data: graphNodes, error: findError } = await supabase
      .from('graph_nodes')
      .select('id, graph_id, knowledge_point_id')
      .in('knowledge_point_id', nodeIds)
      .is('deleted_at', null);

    if (findError) {
      logger.error('Find nodes for batch delete error:', findError);
    }

    if (!graphNodes || graphNodes.length === 0) {
      return { message: '未找到匹配的节点', count: 0 };
    }

    if (nodeIds.length >= 3) {
      const graphId = graphNodes[0]?.graph_id;
      if (graphId) {
        await graphVersionService.autoSnapshot(
          supabase,
          graphId,
          'pre_batch_delete',
          userId,
        ).catch((err) => logger.error('Auto snapshot error:', err));
      }
    }

    const graphNodeIds = graphNodes.map((gn) => gn.id);
    const graphId = graphNodes[0]?.graph_id ?? '';
    const deletedCount = await graphNodeService.batchDelete(supabase, graphNodeIds, graphId);

    const graphIds = [...new Set(graphNodes.map((gn) => gn.graph_id))];
    for (const gid of graphIds) {
      await cacheService.invalidateGraphCache(userId, gid);
    }
    await cacheService.invalidateUserGraphsCache(userId);

    return {
      message: `成功删除 ${deletedCount} 个节点`,
      count: deletedCount,
    };
  }

  async batchUpdatePositions(
    supabase: SupabaseClient,
    userId: string,
    positions: PositionUpdate[],
  ) {
    const { data: graphNodes, error: findError } = await supabase
      .from('graph_nodes')
      .select('id, graph_id, knowledge_point_id')
      .in(
        'knowledge_point_id',
        positions.map((p) => p.id),
      )
      .is('deleted_at', null);

    if (findError) {
      logger.error('Find nodes for batch position update error:', findError);
    }

    if (!graphNodes || graphNodes.length === 0) {
      return { message: '未找到匹配的节点', count: 0 };
    }

    const kpIdToGnId = new Map(
      graphNodes.map((gn) => [gn.knowledge_point_id, gn.id]),
    );

    const validPositions = positions.filter((pos) => kpIdToGnId.has(pos.id));

    const result = await withThreeLevelFallback<{ message: string; count: number }>({
      context: 'batchUpdatePositions',
      rpcFn: async () => {
        const rpcResult = await supabase.rpc('batch_update_positions', {
          p_ids: validPositions.map((pos) => kpIdToGnId.get(pos.id)),
          p_x_positions: validPositions.map((pos) => pos.x_position),
          p_y_positions: validPositions.map((pos) => pos.y_position),
        });
        if (rpcResult.error) throw rpcResult.error;
        return {
          message: `成功更新 ${validPositions.length} 个节点位置`,
          count: validPositions.length,
        };
      },
      fallbackFn: async () => {
        const updatePromises = validPositions.map((pos) =>
          supabase
            .from('graph_nodes')
            .update({
              x_position: pos.x_position,
              y_position: pos.y_position,
            })
            .eq('id', kpIdToGnId.get(pos.id)),
        );
        const results = await Promise.all(updatePromises);
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
          logger.error('Batch position update errors:', errors);
        }
        return {
          message: `成功更新 ${validPositions.length} 个节点位置`,
          count: validPositions.length,
        };
      },
    });

    const graphIds = [...new Set(graphNodes.map((gn) => gn.graph_id))];
    for (const gid of graphIds) {
      await cacheService.invalidateGraphCache(userId, gid);
    }

    return result;
  }

  async batchUpdateNodes(
    supabase: SupabaseClient,
    userId: string,
    nodes: BatchUpdateNodeItem[],
  ) {
    const nodeIds = nodes.map((n) => n.id);
    const { data: graphNodes, error: findError } = await supabase
      .from('graph_nodes')
      .select(
        `
        id,
        graph_id,
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties
        )
      `,
      )
      .in('knowledge_point_id', nodeIds)
      .is('deleted_at', null);

    if (findError) {
      logger.error('Find nodes for batch update error:', findError);
    }

    if (!graphNodes || graphNodes.length === 0) {
      return { message: '未找到匹配的节点', count: 0 };
    }

    const kpIdToGnMap = new Map(
      graphNodes.map((gn) => {
        const kp = Array.isArray(gn.knowledge_points)
          ? gn.knowledge_points[0]
          : gn.knowledge_points;
        return [kp?.id, gn];
      }),
    );

    let skippedCount = 0;
    const updateResults: Array<{
      id: string;
      updated: boolean;
      reason?: string;
    }> = [];

    // 收集所有需要更新的数据（验证逻辑在事务外）
    const pendingUpdates: Array<{
      nodeUpdateId: string;
      graphNodeId: string;
      knowledgePointId: string;
      kpUpdates: Record<string, unknown>;
      gnUpdates: Record<string, unknown>;
    }> = [];

    for (const nodeUpdate of nodes) {
      const graphNode = kpIdToGnMap.get(nodeUpdate.id);
      if (!graphNode) continue;

      interface KnowledgePointWithProperties {
        id: string;
        title?: string;
        properties?: {
          backboneModule?: string;
        };
      }

      const kpArray = graphNode.knowledge_points as KnowledgePointWithProperties[] | null;
      const kp = kpArray?.[0];
      const isBackboneNode =
        kp?.properties?.backboneModule &&
        Object.values(BackboneModule).includes(kp.properties.backboneModule as BackboneModule);

      const kpUpdates: {
        title?: string;
        content?: string;
        summary?: string;
        learning_material?: string;
        properties?: Record<string, unknown>;
      } = {};
      const gnUpdates: {
        x_position?: number;
        y_position?: number;
        level?: string;
        is_accepted?: boolean;
      } = {};

      if (nodeUpdate.title !== undefined) {
        if (isBackboneNode && nodeUpdate.title !== kp?.title) {
          skippedCount++;
          updateResults.push({
            id: nodeUpdate.id,
            updated: false,
            reason: '骨干节点标题不可修改',
          });
          continue;
        }
        kpUpdates.title = nodeUpdate.title;
      }

      if (nodeUpdate.content !== undefined)
        kpUpdates.content = nodeUpdate.content;
      if (nodeUpdate.summary !== undefined)
        kpUpdates.summary = nodeUpdate.summary;
      if (nodeUpdate.learning_material !== undefined)
        kpUpdates.learning_material = nodeUpdate.learning_material;
      if (nodeUpdate.properties !== undefined)
        kpUpdates.properties = nodeUpdate.properties;

      if (nodeUpdate.x_position !== undefined)
        gnUpdates.x_position = nodeUpdate.x_position;
      if (nodeUpdate.y_position !== undefined)
        gnUpdates.y_position = nodeUpdate.y_position;
      if (nodeUpdate.level !== undefined) gnUpdates.level = nodeUpdate.level;
      if (nodeUpdate.is_accepted !== undefined)
        gnUpdates.is_accepted = nodeUpdate.is_accepted;

      if (Object.keys(kpUpdates).length > 0 || Object.keys(gnUpdates).length > 0) {
        pendingUpdates.push({
          nodeUpdateId: nodeUpdate.id,
          graphNodeId: graphNode.id,
          knowledgePointId: graphNode.knowledge_point_id,
          kpUpdates,
          gnUpdates,
        });
      }
    }

    // 使用事务执行所有更新
    if (pendingUpdates.length > 0) {
      await withThreeLevelFallback<void>({
        context: 'batchUpdateNodes',
        rpcFn: async () => {
          // batchUpdateNodes 没有 RPC，跳过 Level 1
          throw new Error('No RPC available for batchUpdateNodes');
        },
        txFn: async (client) => {
          for (const item of pendingUpdates) {
            if (Object.keys(item.kpUpdates).length > 0) {
              const kpSetClauses: string[] = [];
              const kpParams: unknown[] = [];
              let paramIdx = 1;
              for (const [key, value] of Object.entries(item.kpUpdates)) {
                kpSetClauses.push(`${key} = $${paramIdx}`);
                kpParams.push(value);
                paramIdx++;
              }
              kpSetClauses.push(`updated_at = $${paramIdx}`);
              kpParams.push(new Date().toISOString());
              paramIdx++;
              kpParams.push(item.knowledgePointId);

              await client.query(
                `UPDATE knowledge_points SET ${kpSetClauses.join(', ')} WHERE id = $${paramIdx}`,
                kpParams,
              );
            }

            if (Object.keys(item.gnUpdates).length > 0) {
              const gnSetClauses: string[] = [];
              const gnParams: unknown[] = [];
              let paramIdx = 1;
              for (const [key, value] of Object.entries(item.gnUpdates)) {
                gnSetClauses.push(`${key} = $${paramIdx}`);
                gnParams.push(value);
                paramIdx++;
              }
              gnSetClauses.push(`updated_at = $${paramIdx}`);
              gnParams.push(new Date().toISOString());
              paramIdx++;
              gnParams.push(item.graphNodeId);

              await client.query(
                `UPDATE graph_nodes SET ${gnSetClauses.join(', ')} WHERE id = $${paramIdx}`,
                gnParams,
              );
            }
          }

          for (const item of pendingUpdates) {
            updateResults.push({ id: item.nodeUpdateId, updated: true });
          }
        },
        fallbackFn: async () => {
          await this.executeBatchUpdateFallback(supabase, pendingUpdates, updateResults);
        },
      });
    }

    const graphIds = [...new Set(graphNodes.map((gn) => gn.graph_id))];
    for (const gid of graphIds) {
      await cacheService.invalidateGraphCache(userId, gid);
    }

    const successCount = updateResults.filter((r) => r.updated).length;
    const failedCount = updateResults.filter((r) => !r.updated).length;

    return {
      message: `成功更新 ${successCount} 个节点${skippedCount > 0 ? `，已跳过 ${skippedCount} 个骨干节点的标题修改` : ''}`,
      count: successCount,
      skipped: skippedCount,
      failed: failedCount,
      results: updateResults,
    };
  }

  /**
   * batchUpdateNodes 的非事务降级路径：逐条更新 knowledge_points 和 graph_nodes
   */
  private async executeBatchUpdateFallback(
    supabase: SupabaseClient,
    pendingUpdates: Array<{
      nodeUpdateId: string;
      graphNodeId: string;
      knowledgePointId: string;
      kpUpdates: Record<string, unknown>;
      gnUpdates: Record<string, unknown>;
    }>,
    updateResults: Array<{ id: string; updated: boolean; reason?: string }>,
  ): Promise<void> {
    const kpUpdates = pendingUpdates.filter(item => Object.keys(item.kpUpdates).length > 0);
    const gnUpdates = pendingUpdates.filter(item => Object.keys(item.gnUpdates).length > 0);

    // 批量更新 knowledge_points
    for (const item of kpUpdates) {
      try {
        await knowledgePointService.update(
          supabase,
          item.knowledgePointId,
          item.kpUpdates,
        );
        updateResults.push({ id: item.nodeUpdateId, updated: true });
      } catch (error: unknown) {
        logger.error('Batch update knowledge_point error:', error);
        updateResults.push({
          id: item.nodeUpdateId,
          updated: false,
          reason: error instanceof Error ? error.message : '知识点更新失败',
        });
      }
    }

    // 批量更新 graph_nodes
    for (const item of gnUpdates) {
      try {
        await supabase
          .from('graph_nodes')
          .update(item.gnUpdates)
          .eq('id', item.graphNodeId);

        // 避免重复添加（如果 kp 更新已添加）
        if (!kpUpdates.some(kp => kp.nodeUpdateId === item.nodeUpdateId)) {
          updateResults.push({ id: item.nodeUpdateId, updated: true });
        }
      } catch (error: unknown) {
        logger.error('Batch update graph_node error:', error);
        updateResults.push({
          id: item.nodeUpdateId,
          updated: false,
          reason: error instanceof Error ? error.message : '图谱节点更新失败',
        });
      }
    }
  }

  async getRelatedNodes(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId: string,
    limit: number = 5,
  ) {
    const { data: graphNode, error: nodeError } = await supabase
      .from('graph_nodes')
      .select(
        `
        id,
        knowledge_point_id,
        knowledge_points (
          id,
          title,
          content,
          embedding
        )
      `,
      )
      .eq('knowledge_point_id', knowledgePointId)
      .is('deleted_at', null)
      .maybeSingle();

    if (nodeError) {
      logger.error('Find node for related error:', nodeError);
    }

    if (!graphNode) {
      throw new AppError('节点不存在', 404, ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    interface KnowledgePointWithEmbedding {
      id: string;
      title?: string;
      embedding?: number[] | null;
    }

    const kpArray = graphNode.knowledge_points as KnowledgePointWithEmbedding[] | null;
    const kp = kpArray?.[0];
    let embedding: number[] | undefined;
    if (kp?.embedding) {
      embedding = kp.embedding;
    }

    if (!embedding && kp?.title) {
      const generatedEmbedding = await aiService.generateEmbedding(kp.title);

      if (generatedEmbedding) {
        embedding = generatedEmbedding;
        await supabase
          .from('knowledge_points')
          .update({ embedding: generatedEmbedding })
          .eq('id', kp.id);
      }
    }

    if (!embedding) {
      return [];
    }

    const relatedKps = await knowledgePointService.searchSimilar(
      supabase,
      embedding,
      userId,
      0.5,
      limit + 1,
    );

    const results = (relatedKps || [])
      .filter((kp: { id: string }) => kp.id !== knowledgePointId)
      .slice(0, limit);

    return results;
  }

  async createEdge(
    supabase: SupabaseClient,
    userId: string,
    data: CreateEdgeData,
  ) {
    const {
      graph_id,
      source_knowledge_point_id,
      target_knowledge_point_id,
      relationship_type,
    } = data;

    try {
      const edge = await edgeService.create(supabase, {
        graph_id,
        source_knowledge_point_id,
        target_knowledge_point_id,
        relationship_type: relationship_type || 'contains',
      });

      await cacheService.invalidateGraphCache(userId, graph_id);

      appEventBus
        .publish<EdgeCreatedPayload>(
          'edge_created',
          {
            edgeId: edge.id,
            graphId: graph_id,
            userId,
            sourceNodeId: edge.source_knowledge_point_id,
            targetNodeId: edge.target_knowledge_point_id,
          },
          userId,
          'edge_route',
        )
        .catch((err) => logger.error('edge_created event publish failed:', err));

      return {
        id: edge.id,
        graph_id: edge.graph_id,
        source_knowledge_point_id: edge.source_knowledge_point_id,
        target_knowledge_point_id: edge.target_knowledge_point_id,
        relationship_type: edge.relationship_type,
        weight: edge.weight,
        created_at: edge.created_at,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('源知识点不在当前图谱中')) {
        throw new AppError(
          'Source node not found or unauthorized',
          404,
          ErrorCodes.RESOURCE_NODE_NOT_FOUND,
        );
      }
      if (message.includes('目标知识点不在当前图谱中')) {
        throw new AppError(
          'Target node not found or unauthorized',
          404,
          ErrorCodes.RESOURCE_NODE_NOT_FOUND,
        );
      }
      throw new AppError(
        message || '创建边失败',
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async deleteEdge(
    supabase: SupabaseClient,
    userId: string,
    edgeId: string,
  ) {
    const { data: edge, error } = await supabase
      .from('edges')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', edgeId)
      .select('graph_id')
      .single();

    if (error)
      throw new AppError(
        error.message || '删除边失败',
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );

    if (!edge) {
      throw new AppError(
        'Edge not found or unauthorized',
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const graphId = edge.graph_id;
    if (graphId) {
      await cacheService.invalidateGraphCache(userId, graphId);
    }

    return { message: 'Edge deleted' };
  }
}

export const nodesService = new NodesService();
