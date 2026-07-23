import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { message } from "../../utils/messageHelper";

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
 * @param meta 可选 meta,透传到 useMutation(如 `{ silent: true }` 标记静默 mutation,
 *            供 LoadingBar 等通过 useIsMutating predicate 过滤)
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
  meta?: Record<string, unknown>,
) {
  return () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn,
      meta,
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
        // 使用 getQueriesData/setQueriesData 支持前缀匹配:
        // 当 queryKey 为前缀(如 ["scheduler", "tasks"])时,
        // 乐观更新会同步应用到所有匹配变体(如不同 filters 的列表缓存),
        // 并为每个变体保留 previousData 用于失败回滚。
        const previousEntries = queryClient.getQueriesData<TCache>({ queryKey });

        queryClient.setQueriesData<TCache>({ queryKey }, (old) =>
          config.optimisticUpdater(old, variables),
        );

        return { previousEntries };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousEntries) {
          for (const [key, previousData] of context.previousEntries) {
            queryClient.setQueryData(key, previousData);
          }
        }
      },
      onSuccess: (data, variables) => {
        const successUpdater = config.onSuccessUpdater;
        if (successUpdater) {
          const queryKey = typeof config.queryKey === "function"
            ? config.queryKey(variables)
            : (config.queryKey as QueryKey);
          queryClient.setQueriesData<TCache>({ queryKey }, (old) =>
            successUpdater(old, data, variables),
          );
        }
      },
      onSettled: (data, error, variables) => {
        config.onSettled?.(data, error, variables);
      },
    });
  };
}

/**
 * Toast mutation 配置
 */
export interface ToastMutationOptions<TData, TVariables> {
  /** 执行 mutation 的函数 */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** 成功时显示的 toast 文案 i18n key（字符串）或基于返回数据动态生成 key 的函数 */
  successMessage?: string | ((data: TData) => string);
  /** 失败时显示的 toast 文案 i18n key（字符串）或基于错误动态生成 key 的函数 */
  errorMessage?: string | ((error: Error) => string);
  /** 成功后需要失效的查询键列表 */
  invalidateQueries?: QueryKey[];
  /** 成功回调（在 toast 与失效缓存之后调用） */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** 失败回调（在 toast 之后调用） */
  onError?: (error: Error, variables: TVariables) => void;
}

/**
 * createToastMutation — 创建自动显示 toast 的 mutation
 *
 * - 成功时：根据 successMessage 显示成功 toast，并失效指定的查询键
 * - 失败时：根据 errorMessage 显示错误 toast
 * - successMessage / errorMessage 支持字符串（i18n key）或函数（基于 data/error 动态返回 key）
 *
 * @example
 * export const useUpdateProfileMutation = createToastMutation({
 *   mutationFn: (data: UpdateProfileData) => api.user.updateProfile(data),
 *   successMessage: "profile.updateSuccess",
 *   errorMessage: "profile.updateError",
 *   invalidateQueries: [["user"]],
 * });
 *
 * @example
 * // 动态 successMessage：基于返回数据选择 key
 * export const useImportGraphMutation = createToastMutation({
 *   mutationFn: (file: File) => api.graphs.import(file),
 *   successMessage: (data) => data.imported > 0 ? "import.success" : "import.empty",
 *   errorMessage: "import.error",
 * });
 */
export function createToastMutation<TData, TVariables>(
  options: ToastMutationOptions<TData, TVariables>,
) {
  return () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    return useMutation<TData, Error, TVariables>({
      mutationFn: options.mutationFn,
      onSuccess: (data, variables) => {
        if (options.successMessage) {
          const key = typeof options.successMessage === "function"
            ? options.successMessage(data)
            : options.successMessage;
          message.success(t(key as never));
        }
        if (options.invalidateQueries) {
          for (const qk of options.invalidateQueries) {
            queryClient.invalidateQueries({ queryKey: qk });
          }
        }
        options.onSuccess?.(data, variables);
      },
      onError: (error, variables) => {
        if (options.errorMessage) {
          const key = typeof options.errorMessage === "function"
            ? options.errorMessage(error)
            : options.errorMessage;
          message.error(t(key as never));
        }
        options.onError?.(error, variables);
      },
    });
  };
}