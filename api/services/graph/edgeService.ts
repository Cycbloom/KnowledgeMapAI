import { SupabaseClient } from '@supabase/supabase-js';
import type { Edge, EdgeLineStyle } from '@/types';
import { softDelete, softDeleteBatch } from '../../utils/softDelete';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { graphVersionService } from './graphVersionService';

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

    // 优先使用 RPC 原子操作
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_edge', {
        p_graph_id: graph_id,
        p_source_knowledge_point_id: source_knowledge_point_id,
        p_target_knowledge_point_id: target_knowledge_point_id,
        p_relationship_type: relationship_type || 'contains',
        p_weight: weight || 1,
        p_custom_label: custom_label || null,
        p_custom_color: custom_color || null,
        p_custom_line_style: custom_line_style || null,
        p_show_arrow: show_arrow ?? null,
      });

      if (!rpcError && rpcResult) {
        const status = rpcResult.status as string;

        if (status === 'error') {
          const code = rpcResult.code as string;
          throw new AppError(
            code === 'SOURCE_NOT_FOUND' || code === 'TARGET_NOT_FOUND'
              ? ErrorCodes.RESOURCE_NODE_NOT_FOUND
              : ErrorCodes.DATABASE_QUERY_ERROR
          );
        }

        const edge = rpcResult.edge as Record<string, unknown>;

        // 记录版本事件
        await graphVersionService.recordEvent(
          supabase,
          graph_id,
          'edge_created',
          {
            edgeId: edge.id,
            sourceKnowledgePointId: source_knowledge_point_id,
            targetKnowledgePointId: target_knowledge_point_id,
            relationshipType: relationship_type || 'contains',
          },
          null,
        ).catch(err => logger.error('Record edge_created event error:', err));

        return this.mapEdge(edge);
      }

      logger.warn('create_edge RPC failed, falling back:', rpcError?.message);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn('create_edge RPC error, falling back:', err);
    }

    // 降级路径：原有逐条查询逻辑
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

        await graphVersionService.recordEvent(
          supabase,
          graph_id,
          'edge_created',
          {
            edgeId: restoredEdge.id,
            sourceKnowledgePointId: source_knowledge_point_id,
            targetKnowledgePointId: target_knowledge_point_id,
            relationshipType: relationship_type || 'contains',
          },
          null,
        ).catch(err => logger.error('Record edge_created event error:', err));

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
        relationship_type: relationship_type || 'contains',
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

    await graphVersionService.recordEvent(
      supabase,
      graph_id,
      'edge_created',
      {
        edgeId: newEdge.id,
        sourceKnowledgePointId: source_knowledge_point_id,
        targetKnowledgePointId: target_knowledge_point_id,
        relationshipType: relationship_type || 'contains',
      },
      null,
    ).catch(err => logger.error('Record edge_created event error:', err));

    return this.mapEdge(newEdge);
  }

  async delete(supabase: SupabaseClient, edgeId: string): Promise<void> {
    const { data: edgeData } = await supabase
      .from('edges')
      .select('graph_id, source_knowledge_point_id, target_knowledge_point_id')
      .eq('id', edgeId)
      .single();

    const result = await softDelete(supabase, 'edges', edgeId);
    if (!result.success) {
      logger.error('Delete edge error:', result.error);
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await graphVersionService.recordEvent(
      supabase,
      edgeData?.graph_id,
      'edge_deleted',
      {
        edgeId,
        sourceKnowledgePointId: edgeData?.source_knowledge_point_id,
        targetKnowledgePointId: edgeData?.target_knowledge_point_id,
      },
      null,
    ).catch(err => logger.error('Record edge_deleted event error:', err));
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

    await graphVersionService.recordEvent(
      supabase,
      updatedEdge.graph_id,
      'edge_updated',
      {
        edgeId,
        changes: data,
      },
      null,
    ).catch(err => logger.error('Record edge_updated event error:', err));

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
