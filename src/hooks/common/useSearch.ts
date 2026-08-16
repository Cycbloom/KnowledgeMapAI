import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { searchApi, SearchResult } from '../../services/api/search';
import { debounce } from '@/utils/performanceUtils';

export type SearchMode = 'keyword' | 'semantic';

interface UseSearchOptions {
  debounceMs?: number;
  minLength?: number;
  autoSearch?: boolean;
}

interface UseSearchResult {
  query: string;
  setQuery: (query: string) => void;
  mode: SearchMode;
  setMode: (mode: SearchMode) => void;
  isSearching: boolean;
  results: SearchResult | null;
  error: string | null;
  search: (query: string) => void;
  clear: () => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { debounceMs = 300, minLength = 2, autoSearch = true } = options;

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('keyword');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  // 竞态防护：记录最新一次搜索请求序号，仅当响应为最新请求时才写入结果，
  // 避免 axios 请求无法真正被 AbortController 取消时，旧请求晚到覆盖新结果。
  const searchSeqRef = useRef(0);

  const performSearch = useCallback(async (searchQuery: string, searchMode: SearchMode) => {
    if (!searchQuery.trim() || searchQuery.trim().length < minLength) {
      setResults(null);
      return;
    }

    const seq = searchSeqRef.current + 1;
    searchSeqRef.current = seq;

    setIsSearching(true);
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      
      const result = searchMode === 'semantic' 
        ? await searchApi.semanticSearch(searchQuery.trim())
        : await searchApi.search(searchQuery.trim());

      // 仅当此响应仍是最新请求时才写入，丢弃过期响应
      if (searchSeqRef.current !== seq) return;
      setResults(result);
    } catch (err: unknown) {
      if (searchSeqRef.current !== seq) return;
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Search failed:', err);
        setError(err.message || '搜索失败');
      }
    } finally {
      if (searchSeqRef.current === seq) {
        setIsSearching(false);
      }
    }
  }, [minLength]);

  const debouncedPerformSearch = useMemo(
    () =>
      debounce((searchQuery: string, searchMode: SearchMode) => {
        performSearch(searchQuery, searchMode);
      }, debounceMs),
    [debounceMs, performSearch],
  );

  const search = useCallback(
    (searchQuery: string) => {
      debouncedPerformSearch.cancel();

      // 立即作废在途请求：即使 axios 无法真正取消，序号也会使旧响应失效
      searchSeqRef.current += 1;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!searchQuery.trim() || searchQuery.trim().length < minLength) {
        setResults(null);
        return;
      }

      debouncedPerformSearch(searchQuery, mode);
    },
    [debouncedPerformSearch, minLength, mode],
  );

  const clear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    setIsSearching(false);

    debouncedPerformSearch.cancel();
    // 作废在途请求，避免 clear 后旧响应仍写入结果
    searchSeqRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [debouncedPerformSearch]);

  useEffect(() => {
    if (autoSearch && query.trim().length >= minLength) {
      search(query);
    } else if (query.trim().length < minLength) {
      setResults(null);
    }
    // search 为 useCallback，故意不进依赖避免与 query 变化形成重复触发；mode 变化由下一个 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, autoSearch, minLength]);

  useEffect(() => {
    if (autoSearch && query.trim().length >= minLength) {
      search(query);
    }
    // 仅在 mode 切换时重新触发搜索；query/autoSearch/minLength 取当前闭包值即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    return () => {
      debouncedPerformSearch.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedPerformSearch]);

  return {
    query,
    setQuery,
    mode,
    setMode,
    isSearching,
    results,
    error,
    search,
    clear,
  };
}
