import { SupabaseClient } from '@supabase/supabase-js';
import type { Edge } from '@/types';
import { softDelete, softDeleteBatch } from '../utils/softDelete.js';
import { logger } from '../utils/logger.js';

interface CreateEdgeData {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
}

export class EdgeService {
  async create(supabase: SupabaseClient, data: CreateEdgeData): Promise<Edge> {
    const { graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type, weight } = data;

    const { data: sourceGn, error: sourceError } = await supabase
      .from('graph_nodes')
      .select('id')
      .eq('knowledge_point_id', source_knowledge_point_id)
      .eq('graph_id', graph_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (sourceError) {
      logger.error('Find source node error:', sourceError);
      throw new Error('查找源节点失败');
    }

    if (!sourceGn) {
      throw new Error('源知识点不在当前图谱中');
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
      throw new Error('查找目标节点失败');
    }

    if (!targetGn) {
      throw new Error('目标知识点不在当前图谱中');
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
          throw new Error('恢复边失败');
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
        weight: weight || 1
      }])
      .select()
      .single();

    if (createError) {
      logger.error('Create edge error:', createError);
      throw new Error('创建边失败');
    }

    return this.mapEdge(newEdge);
  }

  async delete(supabase: SupabaseClient, edgeId: string): Promise<void> {
    const result = await softDelete(supabase, 'edges', edgeId);
    if (!result.success) {
      logger.error('Delete edge error:', result.error);
      throw new Error('删除边失败');
    }
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
        deleted_at,
        created_at
      `)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) {
      logger.error('Get graph edges error:', error);
      throw new Error('获取图谱边失败');
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
      throw new Error('查找边失败');
    }

    if (!edges || edges.length === 0) {
      return 0;
    }

    const edgeIds = edges.map(e => e.id);
    const result = await softDeleteBatch(supabase, 'edges', edgeIds);
    if (!result.success) {
      logger.error('Delete edges error:', result.error);
      throw new Error('删除边失败');
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
      deleted_at: dbEdge.deleted_at,
      created_at: dbEdge.created_at
    };
  }
}

export const edgeService = new EdgeService();
