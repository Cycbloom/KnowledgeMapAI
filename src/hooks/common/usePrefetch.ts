import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * 通用预取 hook，返回一个 `onMouseEnter` 处理函数，触发数据预取。
 *
 * 使用 ref 存储 options 确保回调引用稳定，避免在悬停时因重建引用导致的不必要渲染。
 *
 * @example
 * ```tsx
 * const prefetchGraphs = usePrefetch({
 *   queryKey: queryKeys.graphs,
 *   queryFn: api.graphs.list,
 *   staleTime: DEFAULT_STALE_TIME,
 * });
 *
 * return <Link to="/" onMouseEnter={prefetchGraphs}>...</Link>;
 * ```
 */
export function usePrefetch<TQueryFnData>(options: {
  queryKey: QueryKey;
  queryFn: () => Promise<TQueryFnData>;
  staleTime?: number;
  gcTime?: number;
}): () => void {
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  return useCallback(() => {
    const { queryKey, queryFn, staleTime, gcTime } = optionsRef.current;
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime,
      gcTime,
      meta: { silent: true },
    });
  }, [queryClient]);
}