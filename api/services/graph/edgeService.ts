import { SupabaseClient } from '@supabase/supabase-js';
import type { Edge, EdgeLineStyle } from '@/types';
import { softDelete, softDeleteBatch } from '../../utils/softDelete';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

interface CreateEdgeData {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  custom_label?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean | null;
}

interface UpdateEdgeData {
  custom_label?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean | null;
  relationship_type?: string;
  weight?: number;
}

export class EdgeService {
  async create(supabase: SupabaseClient, data: CreateEdgeData): Promise<Edge> {
    const { 
      graph_id, 
      source_knowledge_point_id, 
      target_knowledge_point_id, 
      relationship_type, 
      weight,
      custom_label,
      custom_color,
      custom_line_style,
      show_arrow
    } = data;

    const { data: sourceGn, error: sourceError } = await supabase
      .from('graph_nodes')
      .select('id')
      .eq('knowledge_point_id', source_knowledge_point_id)
      .eq('graph_id', graph_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (sourceError) {
      logger.error('Find source node error:', sourceError);
      throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    if (!sourceGn) {
      throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    const { data: targetGn, error: targetError } = await supabase
      .from('graph_nodes')
      .select('id')
      .eq('knowledge_point_id', target_knowledge_point_id)
      .eq('graph_id', graph_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (targetError) {
      logger.error('Find target node error:', targetError);
      throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    if (!targetGn) {
      throw new AppError(ErrorCodes.RESOURCE_NODE_NOT_FOUND);
    }

    const { data: existingEdge } = await supabase
      .from('edges')
      .select('id, deleted_at')
      .eq('source_knowledge_point_id', source_knowledge_point_id)
      .eq('target_knowledge_point_id', target_knowledge_point_id)
      .eq('graph_id', graph_id)
      .maybeSingle();

    if (existingEdge) {
      if (existingEdge.deleted_at) {
        const { data: restoredEdge, error: restoreError } = await supabase
          .from('edges')
          .update({ deleted_at: null })
          .eq('id', existingEdge.id)
          .select()
          .single();

        if (restoreError) {
          logger.error('Restore edge error:', restoreError);
          throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
        }

        return this.mapEdge(restoredEdge);
      }

      const { data: existingEdgeData } = await supabase
        .from('edges')
        .select('*')
        .eq('id', existingEdge.id)
        .single();

      return this.mapEdge(existingEdgeData);
    }

    const { data: newEdge, error: createError } = await supabase
      .from('edges')
      .insert([{
        graph_id: graph_id,
        source_knowledge_point_id: source_knowledge_point_id,
        target_knowledge_point_id: target_knowledge_point_id,
        relationship_type: relationship_type || 'related',
        weight: weight || 1,
        custom_label: custom_label,
        custom_color: custom_color,
        custom_line_style: custom_line_style,
        show_arrow: show_arrow
      }])
      .select()
      .single();

    if (createError) {
      logger.error('Create edge error:', createError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return this.mapEdge(newEdge);
  }

  async delete(supabase: SupabaseClient, edgeId: string): Promise<void> {
    const result = await softDelete(supabase, 'edges', edgeId);
    if (!result.success) {
      logger.error('Delete edge error:', result.error);
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }
  }

  async update(supabase: SupabaseClient, edgeId: string, data: UpdateEdgeData): Promise<Edge> {
    const { data: updatedEdge, error } = await supabase
      .from('edges')
      .update(data)
      .eq('id', edgeId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      logger.error('Update edge error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    if (!updatedEdge) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return this.mapEdge(updatedEdge);
  }

  async getGraphEdges(supabase: SupabaseClient, graphId: string): Promise<Edge[]> {
    const { data: edges, error } = await supabase
      .from('edges')
      .select(`
        id,
        graph_id,
        source_knowledge_point_id,
        target_knowledge_point_id,
        relationship_type,
        weight,
        custom_label,
        custom_color,
        custom_line_style,
        show_arrow,
        deleted_at,
        created_at
      `)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) {
      logger.error('Get graph edges error:', error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return (edges || []).map(edge => this.mapEdge(edge));
  }

  async deleteByKnowledgePoint(
    supabase: SupabaseClient,
    graphId: string,
    knowledgePointId: string
  ): Promise<number> {
    const { data: edges, error: findError } = await supabase
      .from('edges')
      .select('id')
      .eq('graph_id', graphId)
      .or(`source_knowledge_point_id.eq.${knowledgePointId},target_knowledge_point_id.eq.${knowledgePointId}`)
      .is('deleted_at', null);

    if (findError) {
      logger.error('Find edges error:', findError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    if (!edges || edges.length === 0) {
      return 0;
    }

    const edgeIds = edges.map(e => e.id);
    const result = await softDeleteBatch(supabase, 'edges', edgeIds);
    if (!result.success) {
      logger.error('Delete edges error:', result.error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return edgeIds.length;
  }

  private mapEdge(dbEdge: any): Edge {
    return {
      id: dbEdge.id,
      graph_id: dbEdge.graph_id,
      source_knowledge_point_id: dbEdge.source_knowledge_point_id,
      target_knowledge_point_id: dbEdge.target_knowledge_point_id,
      relationship_type: dbEdge.relationship_type,
      weight: dbEdge.weight,
      custom_label: dbEdge.custom_label,
      custom_color: dbEdge.custom_color,
      custom_line_style: dbEdge.custom_line_style,
      show_arrow: dbEdge.show_arrow,
      deleted_at: dbEdge.deleted_at,
      created_at: dbEdge.created_at
    };
  }
}

export const edgeService = new EdgeService();
