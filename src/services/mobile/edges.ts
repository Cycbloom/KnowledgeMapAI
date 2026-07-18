import { getMobileSupabaseClient } from '@/lib/supabase';
import type { Edge } from '@shared/types/graph';
import type { CreateEdgeData } from '@shared/types/api';
import type { IEdgesApi } from '../api/contracts/IEdgesApi';
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const mobileEdgesApi: IEdgesApi & {
  getByGraphId: (graphId: string) => Promise<Edge[]>;
  update: (id: string, data: Partial<Edge>) => Promise<Edge>;
} = {
  create: async (data: CreateEdgeData): Promise<Edge> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { data: result, error } = await client
      .from('edges')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as Edge;
  },

  delete: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { error } = await client
      .from('edges')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }
  },

  getByGraphId: async (graphId: string): Promise<Edge[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { data, error } = await client
      .from('edges')
      .select('*')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return (data || []) as Edge[];
  },

  update: async (id: string, data: Partial<Edge>): Promise<Edge> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { data: result, error } = await client
      .from('edges')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return result as Edge;
  },
};
