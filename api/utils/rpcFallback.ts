import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

const DATABASE_MODE = process.env.DATABASE_MODE || 'supabase';

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

  if (DATABASE_MODE === 'local') {
    logger.debug(`Using fallback for ${rpcName} in local mode`);
    return fallbackFn(supabase);
  }

  const { data, error } = await supabase.rpc(rpcName, rpcParams);
  
  if (error) {
    logger.warn(`RPC error for ${rpcName}, falling back to manual query:`, error.message || error);
    return fallbackFn(supabase);
  }
  
  return data as T;
}
