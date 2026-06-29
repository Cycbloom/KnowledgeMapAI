import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { GraphNode, GraphNodeWithKnowledgePoint, NodeLevel } from '@shared/types';
import { buildNodeFromGraphNode, GRAPH_NODES_SELECT } from '../../utils/nodeHelpers';
import { softDelete, softDeleteBatch } from '../../utils/softDelete';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { withThreeLevelFallback } from '../../utils/rpcFallback';
import { graphVersionService } from './graphVersionService';
import { notDeleted } from '../common/softDeleteHelper';

interface AddToGraphData {
  graph_id: string;
  knowledge_point_id: string;
  x_position?: number;
  y_position?: number;
  level?: NodeLevel;
  is_accepted?: boolean;
}

interface PositionUpdate {
  id: string;
  x_position: number;
  y_position: number;
}

export class GraphNodeService {
  async addToGraph(supabase: SupabaseClient, data: AddToGraphData): Promise<GraphNodeWithKnowledgePoint> {
    const { data: existingNode } = await notDeleted(supabase
      .from("graph_nodes")
      .select(GRAPH_NODES_SELECT)
      .eq("graph_id", data.graph_id)
      .eq("knowledge_point_id", data.knowledge_point_id)
      )
      .maybeSingle();

    if (existingNode) {
      logger.warn("Duplicate graph node insertion prevented", {
        graphId: data.graph_id,
        knowledgePointId: data.knowledge_point_id,
        existingNodeId: existingNode.id,
      });
      return buildNodeFromGraphNode(existingNode) as GraphNodeWithKnowledgePoint;
    }

    const graphNodeData = {
      graph_id: data.graph_id,
      knowledge_point_id: data.knowledge_point_id,
      x_position: data.x_position ?? Math.round((Math.random() - 0.5) * 20),
      y_position: data.y_position ?? Math.round((Math.random() - 0.5) * 20),
      level: data.level || "normal",
      is_accepted: data.is_accepted ?? true,
    };

    const { data: graphNode, error } = await supabase
      .from("graph_nodes")
      .insert([graphNodeData])
      .select(GRAPH_NODES_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError(ErrorCodes.DUPLICATE_TOPIC);
      }
      throw error;
    }

    await graphVersionService.recordEvent(
      supabase,
      data.graph_id,
      'node_created',
      {
        graphNodeId: graphNode.id,
        knowledgePointId: data.knowledge_point_id,
        title: graphNode.knowledge_points?.[0]?.title,
        xPosition: graphNode.x_position,
        yPosition: graphNode.y_position,
        level: graphNode.level,
      },
      null,
    ).catch(err => logger.error('Record node_created event error:', err));

