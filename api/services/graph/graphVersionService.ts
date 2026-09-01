import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type {
  VersionGraphEventType,
  GraphSnapshotType,
  GraphEvent,
  GraphSnapshot,
  DiffResult,
  PaginatedResult,
  MergeResult,
  BranchInfo,
} from '../../../shared/types/graphVersion';
import { cacheService } from '../common/cacheService';
import { appEventBus } from '../core/eventBus';
import type { GraphRollbackPayload } from '../../../shared/types/events';
import { transactionExecutor } from '../../database/transactionExecutor';
import { notDeleted } from '../common/softDeleteHelper';
import { buildCurrentSnapshotData, computeDiff } from './graphVersionShared';
import { GraphVersionBranchService } from './graphVersionBranchService';

const SNAPSHOT_DESCRIPTIONS: Record<string, string> = {
  pre_ai_expand: 'AI 扩展前自动快照',
  pre_batch_delete: '批量删除前自动快照',
  pre_rollback: '回滚前自动快照',
  auto: '自动快照',
};

interface ListSnapshotsOptions {
  page?: number;
  pageSize?: number;
}

interface ListEventsOptions {
  page?: number;
  pageSize?: number;
  batchId?: string;
  eventType?: VersionGraphEventType;
}

interface GraphEventRow {
  id: string;
  graph_id: string;
  event_type: VersionGraphEventType;
  event_data: Record<string, unknown>;
  operator_id: string | null;
  batch_id: string | null;
  snapshot_id: string | null;
  created_at: string;
}

interface GraphSnapshotRow {
  id: string;
  graph_id: string;
  snapshot_data: GraphSnapshot['snapshotData'];
  description: string | null;
  snapshot_type: GraphSnapshotType;
  node_count: number;
  edge_count: number;
  operator_id: string | null;
  created_at: string;
}

/**
 * 图谱版本服务：负责快照、事件、diff 与回滚。
 * 分支/合并逻辑拆到 GraphVersionBranchService（构造注入本实例）。
 */
export class GraphVersionService {
  private readonly branches: GraphVersionBranchService;

  constructor() {
    this.branches = new GraphVersionBranchService(this);
  }

