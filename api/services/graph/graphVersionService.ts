import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type {
  VersionGraphEventType,
  GraphSnapshotType,
  GraphEvent,
  GraphSnapshot,
  SnapshotData,
  SnapshotNodeData,
  SnapshotEdgeData,
  DiffResult,
  NodeDiff,
  EdgeDiff,
  MergeConflict,
  MergeResult,
  PaginatedResult,
  BranchInfo,
} from '../../../shared/types/graphVersion';
import { cacheService } from '../common/cacheService';
import { appEventBus } from '../core/eventBus';
import type { GraphRollbackPayload } from '../../../shared/types/events';
import { transactionExecutor } from '../../database/transactionExecutor';
import { notDeleted } from '../common/softDeleteHelper';

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

interface ApplyMergeResult {
  nodesAdded: number;
  edgesAdded: number;
  nodesModified: number;
  edgesModified: number;
  nodesRemoved: number;
  edgesRemoved: number;
  conflictsResolved: number;
}

interface GraphNodeSnapshotRow {
  id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  knowledge_points:
    | { title: string; content: string; summary: string | null }
    | { title: string; content: string; summary: string | null }[]
    | null;
}

interface EdgeSnapshotRow {
  id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type: string;
  weight: number;
  custom_label: string | null;
  custom_color: string | null;
  custom_line_style: string | null;
  show_arrow: boolean | null;
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
  snapshot_data: SnapshotData;
  description: string | null;
  snapshot_type: GraphSnapshotType;
  node_count: number;
  edge_count: number;
  operator_id: string | null;
  created_at: string;
}

export class GraphVersionService {
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