    return buildNodeFromGraphNode(graphNode) as GraphNodeWithKnowledgePoint;
  }

  async removeFromGraph(supabase: SupabaseClient, graphNodeId: string, graphId: string): Promise<void> {
    let knowledgePointId: string | undefined;

    knowledgePointId = await withThreeLevelFallback<string | undefined>({
      context: 'removeFromGraph',
      rpcFn: async () => {
        const { data, error } = await supabase.rpc('remove_node_with_edges', {
          p_graph_node_id: graphNodeId,
          p_graph_id: graphId,
        });
        if (error) throw error;
        return data?.knowledge_point_id;
      },
      txFn: async (client) => {
        const { rows } = await client.query(
          `SELECT knowledge_point_id FROM graph_nodes WHERE id = $1`,
          [graphNodeId],
        );
        const kpId = rows[0]?.knowledge_point_id as string | undefined;
        if (kpId) {
          await client.query(
            `UPDATE edges SET deleted_at = $1 WHERE graph_id = $2 AND (source_knowledge_point_id = $3 OR target_knowledge_point_id = $3)`,
            [new Date().toISOString(), graphId, kpId],
          );
        }
        const { rowCount } = await client.query(
          `UPDATE graph_nodes SET deleted_at = $1 WHERE id = $2`,
          [new Date().toISOString(), graphNodeId],
        );
        if (!rowCount) {
          throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
        }
        return kpId;
      },
      fallbackFn: async () => {
        const { data: gn } = await supabase
          .from('graph_nodes')
          .select('knowledge_point_id')
          .eq('id', graphNodeId)
          .single();
        if (gn) {
          const { error: edgesError } = await supabase
            .from('edges')
            .update({ deleted_at: new Date().toISOString() })
            .or(`source_knowledge_point_id.eq.${gn.knowledge_point_id},target_knowledge_point_id.eq.${gn.knowledge_point_id}`)
            .eq('graph_id', graphId);
          if (edgesError) {
            logger.error('Remove edges error:', edgesError);
          }
        }
        const result = await softDelete(supabase, 'graph_nodes', graphNodeId);
        if (!result.success) {
          throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
        }
        return gn?.knowledge_point_id;
      },
    });

    await graphVersionService.recordEvent(
      supabase,
      graphId,
      'node_deleted',
      {
        graphNodeId,
        knowledgePointId,
      },
      null,
    ).catch(err => logger.error('Record node_deleted event error:', err));
  }

  async updatePosition(
    supabase: SupabaseClient,
    graphNodeId: string,
    x: number,
    y: number
  ): Promise<GraphNode> {
    const { data: existingNode } = await supabase
      .from('graph_nodes')
      .select('graph_id')
      .eq('id', graphNodeId)
      .single();

    const { data, error } = await supabase
      .from('graph_nodes')
      .update({
        x_position: x,
        y_position: y,
        updated_at: new Date().toISOString(),
      })
      .eq('id', graphNodeId)
      .select()
      .single();

    if (error) throw error;

    await graphVersionService.recordEvent(
      supabase,
      existingNode?.graph_id ?? data.graph_id,
      'node_updated',
      {
        graphNodeId,
        changes: { x_position: x, y_position: y },
      },
      null,
    ).catch(err => logger.error('Record node_updated event error:', err));

    return data;
  }

  async batchUpdatePositions(supabase: SupabaseClient, positions: PositionUpdate[]): Promise<number> {
    if (!positions.length) return 0;

    const { data: graphNodes, error: findError } = await notDeleted(supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id, graph_id')
      .in('knowledge_point_id', positions.map(p => p.id))
      );

    if (findError) {
      logger.error('Find nodes for batch position update error:', findError);
    }

    if (!graphNodes || graphNodes.length === 0) {
      return 0;
    }

    const kpIdToGnId = new Map(
      graphNodes.map(gn => [gn.knowledge_point_id, gn.id])
    );

    const validPositions = positions.filter(pos => kpIdToGnId.has(pos.id));

    // 优先使用 RPC 批量更新
    try {
      const rpcResult = await supabase.rpc('batch_update_positions', {
        p_ids: validPositions.map(pos => kpIdToGnId.get(pos.id)),
        p_x_positions: validPositions.map(pos => pos.x_position),
        p_y_positions: validPositions.map(pos => pos.y_position),
      });

      if (!rpcResult.error) {
        const batchId = crypto.randomUUID();
        for (const pos of validPositions) {
          const gnId = kpIdToGnId.get(pos.id);
          if (gnId) {
            await graphVersionService.recordEvent(
              supabase,
              graphNodes[0]?.graph_id,
              'node_updated',
              {
                graphNodeId: gnId,
                knowledgePointId: pos.id,
                changes: { x_position: pos.x_position, y_position: pos.y_position },
              },
              null,
              batchId,
            ).catch(err => logger.error('Record node_updated event error:', err));
          }
        }

        return validPositions.length;
      }

      logger.warn('batch_update_positions RPC failed, falling back:', rpcResult.error.message);
    } catch (rpcError) {
      logger.warn('batch_update_positions RPC error, falling back:', rpcError);
    }

    // 降级路径：逐条更新
    const updatePromises = validPositions.map(pos =>
      supabase
        .from('graph_nodes')
        .update({
          x_position: pos.x_position,
          y_position: pos.y_position,
          updated_at: new Date().toISOString(),
        })
        .eq('id', kpIdToGnId.get(pos.id))
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      logger.error('Batch position update errors:', errors);
    }

    const batchId = crypto.randomUUID();
    for (const pos of validPositions) {
      const gnId = kpIdToGnId.get(pos.id);
      if (gnId) {
        await graphVersionService.recordEvent(
          supabase,
          graphNodes[0]?.graph_id,
          'node_updated',
          {
            graphNodeId: gnId,
            knowledgePointId: pos.id,
            changes: { x_position: pos.x_position, y_position: pos.y_position },
          },
          null,
          batchId,
        ).catch(err => logger.error('Record node_updated event error:', err));
      }
    }

    return validPositions.length;
  }

  async updateLevel(supabase: SupabaseClient, graphNodeId: string, level: NodeLevel): Promise<GraphNode> {
    const { data: existingNode } = await supabase
      .from('graph_nodes')
      .select('graph_id')
      .eq('id', graphNodeId)
      .single();

    const { data, error } = await supabase
      .from('graph_nodes')
      .update({
        level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', graphNodeId)
      .select()
      .single();

    if (error) throw error;

    await graphVersionService.recordEvent(
      supabase,
      existingNode?.graph_id ?? data.graph_id,
      'node_updated',
      {
        graphNodeId,
        changes: { level },
      },
      null,
    ).catch(err => logger.error('Record node_updated event error:', err));

    return data;
  }

  async getGraphNodes(supabase: SupabaseClient, graphId: string): Promise<GraphNodeWithKnowledgePoint[]> {
    const { data: graphNodes, error } = await notDeleted(supabase
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .eq('graph_id', graphId)
      );

    if (error) {
      logger.error('getGraphNodes error:', error);
      throw error;
    }

    return (graphNodes || []).map(gn => buildNodeFromGraphNode(gn) as GraphNodeWithKnowledgePoint);
  }

  async getGraphNodesByKnowledgePoints(
    supabase: SupabaseClient,
    knowledgePointIds: string[]
  ): Promise<GraphNodeWithKnowledgePoint[]> {
    if (!knowledgePointIds.length) return [];

    const { data: graphNodes, error } = await notDeleted(supabase
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .in('knowledge_point_id', knowledgePointIds)
      );

    if (error) {
      logger.error('getGraphNodesByKnowledgePoints error:', error);
      throw error;
    }

    return (graphNodes || []).map(gn => buildNodeFromGraphNode(gn) as GraphNodeWithKnowledgePoint);
  }

  async batchDelete(supabase: SupabaseClient, graphNodeIds: string[], graphId: string): Promise<number> {
    if (!graphNodeIds.length) return 0;

    const graphNodes = await withThreeLevelFallback<{ id: string; knowledge_point_id: string }[] | null>({
      context: 'batchDelete',
      rpcFn: async () => {
        const { data, error } = await supabase.rpc('batch_remove_nodes_with_edges', {
          p_graph_node_ids: graphNodeIds,
          p_graph_id: graphId,
        });
        if (error) throw error;
        return data;
      },
      txFn: async (client) => {
        const { rows: nodes } = await client.query(
          `SELECT id, knowledge_point_id FROM graph_nodes WHERE id = ANY($1)`,
          [graphNodeIds],
        );
        const knowledgePointIds = nodes
          .map((n: { knowledge_point_id: string | null }) => n.knowledge_point_id)
          .filter((id): id is string => !!id);
        if (knowledgePointIds.length > 0) {
          await client.query(
            `UPDATE edges SET deleted_at = $1 WHERE graph_id = $2 AND (source_knowledge_point_id = ANY($3) OR target_knowledge_point_id = ANY($3))`,
            [new Date().toISOString(), graphId, knowledgePointIds],
          );
        }
        await client.query(
          `UPDATE graph_nodes SET deleted_at = $1 WHERE id = ANY($2)`,
          [new Date().toISOString(), graphNodeIds],
        );
        return nodes as { id: string; knowledge_point_id: string }[];
      },
      fallbackFn: async () => {
        const { data: nodes } = await supabase
          .from('graph_nodes')
          .select('id, knowledge_point_id')
          .in('id', graphNodeIds);
        const knowledgePointIds = nodes?.map(gn => gn.knowledge_point_id).filter(Boolean) || [];
        if (knowledgePointIds.length > 0) {
          const { error: edgesError } = await supabase
            .from('edges')
            .update({ deleted_at: new Date().toISOString() })
            .or(`source_knowledge_point_id.in.(${knowledgePointIds.join(',')}),target_knowledge_point_id.in.(${knowledgePointIds.join(',')})`)
            .eq('graph_id', graphId);
          if (edgesError) {
            logger.error('Batch delete edges error:', edgesError);
          }
        }
        const result = await softDeleteBatch(supabase, 'graph_nodes', graphNodeIds);
        if (!result.success) {
          throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
        }
        return nodes as { id: string; knowledge_point_id: string }[] | null;
      },
    });

    const batchId = crypto.randomUUID();
    for (const gnId of graphNodeIds) {
      const kpId = graphNodes?.find(gn => gn.id === gnId)?.knowledge_point_id;
      await graphVersionService.recordEvent(
        supabase,
        graphId,
        'node_deleted',
        {
          graphNodeId: gnId,
          knowledgePointId: kpId,
        },
        null,
        batchId,
      ).catch(err => logger.error('Record node_deleted event error:', err));
    }

    return graphNodeIds.length;
  }

  async softDeleteGraphNode(
    supabase: SupabaseClient,
    graphNodeId: string,
    userId: string,
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("soft_delete_graph_node", {
      p_graph_node_id: graphNodeId,
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return !!data;
  }
}

export const graphNodeService = new GraphNodeService();
