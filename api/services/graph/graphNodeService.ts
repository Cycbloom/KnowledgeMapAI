import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { GraphNode, GraphNodeWithKnowledgePoint, NodeLevel } from '@/types';
import { buildNodeFromGraphNode, GRAPH_NODES_SELECT } from '../../utils/nodeHelpers';
import { softDelete, softDeleteBatch } from '../../utils/softDelete';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { graphVersionService } from './graphVersionService';

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
    const { data: existingNode } = await supabase
      .from("graph_nodes")
      .select(GRAPH_NODES_SELECT)
      .eq("graph_id", data.graph_id)
      .eq("knowledge_point_id", data.knowledge_point_id)
      .is("deleted_at", null)
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

    try {
      const { data, error } = await supabase.rpc('remove_node_with_edges', {
        p_graph_node_id: graphNodeId,
        p_graph_id: graphId,
      });
      if (error) throw error;
      knowledgePointId = data?.knowledge_point_id;
    } catch (rpcError) {
      logger.warn('RPC remove_node_with_edges failed, falling back to sequential operations', { error: rpcError });

      const { data: gn } = await supabase
        .from('graph_nodes')
        .select('knowledge_point_id')
        .eq('id', graphNodeId)
        .single();

      if (gn) {
        knowledgePointId = gn.knowledge_point_id;
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
    }

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

    const { data: graphNodes, error: findError } = await supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id, graph_id')
      .in('knowledge_point_id', positions.map(p => p.id))
      .is('deleted_at', null);

    if (findError) {
      logger.error('Find nodes for batch position update error:', findError);
    }

    if (!graphNodes || graphNodes.length === 0) {
      return 0;
    }

    const kpIdToGnId = new Map(
      graphNodes.map(gn => [gn.knowledge_point_id, gn.id])
    );

    const updatePromises = positions
      .filter(pos => kpIdToGnId.has(pos.id))
      .map(pos =>
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
    for (const pos of positions) {
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

    return positions.length;
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
    const { data: graphNodes, error } = await supabase
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

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

    const { data: graphNodes, error } = await supabase
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .in('knowledge_point_id', knowledgePointIds)
      .is('deleted_at', null);

    if (error) {
      logger.error('getGraphNodesByKnowledgePoints error:', error);
      throw error;
    }

    return (graphNodes || []).map(gn => buildNodeFromGraphNode(gn) as GraphNodeWithKnowledgePoint);
  }

  async batchDelete(supabase: SupabaseClient, graphNodeIds: string[], graphId: string): Promise<number> {
    if (!graphNodeIds.length) return 0;

    let graphNodes: { id: string; knowledge_point_id: string }[] | null = null;

    try {
      const { data, error } = await supabase.rpc('batch_remove_nodes_with_edges', {
        p_graph_node_ids: graphNodeIds,
        p_graph_id: graphId,
      });
      if (error) throw error;
      graphNodes = data;
    } catch (rpcError) {
      logger.warn('RPC batch_remove_nodes_with_edges failed, falling back to sequential operations', { error: rpcError });

      const { data: nodes } = await supabase
        .from('graph_nodes')
        .select('id, knowledge_point_id')
        .in('id', graphNodeIds);

      graphNodes = nodes;

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
    }

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
