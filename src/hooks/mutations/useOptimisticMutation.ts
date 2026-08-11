import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { getErrorMessage } from "@/utils/errors";
import { message } from "@/utils/messageHelper";

/**
 * 查询键，可以是静态值或基于 mutation 变量的函数
 */
type QueryKeyOrGetter<TVariables> = QueryKey | ((variables: TVariables) => QueryKey);

/**
 * useOptimisticMutation 配置选项
 */
export interface OptimisticMutationOptions<TData, TVariables, TContext> {
  /** 执行 mutation 的函数 */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** 缓存查询键，静态值或 (variables) => QueryKey */
  queryKey: QueryKeyOrGetter<TVariables>;
  /** 乐观更新函数：用旧缓存数据和新变量计算新缓存数据 */
  queryKeyFilter?: (oldData: unknown, variables: TVariables) => unknown;
  /** mutation 开始前的回调，返回上下文供后续使用（支持 async） */
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  /** mutation 失败后的回调 */
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  /** mutation 成功后的回调 */
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  /** mutation 结束后的回调（无论成功/失败），在失效查询之后调用 */
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  /** 结束后需要失效的查询键列表 */
  invalidateQueries?: QueryKey[];
  /** 成功后显示 Toast 消息 */
  successMessage?: string;
  /** 失败后显示 Toast 消息 */
  errorMessage?: string;
  /** 透传到 useMutation 的 meta（如 `{ silent: true }` 标记静默 mutation） */
  meta?: Record<string, unknown>;
}

/**
 * useOptimisticMutation — 封装标准乐观更新模式的 useMutation hook
 *
 * 标准模式：
 * - onMutate：保存旧数据，即时更新缓存
 * - onError：回滚到旧数据，显示错误 Toast
 * - onSettled：失效查询
 *
 * @example
 * // 简单列表项更新
 * const mutation = useOptimisticMutation({
 *   mutationFn: ({ id, data }: { id: string; data: UpdateData }) => api.update(id, data),
 *   queryKey: ["items"],
 *   queryKeyFilter: (old, { id, data }) =>
 *     Array.isArray(old) ? old.map((item) => item.id === id ? { ...item, ...data } : item) : old,
 *   successMessage: "更新成功",
 *   errorMessage: "更新失败",
 *   invalidateQueries: [["items"]],
 * });
 *
 * @example
 * // 使用自定义 onMutate 处理复杂缓存更新
 * const mutation = useOptimisticMutation({
 *   mutationFn: (data: CreateInput) => api.create(data),
 *   queryKey: ["items"],
 *   onMutate: async (data) => {
 *     // 自定义乐观更新逻辑
 *     return { previousData };
 *   },
 *   onError: (error, _vars, context) => {
 *     // 自定义回滚逻辑
 *   },
 * });
 */
export function useOptimisticMutation<TData, TVariables, TContext = undefined>(
  options: OptimisticMutationOptions<TData, TVariables, TContext>,
) {
  const queryClient = useQueryClient();
  const { queryKey: queryKeyOrGetter, queryKeyFilter, invalidateQueries, successMessage, errorMessage, meta } = options;

  const resolveQueryKey = (variables: TVariables): QueryKey =>
    typeof queryKeyOrGetter === "function" ? queryKeyOrGetter(variables) : (queryKeyOrGetter as QueryKey);

  return useMutation<TData, Error, TVariables, { previousData: unknown; customContext: TContext }>({
    mutationFn: options.mutationFn,
    meta,

    onMutate: async (variables: TVariables) => {
      const qk = resolveQueryKey(variables);
      await queryClient.cancelQueries({ queryKey: qk });

      let previousData: unknown;
      if (queryKeyFilter) {
        previousData = queryClient.getQueryData(qk);
        queryClient.setQueryData(qk, (old: unknown) => queryKeyFilter(old, variables));
      }

      const customContext = await options.onMutate?.(variables) as TContext;

      return { previousData, customContext };
    },

    onError: (error, variables, context) => {
      if (context?.previousData !== undefined && queryKeyFilter) {
        const qk = resolveQueryKey(variables);
        queryClient.setQueryData(qk, context.previousData);
      }

      if (errorMessage) {
        message.error(errorMessage);
      } else {
        message.error(getErrorMessage(error));
      }

      options.onError?.(error, variables, context?.customContext);
    },

    onSuccess: (data, variables, context) => {
      if (successMessage) {
        message.success(successMessage);
      }

      options.onSuccess?.(data, variables, context?.customContext);
    },

    onSettled: (data, error, variables) => {
      if (invalidateQueries) {
        for (const qk of invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: qk });
        }
      }

      options.onSettled?.(data, error, variables);
    },
  });
}