  async recordEvent(
    supabase: SupabaseClient,
    graphId: string,
    eventType: VersionGraphEventType,
    eventData: Record<string, unknown>,
    operatorId: string | null,
    batchId?: string,
  ): Promise<GraphEvent> {
    const { data, error } = await supabase
      .from('graph_events')
      .insert([{
        graph_id: graphId,
        event_type: eventType,
        event_data: eventData,
        operator_id: operatorId,
        batch_id: batchId ?? null,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Record graph event error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return this.mapEvent(data);
  }

  async recordEvents(
    supabase: SupabaseClient,
    graphId: string,
    events: Array<{
      eventType: VersionGraphEventType;
      eventData: Record<string, unknown>;
      operatorId: string | null;
    }>,
    batchId?: string,
  ): Promise<void> {
    if (events.length === 0) return;

    const { error } = await supabase
      .from('graph_events')
      .insert(events.map((e) => ({
        graph_id: graphId,
        event_type: e.eventType,
        event_data: e.eventData,
        operator_id: e.operatorId,
        batch_id: batchId ?? null,
      })));

    if (error) {
      logger.error('Record graph events error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }
  }

  async createSnapshot(
    supabase: SupabaseClient,
    graphId: string,
    description: string | null,
    snapshotType: GraphSnapshotType,
    operatorId?: string | null,
  ): Promise<GraphSnapshot> {
    const snapshotData = await buildCurrentSnapshotData(supabase, graphId);

    const { data: snapshot, error: snapshotError } = await supabase
      .from('graph_snapshots')
      .insert([{
        graph_id: graphId,
        snapshot_data: snapshotData,
        description: description ?? null,
        snapshot_type: snapshotType,
        node_count: snapshotData.nodes.length,
        edge_count: snapshotData.edges.length,
        operator_id: operatorId ?? null,
      }])
      .select()
      .single();

    if (snapshotError) {
      logger.error('Create snapshot error:', snapshotError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return this.mapSnapshot(snapshot);
  }

  async autoSnapshot(
    supabase: SupabaseClient,
    graphId: string,
    snapshotType: GraphSnapshotType,
    operatorId?: string | null,
  ): Promise<GraphSnapshot> {
    if (snapshotType === 'manual') {
      return this.createSnapshot(supabase, graphId, null, snapshotType, operatorId);
    }

    const description = SNAPSHOT_DESCRIPTIONS[snapshotType] ?? '自动快照';
    return this.createSnapshot(supabase, graphId, description, snapshotType, operatorId);
  }

  async listSnapshots(
    supabase: SupabaseClient,
    graphId: string,
    options?: ListSnapshotsOptions,
  ): Promise<PaginatedResult<GraphSnapshot>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('graph_snapshots')
      .select('*', { count: 'exact' })
      .eq('graph_id', graphId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('List snapshots error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return {
      data: (data ?? []).map(s => this.mapSnapshot(s)),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async getSnapshot(
    supabase: SupabaseClient,
    snapshotId: string,
  ): Promise<GraphSnapshot> {
    const { data, error } = await supabase
      .from('graph_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error || !data) {
      logger.error('Get snapshot error:', error);
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return this.mapSnapshot(data);
  }

  async diffSnapshots(
    supabase: SupabaseClient,
    sourceSnapshotId: string,
    targetSnapshotId: string,
  ): Promise<DiffResult> {
    const sourceSnapshot = await this.getSnapshot(supabase, sourceSnapshotId);
    const targetSnapshot = await this.getSnapshot(supabase, targetSnapshotId);

    return computeDiff(sourceSnapshot.snapshotData, targetSnapshot.snapshotData);
  }

  async diffWithCurrent(
    supabase: SupabaseClient,
    graphId: string,
    snapshotId: string,
  ): Promise<DiffResult> {
    const snapshot = await this.getSnapshot(supabase, snapshotId);
    const currentData = await buildCurrentSnapshotData(supabase, graphId);
    return computeDiff(snapshot.snapshotData, currentData);
  }

  async rollbackToSnapshot(
    supabase: SupabaseClient,
    graphId: string,
    snapshotId: string,
    operatorId: string | null,
  ): Promise<string> {
    const preRollbackSnapshot = await this.autoSnapshot(
      supabase,
      graphId,
      'pre_rollback',
      operatorId,
    );

    const targetSnapshot = await this.getSnapshot(supabase, snapshotId);

    if (transactionExecutor.isAvailable()) {
      await transactionExecutor.executeInTransaction(async (client) => {
        // 软删除当前节点
        const { rows: currentNodes } = await client.query(
          'SELECT id FROM graph_nodes WHERE graph_id = $1 AND deleted_at IS NULL',
          [graphId],
        );

        if (currentNodes.length > 0) {
          const currentNodeIds = currentNodes.map((r: { id: string }) => r.id);
          await client.query(
            'UPDATE graph_nodes SET deleted_at = NOW() WHERE id = ANY($1)',
            [currentNodeIds],
          );

          // 软删除当前边
          await client.query(
            'UPDATE edges SET deleted_at = NOW() WHERE graph_id = $1 AND deleted_at IS NULL',
            [graphId],
          );
        }

        // 恢复目标快照中的节点
        for (const node of targetSnapshot.snapshotData.nodes) {
          const { rows: existingRows } = await client.query(
            'SELECT id, deleted_at FROM graph_nodes WHERE graph_id = $1 AND knowledge_point_id = $2 LIMIT 1',
            [graphId, node.knowledgePointId],
          );

          const existingNode = existingRows[0] as { id: string; deleted_at: string | null } | undefined;

          if (existingNode) {
            if (existingNode.deleted_at) {
              await client.query(
                'UPDATE graph_nodes SET deleted_at = NULL, x_position = $1, y_position = $2, level = $3, is_accepted = $4 WHERE id = $5',
                [node.xPosition, node.yPosition, node.level, node.isAccepted, existingNode.id],
              );
            } else {
              await client.query(
                'UPDATE graph_nodes SET x_position = $1, y_position = $2, level = $3, is_accepted = $4 WHERE id = $5',
                [node.xPosition, node.yPosition, node.level, node.isAccepted, existingNode.id],
              );
            }
          } else {
            await client.query(
              'INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted) VALUES ($1, $2, $3, $4, $5, $6)',
              [graphId, node.knowledgePointId, node.xPosition, node.yPosition, node.level, node.isAccepted],
            );
          }
        }

        // 恢复目标快照中的边
        for (const edge of targetSnapshot.snapshotData.edges) {
          const { rows: existingRows } = await client.query(
            'SELECT id, deleted_at FROM edges WHERE graph_id = $1 AND source_knowledge_point_id = $2 AND target_knowledge_point_id = $3 AND relationship_type = $4 LIMIT 1',
            [graphId, edge.sourceKnowledgePointId, edge.targetKnowledgePointId, edge.relationshipType],
          );

          const existingEdge = existingRows[0] as { id: string; deleted_at: string | null } | undefined;

          if (existingEdge) {
            if (existingEdge.deleted_at) {
              await client.query(
                'UPDATE edges SET deleted_at = NULL, weight = $1, custom_label = $2, custom_color = $3, custom_line_style = $4, show_arrow = $5 WHERE id = $6',
                [edge.weight, edge.customLabel, edge.customColor, edge.customLineStyle, edge.showArrow, existingEdge.id],
              );
            } else {
              await client.query(
                'UPDATE edges SET weight = $1, custom_label = $2, custom_color = $3, custom_line_style = $4, show_arrow = $5 WHERE id = $6',
                [edge.weight, edge.customLabel, edge.customColor, edge.customLineStyle, edge.showArrow, existingEdge.id],
              );
            }
          } else {
            await client.query(
              'INSERT INTO edges (graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
              [graphId, edge.sourceKnowledgePointId, edge.targetKnowledgePointId, edge.relationshipType, edge.weight, edge.customLabel, edge.customColor, edge.customLineStyle, edge.showArrow],
            );
          }
        }
      });
    } else {
      logger.warn('TransactionExecutor unavailable, rollbackToSnapshot executing without transaction guarantee');

      const { data: currentNodes, error: nodesError } = await notDeleted(supabase
        .from('graph_nodes')
        .select('id')
        .eq('graph_id', graphId)
        );

      if (nodesError) {
        logger.error('Query current nodes for rollback error:', nodesError);
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
      }

      if (currentNodes && currentNodes.length > 0) {
        const currentNodeIds = currentNodes.map((n: { id: string }) => n.id);
        const { error: softDeleteNodesError } = await supabase
          .from('graph_nodes')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', currentNodeIds);

        if (softDeleteNodesError) {
          logger.error('Soft delete nodes for rollback error:', softDeleteNodesError);
          throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }

        const { error: softDeleteEdgesError } = await notDeleted(supabase
          .from('edges')
          .update({ deleted_at: new Date().toISOString() })
          .eq('graph_id', graphId)
          );

        if (softDeleteEdgesError) {
          logger.error('Soft delete edges for rollback error:', softDeleteEdgesError);
          throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
      }

      for (const node of targetSnapshot.snapshotData.nodes) {
        const { data: existingNode } = await supabase
          .from('graph_nodes')
          .select('id, deleted_at')
          .eq('graph_id', graphId)
          .eq('knowledge_point_id', node.knowledgePointId)
          .maybeSingle();

        if (existingNode) {
          if (existingNode.deleted_at) {
            const { error: restoreError } = await supabase
              .from('graph_nodes')
              .update({
                deleted_at: null,
                x_position: node.xPosition,
                y_position: node.yPosition,
                level: node.level,
                is_accepted: node.isAccepted,
              })
              .eq('id', existingNode.id);

            if (restoreError) {
              logger.error('Restore node for rollback error:', restoreError);
              throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
            }
          } else {
            const { error: updateError } = await supabase
              .from('graph_nodes')
              .update({
                x_position: node.xPosition,
                y_position: node.yPosition,
                level: node.level,
                is_accepted: node.isAccepted,
              })
              .eq('id', existingNode.id);

            if (updateError) {
              logger.error('Update node for rollback error:', updateError);
              throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
            }
          }
        } else {
          const { error: createError } = await supabase
            .from('graph_nodes')
            .insert([{
              graph_id: graphId,
              knowledge_point_id: node.knowledgePointId,
              x_position: node.xPosition,
              y_position: node.yPosition,
              level: node.level,
              is_accepted: node.isAccepted,
            }]);

          if (createError) {
            logger.error('Create node for rollback error:', createError);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
          }
        }
      }

      for (const edge of targetSnapshot.snapshotData.edges) {
        const { data: existingEdge } = await supabase
          .from('edges')
          .select('id, deleted_at')
          .eq('graph_id', graphId)
          .eq('source_knowledge_point_id', edge.sourceKnowledgePointId)
          .eq('target_knowledge_point_id', edge.targetKnowledgePointId)
          .eq('relationship_type', edge.relationshipType)
          .maybeSingle();

        if (existingEdge) {
          if (existingEdge.deleted_at) {
            const { error: restoreError } = await supabase
              .from('edges')
              .update({
                deleted_at: null,
                weight: edge.weight,
                custom_label: edge.customLabel,
                custom_color: edge.customColor,
                custom_line_style: edge.customLineStyle,
                show_arrow: edge.showArrow,
              })
              .eq('id', existingEdge.id);

            if (restoreError) {
              logger.error('Restore edge for rollback error:', restoreError);
              throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
            }
          } else {
            const { error: updateError } = await supabase
              .from('edges')
              .update({
                weight: edge.weight,
                custom_label: edge.customLabel,
                custom_color: edge.customColor,
                custom_line_style: edge.customLineStyle,
                show_arrow: edge.showArrow,
              })
              .eq('id', existingEdge.id);

            if (updateError) {
              logger.error('Update edge for rollback error:', updateError);
              throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
            }
          }
        } else {
          const { error: createError } = await supabase
            .from('edges')
            .insert([{
              graph_id: graphId,
              source_knowledge_point_id: edge.sourceKnowledgePointId,
              target_knowledge_point_id: edge.targetKnowledgePointId,
              relationship_type: edge.relationshipType,
              weight: edge.weight,
              custom_label: edge.customLabel,
              custom_color: edge.customColor,
              custom_line_style: edge.customLineStyle,
              show_arrow: edge.showArrow,
            }]);

          if (createError) {
            logger.error('Create edge for rollback error:', createError);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
          }
        }
      }
    }

    // 记录事件（事务外）
    await this.recordEvent(supabase, graphId, 'graph_rollback', {
      snapshot_id: snapshotId,
      pre_rollback_snapshot_id: preRollbackSnapshot.id,
    }, operatorId);

    // 缓存失效和事件发布（事务外）
    await cacheService.invalidateAllGraphRelated(operatorId ?? '', graphId);
    appEventBus.publish(
      "graph_rollback",
      { graphId, userId: operatorId ?? '', snapshotId } as GraphRollbackPayload,
      operatorId ?? '',
      "graph_version_service",
    );

    return preRollbackSnapshot.id;
  }

  async listEvents(
    supabase: SupabaseClient,
    graphId: string,
    options?: ListEventsOptions,
  ): Promise<PaginatedResult<GraphEvent>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('graph_events')
      .select('*', { count: 'exact' })
      .eq('graph_id', graphId);

    if (options?.batchId) {
      query = query.eq('batch_id', options.batchId);
    }
    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('List events error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return {
      data: (data ?? []).map(e => this.mapEvent(e)),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  // ============================================================
  // 分支/合并（委托 GraphVersionBranchService）
  // ============================================================

  createBranch(
    supabase: SupabaseClient,
    graphId: string,
    branchName: string,
    operatorId: string | null,
  ): Promise<{ graphId: string; snapshotId: string }> {
    return this.branches.createBranch(supabase, graphId, branchName, operatorId);
  }

  listBranches(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<BranchInfo[]> {
    return this.branches.listBranches(supabase, graphId);
  }

  mergeBranch(
    supabase: SupabaseClient,
    mainGraphId: string,
    branchGraphId: string,
  ): Promise<MergeResult> {
    return this.branches.mergeBranch(supabase, mainGraphId, branchGraphId);
  }

  applyMerge(
    supabase: SupabaseClient,
    mainGraphId: string,
    branchGraphId: string,
    selectedChanges: { nodeIds: string[]; edgeIds: string[]; removedNodeIds?: string[]; removedEdgeIds?: string[] },
    conflictResolutions: Record<string, 'main' | 'branch'>,
    operatorId: string | null,
  ): Promise<{
    nodesAdded: number;
    edgesAdded: number;
    nodesModified: number;
    edgesModified: number;
    nodesRemoved: number;
    edgesRemoved: number;
    conflictsResolved: number;
  }> {
    return this.branches.applyMerge(
      supabase,
      mainGraphId,
      branchGraphId,
      selectedChanges,
      conflictResolutions,
      operatorId,
    );
  }

  // ============================================================
  // 私有映射
  // ============================================================

  private mapEvent(data: GraphEventRow): GraphEvent {
    return {
      id: data.id,
      graphId: data.graph_id,
      eventType: data.event_type,
      eventData: data.event_data,
      operatorId: data.operator_id,
      batchId: data.batch_id,
      snapshotId: data.snapshot_id,
      createdAt: data.created_at,
    };
  }

  private mapSnapshot(data: GraphSnapshotRow): GraphSnapshot {
    return {
      id: data.id,
      graphId: data.graph_id,
      snapshotData: data.snapshot_data,
      description: data.description,
      snapshotType: data.snapshot_type,
      nodeCount: data.node_count,
      edgeCount: data.edge_count,
      operatorId: data.operator_id,
      createdAt: data.created_at,
    };
  }
}

export const graphVersionService = new GraphVersionService();
