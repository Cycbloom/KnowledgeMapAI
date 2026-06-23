import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";

/**
 * 查询键，可以是静态值或基于 mutation 变量的函数
 */
type QueryKeyOrGetter<TVariables> = QueryKey | ((variables: TVariables) => QueryKey);

/**
 * createSimpleMutation — 创建没有回调的纯 mutation
 *
 * @example
 * export const useCreateTaskMutation = createSimpleMutation(api.tasks.create);
 */
export function createSimpleMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  return () => useMutation({ mutationFn });
}

/**
 * createInvalidationMutation — 创建成功后自动失效缓存的 mutation
 *
 * queryKeys 支持静态 QueryKey 或 `(variables) => QueryKey` 函数形式
 *
 * @example
 * export const useDeleteCardMutation = createInvalidationMutation(
 *   (id: string) => api.study.delete(id),
 *   [["studyCards"]],
 * );
 *
 * @example
 * export const useUpdateTemplateMutation = createInvalidationMutation(
 *   ({ id, data }: { id: string; data: Record<string, unknown> }) => api.templates.update(id, data),
 *   [["templates"], (vars) => queryKeys.template(vars.id)],
 * );
 */
export function createInvalidationMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  queryKeys: QueryKeyOrGetter<TVariables>[],
) {
  return () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn,
      onSuccess: (_data, variables) => {
        for (const qk of queryKeys) {
          const key = typeof qk === "function" ? qk(variables) : qk;
          queryClient.invalidateQueries({ queryKey: key });
        }
      },
    });
  };
}

/**
 * 事件发布配置
 */
export interface EventPublishConfig<TData, TVariables> {
  event: string;
  getPayload: (data: TData, variables: TVariables) => Record<string, unknown>;
}

/**
 * createEventPublishMutation — 创建成功后自动发布事件的 mutation
 *
 * @example
 * export const useDeleteGraphMutation = createEventPublishMutation(
 *   api.graphs.delete,
 *   {
 *     event: "graph_list_changed",
 *     getPayload: () => ({ changeType: "graph_deleted" }),
 *   },
 * );
 */
export function createEventPublishMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  config: EventPublishConfig<TData, TVariables>,
) {
  return () => {
    return useMutation({
      mutationFn,
      onSuccess: (data, variables) => {
        frontendEventBus.publish(config.event, config.getPayload(data, variables));
      },
    });
  };
}

/**
 * 乐观更新 mutation 配置
 */
export interface OptimisticMutationConfig<TData, TVariables, TCache> {
  /** 执行 mutation 的函数 */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** 缓存查询键，静态值或 (variables) => QueryKey */
  queryKey: QueryKeyOrGetter<TVariables>;
  /** 乐观更新函数：用旧缓存数据和新变量计算新缓存数据 */
  optimisticUpdater: (old: TCache | undefined, variables: TVariables) => TCache | undefined;
  /** 成功后用服务端响应更新缓存的函数。如果不提供，则不更新缓存。 */
  onSuccessUpdater?: (old: TCache | undefined, data: TData, variables: TVariables) => TCache | undefined;
  /** mutation 结束后的回调（无论成功/失败），常用于发布事件或失效缓存 */
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

/**
 * createOptimisticMutation — 创建带乐观更新的 mutation
 *
 * 自动处理 onMutate（乐观修改）、onError（回滚）、onSettled（回调）
 *
 * @example
 * // 列表项修改
 * export const useToggleFavoriteMutation = createOptimisticMutation({
 *   mutationFn: ({ id, is_favorite }: { id: string; is_favorite: boolean }) =>
 *     api.graphs.toggleFavorite(id, is_favorite),
 *   queryKey: queryKeys.graphs,
 *   optimisticUpdater: (old, { id, is_favorite }) =>
 *     old?.map((g) => (g.id === id ? { ...g, is_favorite } : g)),
 *   onSettled: () => {
 *     frontendEventBus.publish("graph_list_changed", { changeType: "graph_updated" });
 *   },
 * });
 *
 * @example
 * // 列表项添加（动态 queryKey）
 * export const useCreateNodeMutation = createOptimisticMutation({
 *   mutationFn: (vars: CreateNodeData) => api.nodes.create(vars),
 *   queryKey: (vars) => queryKeys.graphData(vars.graph_id),
 *   optimisticUpdater: (old, vars) => {
 *     const tempNode = { id: `temp-${Date.now()}`, ... };
 *     return old ? { ...old, nodes: [...old.nodes, tempNode] } : { nodes: [tempNode], edges: [] };
 *   },
 *   onSettled: (_data, _error, vars) => {
 *     frontendEventBus.publish("graph_data_changed", { graphId: vars.graph_id, changeType: "node_created" });
 *   },
 * });
 */
export function createOptimisticMutation<TData, TVariables, TCache>(
  config: OptimisticMutationConfig<TData, TVariables, TCache>,
) {
  return () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: config.mutationFn,
      onMutate: async (variables: TVariables) => {
        const queryKey = typeof config.queryKey === "function"
          ? config.queryKey(variables)
          : (config.queryKey as QueryKey);

        await queryClient.cancelQueries({ queryKey });
        const previousData = queryClient.getQueryData<TCache>(queryKey);

        queryClient.setQueryData<TCache>(queryKey, (old) =>
          config.optimisticUpdater(old, variables),
        );

        return { previousData, queryKey };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousData !== undefined && context?.queryKey) {
          queryClient.setQueryData(context.queryKey, context.previousData);
        }
      },
      onSuccess: (data, variables) => {
        if (config.onSuccessUpdater) {
          const queryKey = typeof config.queryKey === "function"
            ? config.queryKey(variables)
            : (config.queryKey as QueryKey);
          queryClient.setQueryData<TCache>(queryKey, (old) =>
            config.onSuccessUpdater!(old, data, variables),
          );
        }
      },
      onSettled: (data, error, variables) => {
        config.onSettled?.(data, error, variables);
      },
    });
  };
}