import { useState, useCallback, useRef, useEffect } from 'react';
import { searchApi, SearchResult } from '../services/api/search';

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

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string, searchMode: SearchMode) => {
    if (!searchQuery.trim() || searchQuery.trim().length < minLength) {
      setResults(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      
      const result = searchMode === 'semantic' 
        ? await searchApi.semanticSearch(searchQuery.trim())
        : await searchApi.search(searchQuery.trim());

      setResults(result);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Search failed:', err);
        setError(err.message || '搜索失败');
      }
    } finally {
      setIsSearching(false);
    }
  }, [minLength]);

  const search = useCallback((searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!searchQuery.trim() || searchQuery.trim().length < minLength) {
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchQuery, mode);
    }, debounceMs);
  }, [debounceMs, minLength, mode, performSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    setIsSearching(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => {
    if (autoSearch && query.trim().length >= minLength) {
      search(query);
    } else if (query.trim().length < minLength) {
      setResults(null);
    }
  }, [query, autoSearch, minLength, search]);

  useEffect(() => {
    if (autoSearch && query.trim().length >= minLength) {
      search(query);
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
