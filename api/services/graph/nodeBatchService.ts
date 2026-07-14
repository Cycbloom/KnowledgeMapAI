import { SupabaseClient } from '@supabase/supabase-js';
import { cacheService } from '../common/cacheService';
import { knowledgePointService } from './knowledgePointService';
import { graphNodeService } from './graphNodeService';
import { graphVersionService } from './graphVersionService';
import { BackboneModule } from '../../../shared/types/graph';
import { logger } from '../../utils/logger';
import { withThreeLevelFallback } from '../../utils/rpcFallback';
import { notDeleted } from '../common/softDeleteHelper';

interface PositionUpdate {
  id: string;
  x_position: number;
  y_position: number;
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

export class NodeBatchService {
  async batchDeleteNodes(
    supabase: SupabaseClient,
    userId: string,
    nodeIds: string[],
  ) {
    const { data: graphNodes, error: findError } = await notDeleted(supabase
      .from('graph_nodes')
      .select('id, graph_id, knowledge_point_id')
      .in('knowledge_point_id', nodeIds)
      );

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
    const { data: graphNodes, error: findError } = await notDeleted(supabase
      .from('graph_nodes')
      .select('id, graph_id, knowledge_point_id')
      .in(
        'knowledge_point_id',
        positions.map((p) => p.id),
      )
      );

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
    const { data: graphNodes, error: findError } = await notDeleted(supabase
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
      );

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
      graphId: string;
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

      const kpRaw = graphNode.knowledge_points as
        | KnowledgePointWithProperties
        | KnowledgePointWithProperties[]
        | null;
      const kp = Array.isArray(kpRaw) ? kpRaw[0] : kpRaw;
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
          graphId: graphNode.graph_id,
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
          await this.executeBatchUpdateFallback(supabase, userId, pendingUpdates, updateResults);
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
    userId: string,
    pendingUpdates: Array<{
      nodeUpdateId: string;
      graphNodeId: string;
      knowledgePointId: string;
      graphId: string;
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
          userId,
          item.graphId,
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
}

export const nodeBatchService = new NodeBatchService();
