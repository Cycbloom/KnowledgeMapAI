import { SupabaseClient } from '@supabase/supabase-js';
import type { GraphNode, GraphNodeWithKnowledgePoint, NodeLevel } from '@/types';
import { buildNodeFromGraphNode, GRAPH_NODES_SELECT } from '../../utils/nodeHelpers';
import { softDelete, softDeleteBatch } from '../../utils/softDelete';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

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
    const graphNodeData = {
      graph_id: data.graph_id,
      knowledge_point_id: data.knowledge_point_id,
      x_position: data.x_position ?? Math.round((Math.random() - 0.5) * 20),
      y_position: data.y_position ?? Math.round((Math.random() - 0.5) * 20),
      level: data.level || 'normal',
      is_accepted: data.is_accepted ?? true,
    };

    const { data: graphNode, error } = await supabase
      .from('graph_nodes')
      .insert([graphNodeData])
      .select(GRAPH_NODES_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError(ErrorCodes.DUPLICATE_TOPIC);
      }
      throw error;
    }

    return buildNodeFromGraphNode(graphNode) as GraphNodeWithKnowledgePoint;
  }

  async removeFromGraph(supabase: SupabaseClient, graphNodeId: string, graphId: string): Promise<void> {
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
  }

  async updatePosition(
    supabase: SupabaseClient,
    graphNodeId: string,
    x: number,
    y: number
  ): Promise<GraphNode> {
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

    return data;
  }

  async batchUpdatePositions(supabase: SupabaseClient, positions: PositionUpdate[]): Promise<number> {
    if (!positions.length) return 0;

    const { data: graphNodes, error: findError } = await supabase
      .from('graph_nodes')
      .select('id, knowledge_point_id')
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

    return positions.length;
  }

  async updateLevel(supabase: SupabaseClient, graphNodeId: string, level: NodeLevel): Promise<GraphNode> {
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

    const { data: graphNodes } = await supabase
      .from('graph_nodes')
      .select('knowledge_point_id')
      .in('id', graphNodeIds);

    const knowledgePointIds = graphNodes?.map(gn => gn.knowledge_point_id).filter(Boolean) || [];

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

    return graphNodeIds.length;
  }
}

export const graphNodeService = new GraphNodeService();
