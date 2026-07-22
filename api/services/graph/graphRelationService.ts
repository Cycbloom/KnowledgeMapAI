import { SupabaseClient } from '@supabase/supabase-js';

export type GraphRelationType = 'prerequisite' | 'extension' | 'related' | 'cross_domain';

export interface GraphRelation {
  id: string;
  source_graph_id: string;
  target_graph_id: string;
  relation_type: GraphRelationType;
  context: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  target_graph?: {
    id: string;
    title: string;
    description: string | null;
  } | Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  source_graph?: {
    id: string;
    title: string;
    description: string | null;
  } | Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
}

export interface CreateRelationData {
  source_graph_id: string;
  target_graph_id: string;
  relation_type: GraphRelationType;
  context?: string;
  metadata?: Record<string, unknown>;
}

export class GraphRelationService {
  async createRelation(
    supabase: SupabaseClient,
    data: CreateRelationData
  ): Promise<GraphRelation> {
    const { data: relation, error } = await supabase
      .from('graph_relations')
      .insert({
        source_graph_id: data.source_graph_id,
        target_graph_id: data.target_graph_id,
        relation_type: data.relation_type,
        context: data.context || null,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return relation;
  }

  async getRelations(
    supabase: SupabaseClient,
    graphId: string
  ): Promise<{ outgoing: GraphRelation[]; incoming: GraphRelation[] }> {
    const { data: outgoing, error: outError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at,
        target_graph:knowledge_graphs!graph_relations_target_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('source_graph_id', graphId);

    if (outError) throw outError;

    const { data: incoming, error: inError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at,
        source_graph:knowledge_graphs!graph_relations_source_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('target_graph_id', graphId);

    if (inError) throw inError;

    return {
      outgoing: outgoing || [],
      incoming: incoming || [],
    };
  }

  async deleteRelation(
    supabase: SupabaseClient,
    relationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('graph_relations')
      .delete()
      .eq('id', relationId);

    if (error) throw error;
  }

  async getPrerequisites(
    supabase: SupabaseClient,
    graphId: string
  ): Promise<GraphRelation[]> {
    const { data, error } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at,
        source_graph:knowledge_graphs!graph_relations_source_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('target_graph_id', graphId)
      .eq('relation_type', 'prerequisite');

    if (error) throw error;
    return data || [];
  }

  async getExtensions(
    supabase: SupabaseClient,
    graphId: string
  ): Promise<GraphRelation[]> {
    const { data, error } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at,
        target_graph:knowledge_graphs!graph_relations_target_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('source_graph_id', graphId)
      .eq('relation_type', 'extension');

    if (error) throw error;
    return data || [];
  }

  async getRelated(
    supabase: SupabaseClient,
    graphId: string
  ): Promise<GraphRelation[]> {
    const { data: outgoing, error: outError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at,
        target_graph:knowledge_graphs!graph_relations_target_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('source_graph_id', graphId)
      .eq('relation_type', 'related');

    if (outError) throw outError;

    const { data: incoming, error: inError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        metadata,
        created_at,
        source_graph:knowledge_graphs!graph_relations_source_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('target_graph_id', graphId)
      .eq('relation_type', 'related');

    if (inError) throw inError;

    return [...(outgoing || []), ...(incoming || [])];
  }

  async checkRelationExists(
    supabase: SupabaseClient,
    sourceGraphId: string,
    targetGraphId: string,
    relationType: GraphRelationType
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('graph_relations')
      .select('id')
      .eq('source_graph_id', sourceGraphId)
      .eq('target_graph_id', targetGraphId)
      .eq('relation_type', relationType)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }
}

export const graphRelationService = new GraphRelationService();
