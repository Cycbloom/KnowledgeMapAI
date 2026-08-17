import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

export interface DataFreshnessSnapshot {
  /** 作用域内最近一次数据更新的时间戳（ms）；无数据时为 null */
  lastUpdatedAt: number | null;
  /** 作用域内是否有非 silent 的查询正在获取数据 */
  isFetching: boolean;
}

export interface DataFreshnessResult extends DataFreshnessSnapshot {
  /** 手动触发 refetch，使全局 LoadingBar 同步反馈进度 */
  refresh: () => void;
}

const EMPTY_SNAPSHOT: DataFreshnessSnapshot = {
  lastUpdatedAt: null,
  isFetching: false,
};

/**
 * 聚合一组查询（默认当前页面所有活跃查询）的数据新鲜度状态。
 *
 * - `lastUpdatedAt`：作用域内 `dataUpdatedAt` 的最大值，用于展示「数据更新于 X」
 * - `isFetching`：作用域内是否有非 silent 查询正在获取，驱动刷新按钮的加载态
 * - `refresh()`：手动触发 `refetchQueries({ type: 'active' })`（非 silent），
 *   使全局 `LoadingBar` 同步反馈进度
 *
 * 复用 `LoadingBar` 的 silent 过滤语义：`meta.silent`（如笔记自动保存）的查询
 * 不计入 `isFetching`，避免静默后台操作造成视觉抖动。
 *
 * @param scope 可选查询键前缀；省略时聚合当前所有活跃（被观察）查询
 */
export function useDataFreshness(scope?: QueryKey) {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return cache.subscribe(onStoreChange);
    },
    [cache],
  );

  const computeSnapshot = useCallback((): DataFreshnessSnapshot => {
    const queries = cache.findAll(
      scope ? { queryKey: scope, type: 'active' } : { type: 'active' },
    );
    if (queries.length === 0) return EMPTY_SNAPSHOT;

    let lastUpdatedAt: number | null = null;
    let isFetching = false;
    for (const query of queries) {
      // 遵循 LoadingBar 的 silent 过滤语义，静默查询不参与加载态与新鲜度
      if (query.meta?.silent) continue;
      const ts = query.state.dataUpdatedAt;
      if (ts > (lastUpdatedAt ?? 0)) lastUpdatedAt = ts;
      if (query.state.fetchStatus === 'fetching') isFetching = true;
    }
    return { lastUpdatedAt, isFetching };
  }, [cache, scope]);

  // getSnapshot 需在未变化时返回稳定引用，否则 useSyncExternalStore 会无限循环。
  // 仅当值确实变化时替换快照引用，否则复用上一份快照。
  const snapshotRef = useRef<DataFreshnessSnapshot>(EMPTY_SNAPSHOT);
  const lastSnapshotKey = useRef<string>("0;false");
  const getSnapshot = useCallback((): DataFreshnessSnapshot => {
    const next = computeSnapshot();
    const key = `${String(next.lastUpdatedAt)};${String(next.isFetching)}`;
    if (key !== lastSnapshotKey.current) {
      lastSnapshotKey.current = key;
      snapshotRef.current = next;
    }
    return snapshotRef.current;
  }, [computeSnapshot]);

  const refresh = useCallback(() => {
    void queryClient.refetchQueries({ type: 'active' });
  }, [queryClient]);

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  return {
    lastUpdatedAt: snapshot.lastUpdatedAt,
    isFetching: snapshot.isFetching,
    refresh,
  };
}