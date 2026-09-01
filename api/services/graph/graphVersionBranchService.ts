import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type {
  SnapshotData,
  SnapshotNodeData,
  SnapshotEdgeData,
  MergeConflict,
  MergeResult,
  BranchInfo,
} from '../../../shared/types/graphVersion';
import { cacheService } from '../common/cacheService';
import { transactionExecutor } from '../../database/transactionExecutor';
import { notDeleted } from '../common/softDeleteHelper';
import {
  buildCurrentSnapshotData,
  computeDiff,
  getEdgeKey,
} from './graphVersionShared';
import type { GraphVersionService } from './graphVersionService';

interface ApplyMergeResult {
  nodesAdded: number;
  edgesAdded: number;
  nodesModified: number;
  edgesModified: number;
  nodesRemoved: number;
  edgesRemoved: number;
  conflictsResolved: number;
}

/**
 * 图谱分支服务：负责分支创建、列表、合并与冲突解决。
 * 依赖核心 GraphVersionService 提供快照/事件能力（构造注入，避免循环依赖）。
 */
export class GraphVersionBranchService {
  constructor(private readonly core: GraphVersionService) {}

  async createBranch(
    supabase: SupabaseClient,
    graphId: string,
    branchName: string,
    operatorId: string | null,
  ): Promise<{ graphId: string; snapshotId: string }> {
    const snapshot = await this.core.autoSnapshot(supabase, graphId, 'auto', operatorId);

    const { data: originalGraphRaw, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('user_id, title, description, domain, settings, template_type, knowledge_graph_contents(podcast_script, reference_books, external_links, learning_guide)')
      .eq('id', graphId)
      .single();

    if (graphError || !originalGraphRaw) {
      logger.error('Get original graph for branch error:', graphError);
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    // 平铺 knowledge_graph_contents 子表字段，保持后续代码兼容
    // 注意：类型系统可能将 1:1 嵌套查询推断为数组，运行时实际返回单个对象
    const originalContentRaw = originalGraphRaw.knowledge_graph_contents;
    const originalContent = Array.isArray(originalContentRaw)
      ? originalContentRaw[0]
      : originalContentRaw;
    const originalGraph = {
      ...originalGraphRaw,
      reference_books: originalContent?.reference_books ?? null,
      external_links: originalContent?.external_links ?? null,
      learning_guide: originalContent?.learning_guide ?? null,
      podcast_script: originalContent?.podcast_script ?? null,
    };

    let newGraphId: string;

    if (transactionExecutor.isAvailable()) {
      newGraphId = await transactionExecutor.executeInTransaction(async (client) => {
        // 创建新图谱（内容性字段已迁移到 knowledge_graph_contents）
        const { rows: newGraphRows } = await client.query(
          `INSERT INTO knowledge_graphs (user_id, title, description, domain, settings, template_type, is_branch, parent_graph_id, branch_name, branch_source_snapshot_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            originalGraph.user_id,
            `${originalGraph.title} - ${branchName}`,
            originalGraph.description,
            originalGraph.domain,
            JSON.stringify(originalGraph.settings),
            originalGraph.template_type,
            true,
            graphId,
            branchName,
            snapshot.id,
          ],
        );

        const createdGraphId = newGraphRows[0].id as string;

        // 复制 knowledge_graph_contents 记录（1:1 子表）
        await client.query(
          `INSERT INTO knowledge_graph_contents (graph_id, podcast_script, reference_books, external_links, learning_guide)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            createdGraphId,
            originalGraph.podcast_script ?? null,
            originalGraph.reference_books ? JSON.stringify(originalGraph.reference_books) : null,
            originalGraph.external_links ? JSON.stringify(originalGraph.external_links) : null,
            originalGraph.learning_guide ?? null,
          ],
        );

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

      // 复制 knowledge_graph_contents 记录（1:1 子表）
      try {
        await supabase
          .from('knowledge_graph_contents')
          .upsert({
            graph_id: newGraphId,
            podcast_script: originalGraph.podcast_script ?? null,
            reference_books: originalGraph.reference_books ?? null,
            external_links: originalGraph.external_links ?? null,
            learning_guide: originalGraph.learning_guide ?? null,
          }, { onConflict: 'graph_id' });
      } catch (contentInsertError) {
        logger.warn('Failed to copy knowledge_graph_contents for branch:', contentInsertError);
      }

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
    await this.core.recordEvent(supabase, graphId, 'graph_branch_created', {
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
    const mainData = await buildCurrentSnapshotData(supabase, mainGraphId);
    const branchData = await buildCurrentSnapshotData(supabase, branchGraphId);

    // 构建分支 knowledge_point_id -> 原始 knowledge_point_id 的映射
    // 分支隔离后，分支的 knowledge_point 有独立的 ID，需要映射回主图 ID 才能正确 diff
    const branchKpToSourceKp = await this.buildBranchKpMapping(supabase, branchGraphId);

    // 将分支数据的 knowledgePointId 替换为原始 ID，以便与主图和源快照正确比较
    const mappedBranchData = this.mapBranchSnapshotData(branchData, branchKpToSourceKp);

    const diff = computeDiff(mainData, mappedBranchData);

    const { data: branchGraph } = await supabase
      .from('knowledge_graphs')
      .select('branch_source_snapshot_id')
      .eq('id', branchGraphId)
      .single();

    let sourceData: SnapshotData | null = null;
    if (branchGraph?.branch_source_snapshot_id) {
      const sourceSnapshot = await this.core.getSnapshot(supabase, branchGraph.branch_source_snapshot_id);
      sourceData = sourceSnapshot.snapshotData;
    }

    const conflicts: MergeConflict[] = [];

    if (sourceData) {
      const mainToSourceDiff = computeDiff(sourceData, mainData);
      const branchToSourceDiff = computeDiff(sourceData, mappedBranchData);

      const mainModifiedNodeIds = new Set(
        mainToSourceDiff.nodes.modified.map(n => n.knowledgePointId),
      );
      const branchModifiedNodeIds = new Set(
        branchToSourceDiff.nodes.modified.map(n => n.knowledgePointId),
      );
      // 复杂度降低：预构建 modified 节点/边索引，替代下方循环内对 same 数组的 O(n) 线性扫描
      const mainModifiedNodesById = new Map(
        mainToSourceDiff.nodes.modified.map(n => [n.knowledgePointId, n]),
      );
      const branchModifiedNodesById = new Map(
        branchToSourceDiff.nodes.modified.map(n => [n.knowledgePointId, n]),
      );

      for (const knowledgePointId of mainModifiedNodeIds) {
        if (branchModifiedNodeIds.has(knowledgePointId)) {
          const mainChange = mainModifiedNodesById.get(knowledgePointId);
          const branchChange = branchModifiedNodesById.get(knowledgePointId);
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
        mainToSourceDiff.edges.modified
          .map(e => e.after ?? e.before)
          .filter((e): e is SnapshotEdgeData => e !== null)
          .map(e => getEdgeKey(e)),
      );
      const branchModifiedEdgeKeys = new Set(
        branchToSourceDiff.edges.modified
          .map(e => e.after ?? e.before)
          .filter((e): e is SnapshotEdgeData => e !== null)
          .map(e => getEdgeKey(e)),
      );
      // 复杂度降低：预构建 edge key->变更对象索引，替代下方循环内对 same 数组的 O(n) 线性扫描
      const mainModifiedEdgesByKey = new Map(
        mainToSourceDiff.edges.modified
          .filter((e) => (e.after ?? e.before) !== null)
          .map((e) => [getEdgeKey((e.after ?? e.before) as SnapshotEdgeData), e]),
      );
      const branchModifiedEdgesByKey = new Map(
        branchToSourceDiff.edges.modified
          .filter((e) => (e.after ?? e.before) !== null)
          .map((e) => [getEdgeKey((e.after ?? e.before) as SnapshotEdgeData), e]),
      );

      for (const edgeKey of mainModifiedEdgeKeys) {
        if (branchModifiedEdgeKeys.has(edgeKey)) {
          const mainChange = mainModifiedEdgesByKey.get(edgeKey);
          const branchChange = branchModifiedEdgesByKey.get(edgeKey);
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
    const branchData = await buildCurrentSnapshotData(supabase, branchGraphId);
    // 复杂度降低：预构建分支节点 id 索引，替代下方循环内对 branchData.nodes 的 O(n) 线性扫描
    const branchNodeByKpId = new Map(
      branchData.nodes.map((n) => [n.knowledgePointId, n]),
    );

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
          const edgeKey = getEdgeKey(edge);
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
            const branchNode = branchNodeByKpId.get(branchKpId);
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
          const edge = edgeDiff.after ?? edgeDiff.before;
          if (!edge) continue;
          const edgeKey = getEdgeKey(edge);
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
          const edgeKey = getEdgeKey(edge);
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
              // TODO: 分支知识点隔离基础设施已就绪（knowledge_points.source_knowledge_point_id
              // 列 + buildBranchKpMapping 映射已实现），但本合并路径仍用分支 kp id 直接更新
              // knowledge_points，需改用映射后的主图原始 kp id。
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
      await this.core.autoSnapshot(supabase, mainGraphId, 'auto', operatorId);
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
        const edgeKey = getEdgeKey(edge);
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
          const branchNode = branchNodeByKpId.get(branchKpId);
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
            // TODO: 分支知识点隔离基础设施已就绪（knowledge_points.source_knowledge_point_id
            // 列 + buildBranchKpMapping 映射已实现），但本合并路径仍用分支 kp id 直接更新
            // knowledge_points，需改用映射后的主图原始 kp id。
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
        const edge = edgeDiff.after ?? edgeDiff.before;
        if (!edge) continue;
        const edgeKey = getEdgeKey(edge);
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
        const edgeKey = getEdgeKey(edge);
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
      await this.core.autoSnapshot(supabase, mainGraphId, 'auto', operatorId);
    }

    // 记录事件（事务外）
    await this.core.recordEvent(supabase, mainGraphId, 'graph_merged', {
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
}
