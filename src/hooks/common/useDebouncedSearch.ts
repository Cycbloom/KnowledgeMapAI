import { useState, useEffect, useCallback } from 'react';

/**
 * 防抖搜索 hook
 * 输入立即更新 query（受控输入用），但 debouncedQuery 延迟 300ms 更新（filter 计算用）
 * @param initialQuery 初始查询字符串，默认 ''
 * @param debounceMs 防抖延迟，默认 300ms
 */
export function useDebouncedSearch(initialQuery = '', debounceMs = 300) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const reset = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return { query, setQuery, debouncedQuery, reset };
}