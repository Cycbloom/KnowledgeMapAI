import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import type { PoolClient } from 'pg';

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
 * 三级降级选项
 *
 * @template T - 返回数据类型
 */
export interface ThreeLevelFallbackOptions<T> {
  /** 上下文描述，用于日志 */
  context: string;
  /** RPC 函数，优先执行 */
  rpcFn: () => Promise<T>;
  /** 事务函数，RPC 失败时执行（可选） */
  txFn?: (client: PoolClient) => Promise<T>;
  /** 非事务 fallback 函数，RPC 和事务都失败时执行 */
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

/**
 * 三级降级工具函数
 *
 * 按 RPC → 事务 → 非事务 fallback 顺序尝试执行，自动处理降级逻辑和日志记录。
 *
 * ## 降级策略
 *
 * 1. 优先执行 RPC 函数（最高性能，数据库原生逻辑）
 * 2. RPC 失败时，若 txFn 存在且 TransactionExecutor 可用，执行事务 fallback
 * 3. 事务也失败或不可用时，执行非事务 fallback
 *
 * @template T - 返回数据类型
 * @param options - 三级降级选项
 * @returns 最终执行结果
 *
 * @example
 * ```typescript
 * const result = await withThreeLevelFallback({
 *   context: 'deleteGraph',
 *   rpcFn: () => supabase.rpc('soft_delete_graph_with_branches', { p_graph_id: graphId }),
 *   txFn: (client) => client.query('UPDATE ...'),
 *   fallbackFn: () => this.deleteGraphFallback(supabase, graphId, userId),
 * });
 * ```
 */
export async function withThreeLevelFallback<T>(
  options: ThreeLevelFallbackOptions<T>
): Promise<T> {
  const { context, rpcFn, txFn, fallbackFn } = options;

  // Level 1: Try RPC
  try {
    return await rpcFn();
  } catch (rpcError) {
    logger.warn(`RPC failed for ${context}, falling back to sequential operations`, { error: rpcError });
  }

  // Level 2: Try transactional fallback
  if (txFn) {
    const { transactionExecutor } = await import('../database/transactionExecutor');
    if (transactionExecutor.isAvailable()) {
      try {
        return await transactionExecutor.executeInTransaction(txFn);
      } catch (txError) {
        logger.warn(`Transaction failed in ${context} fallback, falling back to non-transactional operations`, { error: txError });
      }
    } else {
      logger.warn(`TransactionExecutor not available, using non-transactional fallback for ${context}`);
    }
  }

  // Level 3: Non-transactional fallback
  return fallbackFn();
}
