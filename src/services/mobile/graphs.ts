import { getMobileSupabaseClient } from './client';
import type { Graph } from '@shared/types/graph';
import { mobileNodesApi } from './nodes';
import { mobileEdgesApi } from './edges';

export const mobileGraphsApi = {
  list: async (): Promise<Graph[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('knowledge_graphs') as any)
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data as Graph[];
  },

  listTrash: async (): Promise<Graph[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('knowledge_graphs') as any)
      .select('*')
      .not('deleted_at', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data as Graph[];
  },

  get: async (id: string): Promise<Graph> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('knowledge_graphs') as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Graph;
  },

  getNodes: async (id: string) => {
    const nodes = await mobileNodesApi.getByGraphId(id);
    const edges = await mobileEdgesApi.getByGraphId(id);
    return { nodes, edges };
  },

  getNodeStatus: async (_id: string) => {
    return { total_nodes: 0, completed_nodes: 0 };
  },

  create: async (data: { title: string; description?: string; domain?: string }): Promise<Graph> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await (client.from('graphs') as any)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Graph;
  },

  createFromTemplate: async (data: { template_id: string; title?: string; description?: string }) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await (client.from('graphs') as any)
      .insert({ title: data.title || 'From Template', description: data.description })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Graph;
  },

  update: async (id: string, data: { title?: string; description?: string; domain?: string; settings?: Record<string, unknown> }): Promise<Graph> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await (client.from('graphs') as any)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Graph;
  },

  delete: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await (client.from('graphs') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  },

  restore: async (id: string): Promise<Graph> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('knowledge_graphs') as any)
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Graph;
  },

  permanentDelete: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await (client.from('graphs') as any)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  },

  batchRestore: async (ids: string[]) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await (client.from('graphs') as any)
      .update({ deleted_at: null })
      .in('id', ids);

    if (error) {
      throw new Error(error.message);
    }

    return { count: ids.length };
  },

  batchDelete: async (ids: string[]) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await (client.from('graphs') as any)
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      throw new Error(error.message);
    }

    return { count: ids.length };
  },

  batchPermanentDelete: async (ids: string[]) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await (client.from('graphs') as any)
      .delete()
      .in('id', ids);

    if (error) {
      throw new Error(error.message);
    }

    return { count: ids.length };
  },

  getLearningPath: async (_id: string) => {
    return { milestones: [], progress: 0 };
  },

  toggleFavorite: async (id: string, is_favorite: boolean): Promise<Graph> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await (client.from('knowledge_graphs') as any)
      .update({ is_favorite })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Graph;
  },
};
