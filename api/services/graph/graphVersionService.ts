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
} from '../../../shared/types/graphVersion';
import { cacheService } from '../common/cacheService';
import { appEventBus } from '../core/eventBus';
import type { GraphRollbackPayload } from '../../../shared/types/events';

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
  conflictsResolved: number;
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
    const { data: nodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id, x_position, y_position, level, is_accepted, knowledge_points(title)')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (nodesError) {
      logger.error('Query graph nodes for snapshot error:', nodesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (edgesError) {
      logger.error('Query edges for snapshot error:', edgesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const snapshotNodes: SnapshotNodeData[] = (nodes ?? []).map((node: any) => ({
      id: node.id,
      knowledgePointId: node.knowledge_point_id,
      title: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.title ?? '')
        : (node.knowledge_points?.title ?? ''),
      xPosition: node.x_position,
      yPosition: node.y_position,
      level: node.level,
      isAccepted: node.is_accepted,
    }));

    const snapshotEdges: SnapshotEdgeData[] = (edges ?? []).map((edge: any) => ({
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

    const { data: currentNodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select('id')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (nodesError) {
      logger.error('Query current nodes for rollback error:', nodesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    if (currentNodes && currentNodes.length > 0) {
      const currentNodeIds = currentNodes.map((n: any) => n.id);
      const { error: softDeleteNodesError } = await supabase
        .from('graph_nodes')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', currentNodeIds);

      if (softDeleteNodesError) {
        logger.error('Soft delete nodes for rollback error:', softDeleteNodesError);
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
      }

      const { error: softDeleteEdgesError } = await supabase
        .from('edges')
        .update({ deleted_at: new Date().toISOString() })
        .eq('graph_id', graphId)
        .is('deleted_at', null);

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

    await this.recordEvent(supabase, graphId, 'graph_rollback', {
      snapshot_id: snapshotId,
      pre_rollback_snapshot_id: preRollbackSnapshot.id,
    }, operatorId);

    await cacheService.invalidateAllGraphRelated(operatorId ?? '', graphId);
    await appEventBus.publish(
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

    const { data: sourceNodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select('knowledge_point_id, x_position, y_position, level, is_accepted')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (nodesError) {
      logger.error('Query source nodes for branch error:', nodesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    if (sourceNodes && sourceNodes.length > 0) {
      const nodeInserts = sourceNodes.map((n: any) => ({
        graph_id: newGraph.id,
        knowledge_point_id: n.knowledge_point_id,
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

    const { data: sourceEdges, error: edgesError } = await supabase
      .from('edges')
      .select('source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (edgesError) {
      logger.error('Query source edges for branch error:', edgesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    if (sourceEdges && sourceEdges.length > 0) {
      const edgeInserts = sourceEdges.map((e: any) => ({
        graph_id: newGraph.id,
        source_knowledge_point_id: e.source_knowledge_point_id,
        target_knowledge_point_id: e.target_knowledge_point_id,
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

    await this.recordEvent(supabase, graphId, 'graph_branch_created', {
      branch_graph_id: newGraph.id,
      branch_name: branchName,
      snapshot_id: snapshot.id,
    }, operatorId);

    return {
      graphId: newGraph.id,
      snapshotId: snapshot.id,
    };
  }

  async listBranches(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('parent_graph_id', graphId)
      .eq('is_branch', true)
      .is('deleted_at', null);

    if (error) {
      logger.error('List branches error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data ?? [];
  }

  async mergeBranch(
    supabase: SupabaseClient,
    mainGraphId: string,
    branchGraphId: string,
  ): Promise<MergeResult> {
    const mainData = await this.buildCurrentSnapshotData(supabase, mainGraphId);
    const branchData = await this.buildCurrentSnapshotData(supabase, branchGraphId);

    const diff = this.computeDiff(mainData, branchData);

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
      const branchToSourceDiff = this.computeDiff(sourceData, branchData);

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
    selectedChanges: { nodeIds: string[]; edgeIds: string[] },
    conflictResolutions: Record<string, 'main' | 'branch'>,
    operatorId: string | null,
  ): Promise<ApplyMergeResult> {
    const mergeResult = await this.mergeBranch(supabase, mainGraphId, branchGraphId);
    const branchData = await this.buildCurrentSnapshotData(supabase, branchGraphId);

    let nodesAdded = 0;
    let edgesAdded = 0;
    let nodesModified = 0;
    let edgesModified = 0;
    let conflictsResolved = 0;

    const selectedNodeIds = new Set(selectedChanges.nodeIds);
    const selectedEdgeIds = new Set(selectedChanges.edgeIds);

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
        const branchNode = branchData.nodes.find(
          n => n.knowledgePointId === nodeDiff.knowledgePointId,
        );
        if (branchNode) {
          await supabase
            .from('graph_nodes')
            .update({
              x_position: branchNode.xPosition,
              y_position: branchNode.yPosition,
              level: branchNode.level,
              is_accepted: branchNode.isAccepted,
            })
            .eq('graph_id', mainGraphId)
            .eq('knowledge_point_id', branchNode.knowledgePointId)
            .is('deleted_at', null);
        }
        nodesModified++;
      }
    }

    for (const edgeDiff of mergeResult.diff.edges.modified) {
      const edgeKey = this.getEdgeKey(edgeDiff.after ?? edgeDiff.before!);
      if (selectedEdgeIds.has(edgeKey)) {
        const branchEdge = edgeDiff.after;
        if (branchEdge) {
          await supabase
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
            .is('deleted_at', null);
        }
        edgesModified++;
      }
    }

    for (const conflict of mergeResult.conflicts) {
      const resolution = conflictResolutions[conflict.entityId];
      if (!resolution) continue;

      if (conflict.entityType === 'node') {
        const sourceData = resolution === 'branch' ? conflict.branchChange.after : conflict.mainChange.after;
        if (sourceData && 'knowledgePointId' in sourceData) {
          const nodeData = sourceData as SnapshotNodeData;
          await supabase
            .from('graph_nodes')
            .update({
              x_position: nodeData.xPosition,
              y_position: nodeData.yPosition,
              level: nodeData.level,
              is_accepted: nodeData.isAccepted,
            })
            .eq('graph_id', mainGraphId)
            .eq('knowledge_point_id', nodeData.knowledgePointId)
            .is('deleted_at', null);
        }
      } else if (conflict.entityType === 'edge') {
        const sourceData = resolution === 'branch' ? conflict.branchChange.after : conflict.mainChange.after;
        if (sourceData && 'sourceKnowledgePointId' in sourceData) {
          const edgeData = sourceData as SnapshotEdgeData;
          await supabase
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
            .is('deleted_at', null);
        }
      }
      conflictsResolved++;
    }

    await this.recordEvent(supabase, mainGraphId, 'graph_merged', {
      branch_graph_id: branchGraphId,
      nodes_added: nodesAdded,
      edges_added: edgesAdded,
      nodes_modified: nodesModified,
      edges_modified: edgesModified,
      conflicts_resolved: conflictsResolved,
    }, operatorId);

    return {
      nodesAdded,
      edgesAdded,
      nodesModified,
      edgesModified,
      conflictsResolved,
    };
  }

  private async buildCurrentSnapshotData(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<SnapshotData> {
    const { data: nodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id, x_position, y_position, level, is_accepted, knowledge_points(title)')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (nodesError) {
      logger.error('Query current nodes error:', nodesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight, custom_label, custom_color, custom_line_style, show_arrow')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (edgesError) {
      logger.error('Query current edges error:', edgesError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    const snapshotNodes: SnapshotNodeData[] = (nodes ?? []).map((node: any) => ({
      id: node.id,
      knowledgePointId: node.knowledge_point_id,
      title: Array.isArray(node.knowledge_points)
        ? (node.knowledge_points[0]?.title ?? '')
        : (node.knowledge_points?.title ?? ''),
      xPosition: node.x_position,
      yPosition: node.y_position,
      level: node.level,
      isAccepted: node.is_accepted,
    }));

    const snapshotEdges: SnapshotEdgeData[] = (edges ?? []).map((edge: any) => ({
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

  private mapEvent(data: any): GraphEvent {
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

  private mapSnapshot(data: any): GraphSnapshot {
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
