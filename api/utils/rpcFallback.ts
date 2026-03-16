import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

export interface RPCFallbackOptions<T> {
  rpcName: string;
  rpcParams: Record<string, unknown>;
  fallbackFn: (supabase: SupabaseClient) => Promise<T>;
}

export async function withRpcFallback<T>(
  supabase: SupabaseClient,
  options: RPCFallbackOptions<T>
): Promise<T> {
  const { rpcName, rpcParams, fallbackFn } = options;

  const { data, error } = await supabase.rpc(rpcName, rpcParams);
  
  if (error) {
    logger.warn(`RPC error for ${rpcName}, falling back to manual query:`, error.message || error);
    return fallbackFn(supabase);
  }
  
  return data as T;
}
