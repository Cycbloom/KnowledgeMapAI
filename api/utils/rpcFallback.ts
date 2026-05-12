import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * RPC 回退选项
 *
 * @template T - 返回数据类型
 */
export interface RPCFallbackOptions<T> {
  /** RPC 函数名称 */
  rpcName: string;
  /** RPC 函数参数 */
  rpcParams: Record<string, unknown>;
  /** 回退函数，当 RPC 调用失败时执行 */
  fallbackFn: () => Promise<T>;
}

/**
 * RPC 调用回退工具函数
 *
 * 尝试调用 Supabase RPC 函数，如果失败则回退到手动查询。
 * 这对于本地开发环境（可能没有定义 RPC 函数）特别有用。
 *
 * ## 使用场景
 *
 * - 本地开发环境没有定义 RPC 函数
 * - RPC 函数执行出错需要降级处理
 * - 需要兼容不同数据库配置的环境
 *
 * @template T - 返回数据类型
 * @param supabase - Supabase 客户端
 * @param options - 回退选项
 * @param options.rpcName - RPC 函数名称
 * @param options.rpcParams - RPC 函数参数
 * @param options.fallbackFn - 回退函数
 * @returns RPC 调用结果或回退函数结果
 *
 * @example
 * ```typescript
 * const graphs = await withRpcFallback<GraphWithCount[]>(supabase, {
 *   rpcName: 'get_user_graphs_with_counts',
 *   rpcParams: { p_user_id: userId },
 *   fallbackFn: () => this.listGraphsFallback(supabase, userId)
 * });
 * ```
 */
export async function withRpcFallback<T>(
  supabase: SupabaseClient,
  options: RPCFallbackOptions<T>
): Promise<T> {
  const { rpcName, rpcParams, fallbackFn } = options;

  const { data, error } = await supabase.rpc(rpcName, rpcParams);
  
  if (error) {
    logger.warn(`RPC error for ${rpcName}, falling back to manual query:`, error.message || error);
    return fallbackFn();
  }
  
  return data as T;
}