  async createSnapshot(
    supabase: SupabaseClient,
    graphId: string,
    description: string | null,
    snapshotType: GraphSnapshotType,
    operatorId?: string | null,
  ): Promise<GraphSnapshot> {
    const { data: nodes, error: nodesError } = await notDeleted(supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id, x_position, y_position, level, is_accepted, knowledge_points(title, content, summary)')
      .eq('graph_id', graphId)
      );

    if (nodesError) {
      logger.error('Query graph nodes for snapshot error:', nodesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const { data: edges, error: edgesError } = await notDeleted(supabase
      .from('edges')
      .select('id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
      .eq('graph_id', graphId)
      );

    if (edgesError) {
      logger.error('Query edges for snapshot error:', edgesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const snapshotNodes: SnapshotNodeData[] = ((nodes ?? []) as unknown as GraphNodeSnapshotRow[]).map((node) => ({
      id: node.id,
      knowledgePointId: node.knowledge_point_id,
      title: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.title ?? '')
        : (node.knowledge_points?.title ?? ''),
      content: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.content ?? '')
        : (node.knowledge_points?.content ?? ''),
      summary: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.summary ?? null)
        : (node.knowledge_points?.summary ?? null),
      xPosition: node.x_position,
      yPosition: node.y_position,
      level: node.level,
      isAccepted: node.is_accepted,
    }));

    const snapshotEdges: SnapshotEdgeData[] = ((edges ?? []) as unknown as EdgeSnapshotRow[]).map((edge) => ({
      id: edge.id,
      sourceKnowledgePointId: edge.source_knowledge_point_id,
      targetKnowledgePointId: edge.target_knowledge_point_id,
      relationshipType: edge.relationship_type,
      weight: edge.weight,
      customLabel: edge.custom_label,
      customColor: edge.custom_color,
      customLineStyle: edge.custom_line_style,
      showArrow: edge.show_arrow,
    }));

    const snapshotData: SnapshotData = {
      nodes: snapshotNodes,
      edges: snapshotEdges,
    };

    const { data: snapshot, error: snapshotError } = await supabase
      .from('graph_snapshots')
      .insert([{
        graph_id: graphId,
        snapshot_data: snapshotData,
        description: description ?? null,
        snapshot_type: snapshotType,
        node_count: snapshotNodes.length,
        edge_count: snapshotEdges.length,
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

    return this.computeDiff(sourceSnapshot.snapshotData, targetSnapshot.snapshotData);
  }

  async diffWithCurrent(
    supabase: SupabaseClient,
    graphId: string,
    snapshotId: string,
  ): Promise<DiffResult> {
    const snapshot = await this.getSnapshot(supabase, snapshotId);
    const currentData = await this.buildCurrentSnapshotData(supabase, graphId);
    return this.computeDiff(snapshot.snapshotData, currentData);
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

  async createBranch(
    supabase: SupabaseClient,
    graphId: string,
    branchName: string,
    operatorId: string | null,
  ): Promise<{ graphId: string; snapshotId: string }> {
    const snapshot = await this.autoSnapshot(supabase, graphId, 'auto', operatorId);

    const { data: originalGraph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('user_id, title, description, domain, settings, reference_books, external_links, learning_guide, podcast_script, template_type')
      .eq('id', graphId)
      .single();

    if (graphError || !originalGraph) {
      logger.error('Get original graph for branch error:', graphError);
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    let newGraphId: string;

    if (transactionExecutor.isAvailable()) {
      newGraphId = await transactionExecutor.executeInTransaction(async (client) => {
        // 创建新图谱
        const { rows: newGraphRows } = await client.query(
          `INSERT INTO knowledge_graphs (user_id, title, description, domain, settings, reference_books, external_links, learning_guide, podcast_script, template_type, is_branch, parent_graph_id, branch_name, branch_source_snapshot_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            originalGraph.user_id,
            `${originalGraph.title} - ${branchName}`,
            originalGraph.description,
            originalGraph.domain,
            JSON.stringify(originalGraph.settings),
            originalGraph.reference_books ? JSON.stringify(originalGraph.reference_books) : null,
            originalGraph.external_links ? JSON.stringify(originalGraph.external_links) : null,
            originalGraph.learning_guide ? JSON.stringify(originalGraph.learning_guide) : null,
            originalGraph.podcast_script ? JSON.stringify(originalGraph.podcast_script) : null,
            originalGraph.template_type,
            true,
            graphId,
            branchName,
            snapshot.id,
          ],
        );

        const createdGraphId = newGraphRows[0].id as string;

        // 复制知识点（创建独立副本）
        const { rows: sourceKps } = await client.query(
          `SELECT kp.id, kp.title, kp.content, kp.summary, kp.learning_material, kp.keywords, kp.properties, kp.visibility, kp.owner_id, kp.mastery_level
           FROM knowledge_points kp
           JOIN graph_nodes gn ON gn.knowledge_point_id = kp.id
           WHERE gn.graph_id = $1 AND gn.deleted_at IS NULL`,
          [graphId],
        );

        const kpIdMap = new Map<string, string>(); // old kp id -> new kp id

        if (sourceKps.length > 0) {
          for (const kp of sourceKps) {
            const { rows: newKpRows } = await client.query(
              `INSERT INTO knowledge_points (title, content, summary, learning_material, keywords, properties, visibility, owner_id, mastery_level, source_knowledge_point_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING id`,
              [
                kp.title,
                kp.content,
                kp.summary,
                kp.learning_material,
                kp.keywords ? JSON.stringify(kp.keywords) : null,
                kp.properties ? JSON.stringify(kp.properties) : null,
                kp.visibility,
                kp.owner_id,
                kp.mastery_level ?? 0,
                kp.id, // source_knowledge_point_id 指向原始记录
              ],
            );
            kpIdMap.set(kp.id, newKpRows[0].id as string);
          }
        }

        // 复制节点（使用新的 knowledge_point_id）
        const { rows: sourceNodes } = await client.query(
          'SELECT knowledge_point_id, x_position, y_position, level, is_accepted FROM graph_nodes WHERE graph_id = $1 AND deleted_at IS NULL',
          [graphId],
        );

        if (sourceNodes.length > 0) {
          for (const node of sourceNodes) {
            const newKpId = kpIdMap.get(node.knowledge_point_id) ?? node.knowledge_point_id;
            await client.query(
              'INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted) VALUES ($1, $2, $3, $4, $5, $6)',
              [createdGraphId, newKpId, node.x_position, node.y_position, node.level, node.is_accepted],
            );
          }
        }

        // 复制边（使用新的 knowledge_point_id）
        const { rows: sourceEdges } = await client.query(
          'SELECT source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow FROM edges WHERE graph_id = $1 AND deleted_at IS NULL',
          [graphId],
        );

        if (sourceEdges.length > 0) {
          for (const edge of sourceEdges) {
            const newSourceKpId = kpIdMap.get(edge.source_knowledge_point_id) ?? edge.source_knowledge_point_id;
            const newTargetKpId = kpIdMap.get(edge.target_knowledge_point_id) ?? edge.target_knowledge_point_id;
            await client.query(
              'INSERT INTO edges (graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
              [createdGraphId, newSourceKpId, newTargetKpId, edge.relationship_type, edge.weight, edge.custom_label, edge.custom_color, edge.custom_line_style, edge.show_arrow],
            );
          }
        }

        return createdGraphId;
      });
    } else {
      logger.warn('TransactionExecutor unavailable, createBranch executing without transaction guarantee');

      const { data: newGraph, error: createGraphError } = await supabase
        .from('knowledge_graphs')
        .insert([{
          user_id: originalGraph.user_id,
          title: `${originalGraph.title} - ${branchName}`,
          description: originalGraph.description,
          domain: originalGraph.domain,
          settings: originalGraph.settings,
          reference_books: originalGraph.reference_books,
          external_links: originalGraph.external_links,
          learning_guide: originalGraph.learning_guide,
          podcast_script: originalGraph.podcast_script,
          template_type: originalGraph.template_type,
          is_branch: true,
          parent_graph_id: graphId,
          branch_name: branchName,
          branch_source_snapshot_id: snapshot.id,
        }])
        .select('id')
        .single();

      if (createGraphError) {
        logger.error('Create branch graph error:', createGraphError);
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
      }

      newGraphId = newGraph.id;

      // 复制知识点（创建独立副本）
      const { data: sourceKps, error: kpsError } = await notDeleted(supabase
        .from('graph_nodes')
        .select('knowledge_point_id, knowledge_points(id, title, content, summary, learning_material, keywords, properties, visibility, owner_id, mastery_level)')
        .eq('graph_id', graphId)
        );

      if (kpsError) {
        logger.error('Query source knowledge points for branch error:', kpsError);
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
      }

      const kpIdMap = new Map<string, string>(); // old kp id -> new kp id

      if (sourceKps && sourceKps.length > 0) {
        for (const row of sourceKps) {
          const kp = Array.isArray(row.knowledge_points) ? row.knowledge_points[0] : row.knowledge_points;
          if (!kp || kpIdMap.has(kp.id)) continue;

          const { data: newKp, error: createKpError } = await supabase
            .from('knowledge_points')
            .insert([{
              title: kp.title,
              content: kp.content,
              summary: kp.summary,
              learning_material: kp.learning_material,
              keywords: kp.keywords,
              properties: kp.properties,
              visibility: kp.visibility,
              owner_id: kp.owner_id,
              mastery_level: kp.mastery_level ?? 0,
              source_knowledge_point_id: kp.id,
            }])
            .select('id')
            .single();

          if (createKpError) {
            logger.error('Copy knowledge point to branch error:', createKpError);
            throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
          }

          kpIdMap.set(kp.id, newKp.id);
        }
      }

      const { data: sourceNodes, error: nodesError } = await notDeleted(supabase
        .from('graph_nodes')
        .select('knowledge_point_id, x_position, y_position, level, is_accepted')
        .eq('graph_id', graphId)
        );

      if (nodesError) {
        logger.error('Query source nodes for branch error:', nodesError);
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
      }

      if (sourceNodes && sourceNodes.length > 0) {
        const nodeInserts = sourceNodes.map((n: { knowledge_point_id: string; x_position: number; y_position: number; level: number; is_accepted: boolean }) => ({
          graph_id: newGraphId,
          knowledge_point_id: kpIdMap.get(n.knowledge_point_id) ?? n.knowledge_point_id,
          x_position: n.x_position,
          y_position: n.y_position,
          level: n.level,
          is_accepted: n.is_accepted,
        }));

        const { error: insertNodesError } = await supabase
          .from('graph_nodes')
          .insert(nodeInserts);

        if (insertNodesError) {
          logger.error('Copy nodes to branch error:', insertNodesError);
          throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
      }

      const { data: sourceEdges, error: edgesError } = await notDeleted(supabase
        .from('edges')
        .select('source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
        .eq('graph_id', graphId)
        );

      if (edgesError) {
        logger.error('Query source edges for branch error:', edgesError);
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
      }

      if (sourceEdges && sourceEdges.length > 0) {
        const edgeInserts = sourceEdges.map((e: { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship_type: string; weight: number; custom_label: string | null; custom_color: string | null; custom_line_style: string | null; show_arrow: boolean }) => ({
          graph_id: newGraphId,
          source_knowledge_point_id: kpIdMap.get(e.source_knowledge_point_id) ?? e.source_knowledge_point_id,
          target_knowledge_point_id: kpIdMap.get(e.target_knowledge_point_id) ?? e.target_knowledge_point_id,
          relationship_type: e.relationship_type,
          weight: e.weight,
          custom_label: e.custom_label,
          custom_color: e.custom_color,
          custom_line_style: e.custom_line_style,
          show_arrow: e.show_arrow,
        }));

        const { error: insertEdgesError } = await supabase
          .from('edges')
          .insert(edgeInserts);

        if (insertEdgesError) {
          logger.error('Copy edges to branch error:', insertEdgesError);
          throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }
      }
    }

    // 记录事件（事务外）
    await this.recordEvent(supabase, graphId, 'graph_branch_created', {
      branch_graph_id: newGraphId,
      branch_name: branchName,
      snapshot_id: snapshot.id,
    }, operatorId);

    return {
      graphId: newGraphId,
      snapshotId: snapshot.id,
    };
  }

  async listBranches(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<BranchInfo[]> {
    const { data, error } = await notDeleted(supabase
      .from('knowledge_graphs')
      .select('id, title, branch_name, created_at')
      .eq('parent_graph_id', graphId)
      .eq('is_branch', true)
      );

    if (error) {
      logger.error('List branches error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return (data ?? []).map(b => ({
      id: b.id,
      title: b.title,
      branchName: b.branch_name ?? '',
      createdAt: b.created_at,
      nodeCount: 0,
      edgeCount: 0,
    }));
  }

  async mergeBranch(
    supabase: SupabaseClient,
    mainGraphId: string,
    branchGraphId: string,
  ): Promise<MergeResult> {
    const mainData = await this.buildCurrentSnapshotData(supabase, mainGraphId);
    const branchData = await this.buildCurrentSnapshotData(supabase, branchGraphId);

    // 构建分支 knowledge_point_id -> 原始 knowledge_point_id 的映射
    // 分支隔离后，分支的 knowledge_point 有独立的 ID，需要映射回主图 ID 才能正确 diff
    const branchKpToSourceKp = await this.buildBranchKpMapping(supabase, branchGraphId);

    // 将分支数据的 knowledgePointId 替换为原始 ID，以便与主图和源快照正确比较
    const mappedBranchData = this.mapBranchSnapshotData(branchData, branchKpToSourceKp);

    const diff = this.computeDiff(mainData, mappedBranchData);

    const { data: branchGraph } = await supabase
      .from('knowledge_graphs')
      .select('branch_source_snapshot_id')
      .eq('id', branchGraphId)
      .single();

    let sourceData: SnapshotData | null = null;
    if (branchGraph?.branch_source_snapshot_id) {
      const sourceSnapshot = await this.getSnapshot(supabase, branchGraph.branch_source_snapshot_id);
      sourceData = sourceSnapshot.snapshotData;
    }

    const conflicts: MergeConflict[] = [];

    if (sourceData) {
      const mainToSourceDiff = this.computeDiff(sourceData, mainData);
      const branchToSourceDiff = this.computeDiff(sourceData, mappedBranchData);

      const mainModifiedNodeIds = new Set(
        mainToSourceDiff.nodes.modified.map(n => n.knowledgePointId),
      );
      const branchModifiedNodeIds = new Set(
        branchToSourceDiff.nodes.modified.map(n => n.knowledgePointId),
      );

      for (const knowledgePointId of mainModifiedNodeIds) {
        if (branchModifiedNodeIds.has(knowledgePointId)) {
          const mainChange = mainToSourceDiff.nodes.modified.find(
            n => n.knowledgePointId === knowledgePointId,
          );
          const branchChange = branchToSourceDiff.nodes.modified.find(
            n => n.knowledgePointId === knowledgePointId,
          );
          if (mainChange && branchChange) {
            conflicts.push({
              entityType: 'node',
              entityId: knowledgePointId,
              knowledgePointId,
              mainChange,
              branchChange,
            });
          }
        }
      }

      const mainModifiedEdgeKeys = new Set(
        mainToSourceDiff.edges.modified.map(e => this.getEdgeKey(e.after ?? e.before!)),
      );
      const branchModifiedEdgeKeys = new Set(
        branchToSourceDiff.edges.modified.map(e => this.getEdgeKey(e.after ?? e.before!)),
      );

      for (const edgeKey of mainModifiedEdgeKeys) {
        if (branchModifiedEdgeKeys.has(edgeKey)) {
          const mainChange = mainToSourceDiff.edges.modified.find(
            e => this.getEdgeKey(e.after ?? e.before!) === edgeKey,
          );
          const branchChange = branchToSourceDiff.edges.modified.find(
            e => this.getEdgeKey(e.after ?? e.before!) === edgeKey,
          );
          if (mainChange && branchChange) {
            conflicts.push({
              entityType: 'edge',
              entityId: edgeKey,
              mainChange,
              branchChange,
            });
          }
        }
      }
    }

    return { diff, conflicts };
  }

  async applyMerge(
    supabase: SupabaseClient,
    mainGraphId: string,
    branchGraphId: string,
    selectedChanges: { nodeIds: string[]; edgeIds: string[]; removedNodeIds?: string[]; removedEdgeIds?: string[] },
    conflictResolutions: Record<string, 'main' | 'branch'>,
    operatorId: string | null,
  ): Promise<ApplyMergeResult> {
    // 先计算合并结果（supabase 查询）
    const mergeResult = await this.mergeBranch(supabase, mainGraphId, branchGraphId);
    const branchData = await this.buildCurrentSnapshotData(supabase, branchGraphId);

    // 构建分支 kp id -> 主图 kp id 的映射，用于合并时定位主图中的对应实体
    const branchKpToSourceKp = await this.buildBranchKpMapping(supabase, branchGraphId);
    // 反向映射：主图 kp id -> 分支 kp id，用于从 branchData 中查找分支节点
    const sourceKpToBranchKp = new Map<string, string>();
    for (const [branchKpId, sourceKpId] of branchKpToSourceKp) {
      sourceKpToBranchKp.set(sourceKpId, branchKpId);
    }

    let nodesAdded = 0;
    let edgesAdded = 0;
    let nodesModified = 0;
    let edgesModified = 0;
    let nodesRemoved = 0;
    let edgesRemoved = 0;
    let conflictsResolved = 0;

    const selectedNodeIds = new Set(selectedChanges.nodeIds);
    const selectedEdgeIds = new Set(selectedChanges.edgeIds);
    const selectedRemovedNodeIds = new Set(selectedChanges.removedNodeIds ?? []);
    const selectedRemovedEdgeIds = new Set(selectedChanges.removedEdgeIds ?? []);

    if (transactionExecutor.isAvailable()) {
      await transactionExecutor.executeInTransaction(async (client) => {
        // 应用新增节点
        for (const node of mergeResult.diff.nodes.added) {
          if (selectedNodeIds.has(node.knowledgePointId)) {
            const { rows: existingRows } = await client.query(
              'SELECT id, deleted_at FROM graph_nodes WHERE graph_id = $1 AND knowledge_point_id = $2 LIMIT 1',
              [mainGraphId, node.knowledgePointId],
            );

            const existingNode = existingRows[0] as { id: string; deleted_at: string | null } | undefined;

            if (existingNode) {
              if (existingNode.deleted_at) {
                await client.query(
                  'UPDATE graph_nodes SET deleted_at = NULL, x_position = $1, y_position = $2, level = $3, is_accepted = $4 WHERE id = $5',
                  [node.xPosition, node.yPosition, node.level, node.isAccepted, existingNode.id],
                );
              }
            } else {
              await client.query(
                'INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted) VALUES ($1, $2, $3, $4, $5, $6)',
                [mainGraphId, node.knowledgePointId, node.xPosition, node.yPosition, node.level, node.isAccepted],
              );
            }
            nodesAdded++;
          }
        }

        // 应用新增边
        for (const edge of mergeResult.diff.edges.added) {
          const edgeKey = this.getEdgeKey(edge);
          if (selectedEdgeIds.has(edgeKey)) {
            const { rows: existingRows } = await client.query(
              'SELECT id, deleted_at FROM edges WHERE graph_id = $1 AND source_knowledge_point_id = $2 AND target_knowledge_point_id = $3 AND relationship_type = $4 LIMIT 1',
              [mainGraphId, edge.sourceKnowledgePointId, edge.targetKnowledgePointId, edge.relationshipType],
            );

            const existingEdge = existingRows[0] as { id: string; deleted_at: string | null } | undefined;

            if (existingEdge) {
              if (existingEdge.deleted_at) {
                await client.query(
                  'UPDATE edges SET deleted_at = NULL, weight = $1, custom_label = $2, custom_color = $3, custom_line_style = $4, show_arrow = $5 WHERE id = $6',
                  [edge.weight, edge.customLabel, edge.customColor, edge.customLineStyle, edge.showArrow, existingEdge.id],
                );
              }
            } else {
              await client.query(
                'INSERT INTO edges (graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [mainGraphId, edge.sourceKnowledgePointId, edge.targetKnowledgePointId, edge.relationshipType, edge.weight, edge.customLabel, edge.customColor, edge.customLineStyle, edge.showArrow],
              );
            }
            edgesAdded++;
          }
        }

        // 应用修改节点
        for (const nodeDiff of mergeResult.diff.nodes.modified) {
          if (selectedNodeIds.has(nodeDiff.knowledgePointId)) {
            // mergeResult 中的 knowledgePointId 是主图的 id，需要映射到分支的 id 来查找 branchData
            const branchKpId = sourceKpToBranchKp.get(nodeDiff.knowledgePointId) ?? nodeDiff.knowledgePointId;
            const branchNode = branchData.nodes.find(
              n => n.knowledgePointId === branchKpId,
            );
            if (branchNode) {
              await client.query(
                'UPDATE graph_nodes SET x_position = $1, y_position = $2, level = $3, is_accepted = $4 WHERE graph_id = $5 AND knowledge_point_id = $6 AND deleted_at IS NULL',
                [branchNode.xPosition, branchNode.yPosition, branchNode.level, branchNode.isAccepted, mainGraphId, nodeDiff.knowledgePointId],
              );
            }
            nodesModified++;
          }
        }

        // 应用修改边
        for (const edgeDiff of mergeResult.diff.edges.modified) {
          const edgeKey = this.getEdgeKey(edgeDiff.after ?? edgeDiff.before!);
          if (selectedEdgeIds.has(edgeKey)) {
            const branchEdge = edgeDiff.after;
            if (branchEdge) {
              await client.query(
                'UPDATE edges SET weight = $1, custom_label = $2, custom_color = $3, custom_line_style = $4, show_arrow = $5 WHERE graph_id = $6 AND source_knowledge_point_id = $7 AND target_knowledge_point_id = $8 AND relationship_type = $9 AND deleted_at IS NULL',
                [branchEdge.weight, branchEdge.customLabel, branchEdge.customColor, branchEdge.customLineStyle, branchEdge.showArrow, mainGraphId, branchEdge.sourceKnowledgePointId, branchEdge.targetKnowledgePointId, branchEdge.relationshipType],
              );
            }
            edgesModified++;
          }
        }

        // 应用删除节点
        for (const node of mergeResult.diff.nodes.removed) {
          if (selectedRemovedNodeIds.has(node.knowledgePointId)) {
            await client.query(
              'UPDATE graph_nodes SET deleted_at = NOW() WHERE graph_id = $1 AND knowledge_point_id = $2 AND deleted_at IS NULL',
              [mainGraphId, node.knowledgePointId],
            );
            nodesRemoved++;
          }
        }

        // 应用删除边
        for (const edge of mergeResult.diff.edges.removed) {
          const edgeKey = this.getEdgeKey(edge);
          if (selectedRemovedEdgeIds.has(edgeKey)) {
            await client.query(
              'UPDATE edges SET deleted_at = NOW() WHERE graph_id = $1 AND source_knowledge_point_id = $2 AND target_knowledge_point_id = $3 AND relationship_type = $4 AND deleted_at IS NULL',
              [mainGraphId, edge.sourceKnowledgePointId, edge.targetKnowledgePointId, edge.relationshipType],
            );
            edgesRemoved++;
          }
        }

        // 解决冲突
        for (const conflict of mergeResult.conflicts) {
          const resolution = conflictResolutions[conflict.entityId];
          if (!resolution) continue;

          if (conflict.entityType === 'node') {
            const sourceData = resolution === 'branch' ? conflict.branchChange.after : conflict.mainChange.after;
            if (sourceData && 'knowledgePointId' in sourceData) {
              const nodeData = sourceData as SnapshotNodeData;
              await client.query(
                'UPDATE graph_nodes SET x_position = $1, y_position = $2, level = $3, is_accepted = $4 WHERE graph_id = $5 AND knowledge_point_id = $6 AND deleted_at IS NULL',
                [nodeData.xPosition, nodeData.yPosition, nodeData.level, nodeData.isAccepted, mainGraphId, nodeData.knowledgePointId],
              );
              // 更新 knowledge_point 内容（如果 content 或 summary 有变更）
              // TODO: Task 2 完成分支知识点隔离后，需通过 source_knowledge_point_id 映射到主图原始 kp id
              if (nodeData.content !== undefined || nodeData.summary !== undefined) {
                await client.query(
                  'UPDATE knowledge_points SET content = COALESCE($1, content), summary = $2, updated_at = NOW() WHERE id = $3',
                  [nodeData.content, nodeData.summary, nodeData.knowledgePointId],
                );
              }
            }
          } else if (conflict.entityType === 'edge') {
            const sourceData = resolution === 'branch' ? conflict.branchChange.after : conflict.mainChange.after;
            if (sourceData && 'sourceKnowledgePointId' in sourceData) {
              const edgeData = sourceData as SnapshotEdgeData;
              await client.query(
                'UPDATE edges SET weight = $1, custom_label = $2, custom_color = $3, custom_line_style = $4, show_arrow = $5 WHERE graph_id = $6 AND source_knowledge_point_id = $7 AND target_knowledge_point_id = $8 AND relationship_type = $9 AND deleted_at IS NULL',
                [edgeData.weight, edgeData.customLabel, edgeData.customColor, edgeData.customLineStyle, edgeData.showArrow, mainGraphId, edgeData.sourceKnowledgePointId, edgeData.targetKnowledgePointId, edgeData.relationshipType],
              );
            }
          }
          conflictsResolved++;
        }
      });

      // 合并成功后自动创建 post_merge 快照（事务外，使用 supabase）
      await this.autoSnapshot(supabase, mainGraphId, 'auto', operatorId);
    } else {
      logger.warn('TransactionExecutor unavailable, applyMerge executing without transaction guarantee');

      for (const node of mergeResult.diff.nodes.added) {
        if (selectedNodeIds.has(node.knowledgePointId)) {
          const { data: existingNode } = await supabase
            .from('graph_nodes')
            .select('id, deleted_at')
            .eq('graph_id', mainGraphId)
            .eq('knowledge_point_id', node.knowledgePointId)
            .maybeSingle();

          if (existingNode) {
            if (existingNode.deleted_at) {
              await supabase
                .from('graph_nodes')
                .update({
                  deleted_at: null,
                  x_position: node.xPosition,
                  y_position: node.yPosition,
                  level: node.level,
                  is_accepted: node.isAccepted,
                })
                .eq('id', existingNode.id);
            }
          } else {
            await supabase
              .from('graph_nodes')
              .insert([{
                graph_id: mainGraphId,
                knowledge_point_id: node.knowledgePointId,
                x_position: node.xPosition,
                y_position: node.yPosition,
                level: node.level,
                is_accepted: node.isAccepted,
              }]);
          }
          nodesAdded++;
        }
      }

      for (const edge of mergeResult.diff.edges.added) {
        const edgeKey = this.getEdgeKey(edge);
        if (selectedEdgeIds.has(edgeKey)) {
          const { data: existingEdge } = await supabase
            .from('edges')
            .select('id, deleted_at')
            .eq('graph_id', mainGraphId)
            .eq('source_knowledge_point_id', edge.sourceKnowledgePointId)
            .eq('target_knowledge_point_id', edge.targetKnowledgePointId)
            .eq('relationship_type', edge.relationshipType)
            .maybeSingle();

          if (existingEdge) {
            if (existingEdge.deleted_at) {
              await supabase
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
            }
          } else {
            await supabase
              .from('edges')
              .insert([{
                graph_id: mainGraphId,
                source_knowledge_point_id: edge.sourceKnowledgePointId,
                target_knowledge_point_id: edge.targetKnowledgePointId,
                relationship_type: edge.relationshipType,
                weight: edge.weight,
                custom_label: edge.customLabel,
                custom_color: edge.customColor,
                custom_line_style: edge.customLineStyle,
                show_arrow: edge.showArrow,
              }]);
          }
          edgesAdded++;
        }
      }

      for (const nodeDiff of mergeResult.diff.nodes.modified) {
        if (selectedNodeIds.has(nodeDiff.knowledgePointId)) {
          const branchKpId = sourceKpToBranchKp.get(nodeDiff.knowledgePointId) ?? nodeDiff.knowledgePointId;
          const branchNode = branchData.nodes.find(
            n => n.knowledgePointId === branchKpId,
          );
          if (branchNode) {
            await notDeleted(supabase
              .from('graph_nodes')
              .update({
                x_position: branchNode.xPosition,
                y_position: branchNode.yPosition,
                level: branchNode.level,
                is_accepted: branchNode.isAccepted,
              })
              .eq('graph_id', mainGraphId)
              .eq('knowledge_point_id', nodeDiff.knowledgePointId)
              );
            // 更新 knowledge_point 内容（如果有变更）
            // TODO: Task 2 完成分支知识点隔离后，需通过 source_knowledge_point_id 映射到主图原始 kp id
            if (nodeDiff.changedFields.includes('content') || nodeDiff.changedFields.includes('summary')) {
              await supabase
                .from('knowledge_points')
                .update({
                  content: branchNode.content,
                  summary: branchNode.summary,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', branchNode.knowledgePointId);
            }
          }
          nodesModified++;
        }
      }

      for (const edgeDiff of mergeResult.diff.edges.modified) {
        const edgeKey = this.getEdgeKey(edgeDiff.after ?? edgeDiff.before!);
        if (selectedEdgeIds.has(edgeKey)) {
          const branchEdge = edgeDiff.after;
          if (branchEdge) {
            await notDeleted(supabase
              .from('edges')
              .update({
                weight: branchEdge.weight,
                custom_label: branchEdge.customLabel,
                custom_color: branchEdge.customColor,
                custom_line_style: branchEdge.customLineStyle,
                show_arrow: branchEdge.showArrow,
              })
              .eq('graph_id', mainGraphId)
              .eq('source_knowledge_point_id', branchEdge.sourceKnowledgePointId)
              .eq('target_knowledge_point_id', branchEdge.targetKnowledgePointId)
              .eq('relationship_type', branchEdge.relationshipType)
              );
          }
          edgesModified++;
        }
      }

      // 应用删除节点 (fallback)
      for (const node of mergeResult.diff.nodes.removed) {
        if (selectedRemovedNodeIds.has(node.knowledgePointId)) {
          await notDeleted(supabase
            .from('graph_nodes')
            .update({ deleted_at: new Date().toISOString() })
            .eq('graph_id', mainGraphId)
            .eq('knowledge_point_id', node.knowledgePointId)
            );
          nodesRemoved++;
        }
      }

      // 应用删除边 (fallback)
      for (const edge of mergeResult.diff.edges.removed) {
        const edgeKey = this.getEdgeKey(edge);
        if (selectedRemovedEdgeIds.has(edgeKey)) {
          await notDeleted(supabase
            .from('edges')
            .update({ deleted_at: new Date().toISOString() })
            .eq('graph_id', mainGraphId)
            .eq('source_knowledge_point_id', edge.sourceKnowledgePointId)
            .eq('target_knowledge_point_id', edge.targetKnowledgePointId)
            .eq('relationship_type', edge.relationshipType)
            );
          edgesRemoved++;
        }
      }

      for (const conflict of mergeResult.conflicts) {
        const resolution = conflictResolutions[conflict.entityId];
        if (!resolution) continue;

        if (conflict.entityType === 'node') {
          const sourceData = resolution === 'branch' ? conflict.branchChange.after : conflict.mainChange.after;
          if (sourceData && 'knowledgePointId' in sourceData) {
            const nodeData = sourceData as SnapshotNodeData;
            await notDeleted(supabase
              .from('graph_nodes')
              .update({
                x_position: nodeData.xPosition,
                y_position: nodeData.yPosition,
                level: nodeData.level,
                is_accepted: nodeData.isAccepted,
              })
              .eq('graph_id', mainGraphId)
              .eq('knowledge_point_id', nodeData.knowledgePointId)
              );
          }
        } else if (conflict.entityType === 'edge') {
          const sourceData = resolution === 'branch' ? conflict.branchChange.after : conflict.mainChange.after;
          if (sourceData && 'sourceKnowledgePointId' in sourceData) {
            const edgeData = sourceData as SnapshotEdgeData;
            await notDeleted(supabase
              .from('edges')
              .update({
                weight: edgeData.weight,
                custom_label: edgeData.customLabel,
                custom_color: edgeData.customColor,
                custom_line_style: edgeData.customLineStyle,
                show_arrow: edgeData.showArrow,
              })
              .eq('graph_id', mainGraphId)
              .eq('source_knowledge_point_id', edgeData.sourceKnowledgePointId)
              .eq('target_knowledge_point_id', edgeData.targetKnowledgePointId)
              .eq('relationship_type', edgeData.relationshipType)
              );
          }
        }
        conflictsResolved++;
      }

      // 合并成功后自动创建 post_merge 快照（fallback 路径）
      await this.autoSnapshot(supabase, mainGraphId, 'auto', operatorId);
    }

    // 记录事件（事务外）
    await this.recordEvent(supabase, mainGraphId, 'graph_merged', {
      branch_graph_id: branchGraphId,
      nodes_added: nodesAdded,
      edges_added: edgesAdded,
      nodes_modified: nodesModified,
      edges_modified: edgesModified,
      nodes_removed: nodesRemoved,
      edges_removed: edgesRemoved,
      conflicts_resolved: conflictsResolved,
    }, operatorId);

    // 缓存失效（事务外）
    await cacheService.invalidateAllGraphRelated(operatorId ?? '', mainGraphId);

    return {
      nodesAdded,
      edgesAdded,
      nodesModified,
      edgesModified,
      nodesRemoved,
      edgesRemoved,
      conflictsResolved,
    };
  }

  private async buildBranchKpMapping(
    supabase: SupabaseClient,
    branchGraphId: string,
  ): Promise<Map<string, string>> {
    const mapping = new Map<string, string>();

    const { data, error } = await supabase
      .from('knowledge_points')
      .select('id, source_knowledge_point_id')
      .in('id', (
        await notDeleted(supabase
          .from('graph_nodes')
          .select('knowledge_point_id')
          .eq('graph_id', branchGraphId)
          )
      ).data?.map((n: { knowledge_point_id: string }) => n.knowledge_point_id) ?? []);

    if (error) {
      logger.warn('Build branch kp mapping error, using empty mapping:', error);
      return mapping;
    }

    for (const kp of (data ?? [])) {
      if (kp.source_knowledge_point_id) {
        mapping.set(kp.id, kp.source_knowledge_point_id);
      }
    }

    return mapping;
  }

  private mapBranchSnapshotData(
    data: SnapshotData,
    kpMapping: Map<string, string>,
  ): SnapshotData {
    if (kpMapping.size === 0) return data;

    return {
      nodes: data.nodes.map(node => ({
        ...node,
        knowledgePointId: kpMapping.get(node.knowledgePointId) ?? node.knowledgePointId,
      })),
      edges: data.edges.map(edge => ({
        ...edge,
        sourceKnowledgePointId: kpMapping.get(edge.sourceKnowledgePointId) ?? edge.sourceKnowledgePointId,
        targetKnowledgePointId: kpMapping.get(edge.targetKnowledgePointId) ?? edge.targetKnowledgePointId,
      })),
    };
  }

  private async buildCurrentSnapshotData(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<SnapshotData> {
    const { data: nodes, error: nodesError } = await notDeleted(supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id, x_position, y_position, level, is_accepted, knowledge_points(title, content, summary)')
      .eq('graph_id', graphId)
      );

    if (nodesError) {
      logger.error('Query current nodes error:', nodesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const { data: edges, error: edgesError } = await notDeleted(supabase
      .from('edges')
      .select('id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
      .eq('graph_id', graphId)
      );

    if (edgesError) {
      logger.error('Query current edges error:', edgesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const snapshotNodes: SnapshotNodeData[] = ((nodes ?? []) as unknown as GraphNodeSnapshotRow[]).map((node) => ({
      id: node.id,
      knowledgePointId: node.knowledge_point_id,
      title: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.title ?? '')
        : (node.knowledge_points?.title ?? ''),
      content: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.content ?? '')
        : (node.knowledge_points?.content ?? ''),
      summary: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.summary ?? null)
        : (node.knowledge_points?.summary ?? null),
      xPosition: node.x_position,
      yPosition: node.y_position,
      level: node.level,
      isAccepted: node.is_accepted,
    }));

    const snapshotEdges: SnapshotEdgeData[] = ((edges ?? []) as unknown as EdgeSnapshotRow[]).map((edge) => ({
      id: edge.id,
      sourceKnowledgePointId: edge.source_knowledge_point_id,
      targetKnowledgePointId: edge.target_knowledge_point_id,
      relationshipType: edge.relationship_type,
      weight: edge.weight,
      customLabel: edge.custom_label,
      customColor: edge.custom_color,
      customLineStyle: edge.custom_line_style,
      showArrow: edge.show_arrow,
    }));

    return { nodes: snapshotNodes, edges: snapshotEdges };
  }

  private computeDiff(source: SnapshotData, target: SnapshotData): DiffResult {
    const sourceNodeMap = new Map(source.nodes.map(n => [n.knowledgePointId, n]));
    const targetNodeMap = new Map(target.nodes.map(n => [n.knowledgePointId, n]));

    const addedNodes: SnapshotNodeData[] = [];
    const removedNodes: SnapshotNodeData[] = [];
    const modifiedNodes: NodeDiff[] = [];

    for (const [kpId, targetNode] of targetNodeMap) {
      if (!sourceNodeMap.has(kpId)) {
        addedNodes.push(targetNode);
      }
    }

    for (const [kpId, sourceNode] of sourceNodeMap) {
      if (!targetNodeMap.has(kpId)) {
        removedNodes.push(sourceNode);
      }
    }

    for (const [kpId, sourceNode] of sourceNodeMap) {
      const targetNode = targetNodeMap.get(kpId);
      if (!targetNode) continue;

      const changedFields: string[] = [];
      if (sourceNode.xPosition !== targetNode.xPosition) changedFields.push('xPosition');
      if (sourceNode.yPosition !== targetNode.yPosition) changedFields.push('yPosition');
      if (sourceNode.level !== targetNode.level) changedFields.push('level');
      if (sourceNode.title !== targetNode.title) changedFields.push('title');
      if (sourceNode.content !== targetNode.content) changedFields.push('content');
      if (sourceNode.summary !== targetNode.summary) changedFields.push('summary');

      if (changedFields.length > 0) {
        modifiedNodes.push({
          id: kpId,
          knowledgePointId: kpId,
          changeType: 'modified',
          before: sourceNode,
          after: targetNode,
          changedFields,
        });
      }
    }

    const sourceEdgeMap = new Map(source.edges.map(e => [this.getEdgeKey(e), e]));
    const targetEdgeMap = new Map(target.edges.map(e => [this.getEdgeKey(e), e]));

    const addedEdges: SnapshotEdgeData[] = [];
    const removedEdges: SnapshotEdgeData[] = [];
    const modifiedEdges: EdgeDiff[] = [];

    for (const [key, targetEdge] of targetEdgeMap) {
      if (!sourceEdgeMap.has(key)) {
        addedEdges.push(targetEdge);
      }
    }

    for (const [key, sourceEdge] of sourceEdgeMap) {
      if (!targetEdgeMap.has(key)) {
        removedEdges.push(sourceEdge);
      }
    }

    for (const [key, sourceEdge] of sourceEdgeMap) {
      const targetEdge = targetEdgeMap.get(key);
      if (!targetEdge) continue;

      const changedFields: string[] = [];
      if (sourceEdge.weight !== targetEdge.weight) changedFields.push('weight');
      if (sourceEdge.customLabel !== targetEdge.customLabel) changedFields.push('customLabel');
      if (sourceEdge.customColor !== targetEdge.customColor) changedFields.push('customColor');
      if (sourceEdge.customLineStyle !== targetEdge.customLineStyle) changedFields.push('customLineStyle');
      if (sourceEdge.showArrow !== targetEdge.showArrow) changedFields.push('showArrow');

      if (changedFields.length > 0) {
        modifiedEdges.push({
          id: key,
          changeType: 'modified',
          before: sourceEdge,
          after: targetEdge,
          changedFields,
        });
      }
    }

    const totalChanges =
      addedNodes.length +
      removedNodes.length +
      modifiedNodes.length +
      addedEdges.length +
      removedEdges.length +
      modifiedEdges.length;

    return {
      nodes: {
        added: addedNodes,
        removed: removedNodes,
        modified: modifiedNodes,
      },
      edges: {
        added: addedEdges,
        removed: removedEdges,
        modified: modifiedEdges,
      },
      summary: {
        totalChanges,
        nodesAdded: addedNodes.length,
        nodesRemoved: removedNodes.length,
        nodesModified: modifiedNodes.length,
        edgesAdded: addedEdges.length,
        edgesRemoved: removedEdges.length,
        edgesModified: modifiedEdges.length,
      },
    };
  }

  private getEdgeKey(edge: SnapshotEdgeData): string {
    return `${edge.sourceKnowledgePointId}:${edge.targetKnowledgePointId}:${edge.relationshipType}`;
  }

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
