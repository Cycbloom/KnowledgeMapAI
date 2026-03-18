import { getMobileSupabaseClient } from './client';
import type { Node, Keyword } from '@shared/types/graph';

export const mobileNodesApi = {
  create: async (data: { 
    graph_id: string; 
    title: string; 
    content?: string; 
    level?: string;
    x_position?: number;
    y_position?: number;
    parent_node_ids?: string[];
    learning_material?: string;
    properties?: Record<string, unknown>;
    knowledge_point_id?: string;
    reuse_existing?: boolean;
  }): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await (client.from('graph_nodes') as any)
      .insert(data)
      .select(`
        *,
        knowledge_points (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Node;
  },

  get: async (id: string): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('graph_nodes') as any)
      .select(`
        *,
        knowledge_points (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Node;
  },

  update: async (id: string, data: { 
    title?: string; 
    content?: string; 
    level?: string;
    x_position?: number;
    y_position?: number;
    learning_material?: string;
    properties?: Record<string, unknown>;
    keywords?: Keyword[];
  }): Promise<Node> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await (client.from('graph_nodes') as any)
      .update(data)
      .eq('id', id)
      .select(`
        *,
        knowledge_points (*)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Node;
  },

  delete: async (id: string, hardDelete?: boolean): Promise<{ 
    message: string;
    affected_graphs?: string[];
    deleted_graph_nodes?: number;
    deleted_edges?: number;
    deleted_cards?: number;
  }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    if (hardDelete) {
      const { error } = await (client.from('graph_nodes') as any)
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      return { message: '节点已永久删除' };
    } else {
      const { error } = await (client.from('graph_nodes') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      return { message: '节点已移至回收站' };
    }
  },

  batchDelete: async (nodeIds: string[], options?: { hard_delete?: boolean }) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    if (options?.hard_delete) {
      const { error } = await (client.from('graph_nodes') as any)
        .delete()
        .in('id', nodeIds);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await (client.from('graph_nodes') as any)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', nodeIds);

      if (error) {
        throw new Error(error.message);
      }
    }

    return { count: nodeIds.length };
  },

  getByGraphId: async (graphId: string): Promise<Node[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('graph_nodes') as any)
      .select(`
        *,
        knowledge_points (*)
      `)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message);
    }

    return data as Node[];
  },

  batchUpdatePositions: async (positions: Array<{ id: string; x_position: number; y_position: number }>): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await (client.from('graph_nodes') as any)
      .upsert(positions);

    if (error) {
      throw new Error(error.message);
    }
  },
};
