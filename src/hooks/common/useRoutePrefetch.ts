import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * 路由预取 hook，在路由组件挂载时自动预取关键数据。
 *
 * 用于懒加载路由中，在组件首次渲染时提前加载后续可能需要的查询数据。
 *
 * @example
 * ```tsx
 * const MyPage = () => {
 *   useRoutePrefetch([
 *     { queryKey: queryKeys.graphs, queryFn: api.graphs.list },
 *   ]);
 *   return <div>...</div>;
 * };
 * ```
 */
export function useRoutePrefetch(
  queries: ReadonlyArray<{
    queryKey: QueryKey;
    queryFn: () => Promise<unknown>;
    staleTime?: number;
    gcTime?: number;
  }>,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    for (const query of queries) {
      queryClient.prefetchQuery({
        queryKey: query.queryKey,
        queryFn: query.queryFn,
        staleTime: query.staleTime,
        gcTime: query.gcTime,
      });
    }
    // 仅在挂载时执行一次，queries 视为稳定配置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}