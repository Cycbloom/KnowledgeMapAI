import { logger } from './logger.js';
export async function withRpcFallback(supabase, options) {
    const { rpcName, rpcParams, fallbackFn } = options;
    const { data, error } = await supabase.rpc(rpcName, rpcParams);
    if (error) {
        logger.error(`RPC error for ${rpcName}, falling back to manual query:`, error);
        return fallbackFn(supabase);
    }
    return data;
}
//# sourceMappingURL=rpcFallback.js.map