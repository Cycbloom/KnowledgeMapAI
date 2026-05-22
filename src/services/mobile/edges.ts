import { getMobileSupabaseClient } from '@/lib/supabase';
import type { Edge } from '@shared/types/graph';
import type { CreateEdgeData } from '@shared/types/api';

export const mobileEdgesApi = {
  create: async (data: CreateEdgeData): Promise<Edge> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await client
      .from('edges')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Edge;
  },

  delete: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await client
      .from('edges')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  },

  getByGraphId: async (graphId: string): Promise<Edge[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await client
      .from('edges')
      .select('*')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Edge[];
  },

  update: async (id: string, data: Partial<Edge>): Promise<Edge> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: result, error } = await client
      .from('edges')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Edge;
  },
};
