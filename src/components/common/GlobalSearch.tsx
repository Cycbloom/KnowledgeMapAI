import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, LayoutGrid, FileText, Loader2, X, Sparkles, Clock, Filter, CheckCircle, Lock, Trash2 } from 'lucide-react';
import { cn } from '@/utils/utils';
import { api } from '../../services/api';
import { useTheme } from "../../hooks";
import { useCombobox } from '../../hooks/common/useCombobox';
import { queryKeys, defaultQueryConfig } from '@/hooks/queries/config';
import { formatDate as formatDateUtil } from '../../utils/formatters';

const SEARCH_HISTORY_KEY = 'knowledgeMap_searchHistory';
const MAX_HISTORY_ITEMS = 10;

interface SearchHistoryItem {
  query: string;
  type: 'keyword' | 'semantic';
  timestamp: number;
}

interface FilterState {
  timeRange: 'all' | 'today' | 'week' | 'month';
  status: 'all' | 'mastered' | 'learning' | 'new';
  tags: string[];
}

interface SearchResultGraph {
  id: string;
  title: string;
  description?: string;
}

interface SearchResultNode {
  id: string;
  title: string;
  graph_id: string;
  status?: string;
  tags?: string[];
  updated_at?: string;
  created_at?: string;
  knowledge_graphs?: {
    title: string;
  };
}

interface SearchResult {
  graphs: SearchResultGraph[];
  nodes: SearchResultNode[];
  answer?: string;
}

type SearchOption =
  | { kind: 'history'; item: SearchHistoryItem }
  | { kind: 'graph'; graph: SearchResultGraph }
  | { kind: 'node'; node: SearchResultNode };

function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function loadSearchHistory(): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history: SearchHistoryItem[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    console.error('Failed to save search history');
  }
}

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchType, setSearchType] = useState<'keyword' | 'semantic'>('keyword');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'all',
    status: 'all',
    tags: []
  });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounceValue(query, 300);

  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  const addToHistory = useCallback((searchQuery: string, type: 'keyword' | 'semantic') => {
    if (!searchQuery.trim()) return;
    
    const newItem: SearchHistoryItem = {
      query: searchQuery.trim(),
      type,
      timestamp: Date.now()
    };
    
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h.query !== searchQuery.trim());
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const removeFromHistory = useCallback((queryToRemove: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(h => h.query !== queryToRemove);
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.search(debouncedQuery),
    queryFn: async (): Promise<SearchResult> => {
      const result = await api.search.query(debouncedQuery, searchType);
      return result as SearchResult;
    },
    enabled: debouncedQuery.trim().length > 0,
    ...defaultQueryConfig,
  });

  const filteredResults = useMemo<SearchResult | null>(() => {
    if (!data) return null;

    let filteredNodes = data.nodes || [];

    if (filters.status !== 'all') {
      filteredNodes = filteredNodes.filter((node: SearchResultNode) => {
        const status = node.status || 'new';
        return status === filters.status;
      });
    }

    if (filters.timeRange !== 'all') {
      const now = new Date();
      const ranges: Record<string, number> = {
        today: 1,
        week: 7,
        month: 30
      };
      const daysAgo = ranges[filters.timeRange];
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      filteredNodes = filteredNodes.filter((node: SearchResultNode) => {
        const updatedAt = node.updated_at || node.created_at;
        return updatedAt && new Date(updatedAt) >= cutoff;
      });
    }

    return {
      ...data,
      nodes: filteredNodes
    };
  }, [data, filters.status, filters.timeRange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (path: string) => {
    if (query.trim()) {
      addToHistory(query.trim(), searchType);
    }
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  const handleHistoryClick = (item: SearchHistoryItem) => {
    setQuery(item.query);
    setSearchType(item.type);
  };

  const handleSearch = () => {
    if (query.trim()) {
      addToHistory(query.trim(), searchType);
    }
  };

  const formatDate = (timestamp: number) => {
    return formatDateUtil(timestamp, 'relative');
  };

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const getOptionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  const options = useMemo<SearchOption[]>(() => {
    if (!query.trim() && searchHistory.length > 0) {
      return searchHistory.map((item) => ({ kind: 'history' as const, item }));
    }
    if (filteredResults) {
      return [
        ...filteredResults.graphs.map((graph) => ({ kind: 'graph' as const, graph })),
        ...filteredResults.nodes.map((node) => ({ kind: 'node' as const, node })),
      ];
    }
    return [];
  }, [query, searchHistory, filteredResults]);

  const handleOptionSelect = (option: SearchOption) => {
    if (option.kind === 'history') {
      handleHistoryClick(option.item);
    } else if (option.kind === 'graph') {
      handleSelect(`/graph/${option.graph.id}`);
    } else {
      handleSelect(`/graph/${option.node.graph_id}?node_id=${option.node.id}`);
    }
  };

  const { activeIndex, activeId, handleKeyDown: handleComboboxKeyDown } = useCombobox<SearchOption>({
    options,
    isOpen,
    setIsOpen,
    onSelect: handleOptionSelect,
    getOptionId,
    getOptionLabel: (option: SearchOption) => {
      if (option.kind === 'history') return option.item.query;
      if (option.kind === 'graph') return option.graph.title;
      return option.node.title;
    },
    enabled: true,
  });

  return (
    <div className="relative w-full max-w-md" ref={wrapperRef}>
      <div className="relative">
        <Search className={cn("absolute left-3 top-1/2 transform -translate-y-1/2", isDark ? 'text-slate-400' : 'text-gray-400')} size={18} />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t('common.aria.search')}
          value={query}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            handleComboboxKeyDown(e.nativeEvent);
            if (e.nativeEvent.defaultPrevented) return;
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder={searchType === 'semantic' ? t('common.search.placeholder.semantic') : t('common.search.placeholder.keyword')}
          className={cn(
            "w-full pl-10 pr-24 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            isDark
              ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
              : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-500'
          )}
        />
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={cn("p-1 rounded-md transition-colors",
              showFilters
                ? 'bg-primary-500 text-white'
                : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
            )}
            title={t('common.search.filterButton')}
            aria-label={t('common.search.filterButton')}
          >
            <Filter size={14} aria-hidden="true" />
          </button>

          <button
            onClick={() => setSearchType(prev => prev === 'keyword' ? 'semantic' : 'keyword')}
            className={cn("p-1 rounded-md transition-colors",
              searchType === 'semantic'
                ? 'text-primary-500'
                : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
            )}
            title={searchType === 'semantic' ? t('common.search.toggleToKeyword') : t('common.search.toggleToSemantic')}
            aria-label={searchType === 'semantic' ? t('common.search.toggleToKeyword') : t('common.search.toggleToSemantic')}
          >
            <Sparkles size={14} fill={searchType === 'semantic' ? "currentColor" : "none"} aria-hidden="true" />
          </button>

          {query && (
            <button
              onClick={() => {
                setQuery('');
              }}
              aria-label={t('common.aria.close')}
              className={cn("p-1 rounded-md transition-colors",
                isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          role="region"
          aria-label={t('common.aria.searchResultsRegion')}
          className={cn("absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200",
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
        )}>
          {showFilters && (
            <div className={cn("p-3 border-b", isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50')}>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>{t('common.search.filter.timeLabel')}</span>
                  <div className="flex gap-1">
                    {(['all', 'today', 'week', 'month'] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setFilters(prev => ({ ...prev, timeRange: range }))}
                        className={cn("px-2 py-1 rounded-md transition-colors",
                          filters.timeRange === range
                            ? 'bg-primary-500 text-white'
                            : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        )}
                      >
                        {t(`common.search.scope.${range}`, { defaultValue: '' })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>{t('common.search.filter.statusLabel')}</span>
                  <div className="flex gap-1">
                    {([
                      { key: 'all', labelKey: 'common.search.filter.statusAll', icon: null },
                      { key: 'mastered', labelKey: 'common.search.filter.statusMastered', icon: CheckCircle },
                      { key: 'learning', labelKey: 'common.search.filter.statusLearning', icon: null },
                      { key: 'new', labelKey: 'common.search.filter.statusNew', icon: Lock }
                    ] as const).map(({ key, labelKey, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setFilters(prev => ({ ...prev, status: key }))}
                        className={cn("px-2 py-1 rounded-md transition-colors flex items-center gap-1",
                          filters.status === key
                            ? 'bg-primary-500 text-white'
                            : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        )}
                      >
                        {Icon && <Icon size={10} />}
                        {t(labelKey, { defaultValue: '' })}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!query.trim() && searchHistory.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto" role="listbox" id={listboxId}>
              <div className={cn("px-4 py-2 flex items-center justify-between", isDark ? 'border-slate-700' : 'border-gray-100')}>
                <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? 'text-slate-500' : 'text-gray-400')}>
                  {t('common.search.history.title')}
                </span>
                <button
                  onClick={clearHistory}
                  className={cn("text-xs flex items-center gap-1", isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600')}
                >
                  <Trash2 size={12} />
                  {t('common.search.history.clear')}
                </button>
              </div>
              {searchHistory.map((item, idx) => (
                <button
                  key={idx}
                  role="option"
                  id={getOptionId(idx)}
                  aria-selected={activeIndex === idx}
                  onClick={() => handleHistoryClick(item)}
                  className={cn("w-full text-left px-4 py-2 flex items-center justify-between gap-3 transition-colors group",
                    isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock size={14} className={isDark ? 'text-slate-500' : 'text-gray-400'} aria-hidden="true" />
                    <span className={cn("truncate", isDark ? 'text-slate-300' : 'text-gray-700')}>{item.query}</span>
                    {item.type === 'semantic' && (
                      <Sparkles size={12} className="text-primary-500" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", isDark ? 'text-slate-500' : 'text-gray-400')}>
                      {formatDate(item.timestamp)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.query);
                      }}
                      className={cn("opacity-0 group-hover:opacity-100 p-1 rounded transition-all",
                        isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-gray-200 text-gray-500'
                      )}
                      aria-label={t('common.search.history.removeItem', { query: item.query })}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          ) : isLoading ? (
            <div role="status" aria-live="polite" className={cn("p-4 text-center flex items-center justify-center gap-2", isDark ? 'text-slate-400' : 'text-gray-500')}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">{t('common.search.loading')}</span>
            </div>
          ) : filteredResults ? (
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar" aria-live="polite" aria-atomic="true" role="listbox" id={listboxId}>
              {(filteredResults.graphs.length > 0 || filteredResults.nodes.length > 0) && (
                <div className={cn("px-4 py-2 border-b text-xs font-medium", isDark ? 'text-slate-400 border-slate-700' : 'text-gray-500 border-gray-100')}>
                  {t('common.search.resultCount', { count: filteredResults.graphs.length + filteredResults.nodes.length })}
                </div>
              )}
              {filteredResults.answer && (
                <div className={cn("p-4 border-b", isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-primary-50/50')}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-primary-500" />
                    <span className={cn("text-xs font-bold uppercase tracking-wider", isDark ? 'text-primary-400' : 'text-primary-600')}>{t('common.search.aiAnswer')}</span>
                  </div>
                  <div className={cn("text-sm leading-relaxed", isDark ? 'text-slate-300' : 'text-gray-700')}>
                    {filteredResults.answer}
                  </div>
                </div>
              )}

              {filteredResults.graphs.length > 0 && (
                <div className="py-2">
                  <div className={cn("px-4 py-1 text-xs font-bold uppercase tracking-wider", isDark ? 'text-slate-500' : 'text-gray-400')}>
                    {t('common.search.graphs', { count: filteredResults.graphs.length })}
                  </div>
                  {filteredResults.graphs.map((g, idx) => (
                    <button
                      key={g.id}
                      role="option"
                      id={getOptionId(idx)}
                      aria-selected={activeIndex === idx}
                      onClick={() => handleSelect(`/graph/${g.id}`)}
                      className={cn("w-full text-left px-4 py-2 flex items-center gap-3 transition-colors group",
                        isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className={cn("p-2 rounded-lg transition-colors",
                        isDark ? 'bg-primary-900/30 text-primary-400 group-hover:bg-primary-900/50' : 'bg-primary-50 text-primary-600 group-hover:bg-primary-100'
                      )}>
                        <LayoutGrid size={18} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-medium truncate", isDark ? 'text-slate-200' : 'text-gray-800')}>{g.title}</div>
                        {g.description && <div className={cn("text-xs truncate", isDark ? 'text-slate-500' : 'text-gray-500')}>{g.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredResults.nodes.length > 0 && (
                <div className={cn("py-2", filteredResults.graphs.length > 0 ? 'border-t' : '', isDark ? 'border-slate-700' : 'border-gray-100')}>
                  <div className={cn("px-4 py-1 text-xs font-bold uppercase tracking-wider", isDark ? 'text-slate-500' : 'text-gray-400')}>
                    {t('common.search.nodes', { count: filteredResults.nodes.length })}
                  </div>
                  {filteredResults.nodes.map((n, idx) => (
                    <button
                      key={n.id}
                      role="option"
                      id={getOptionId(filteredResults.graphs.length + idx)}
                      aria-selected={activeIndex === filteredResults.graphs.length + idx}
                      onClick={() => handleSelect(`/graph/${n.graph_id}?node_id=${n.id}`)}
                      className={cn("w-full text-left px-4 py-2 flex items-center gap-3 transition-colors group",
                        isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className={cn("p-2 rounded-lg transition-colors",
                        isDark ? 'bg-green-900/30 text-green-400 group-hover:bg-green-900/50' : 'bg-green-50 text-green-600 group-hover:bg-green-100'
                      )}>
                        <FileText size={18} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-medium truncate flex items-center gap-2", isDark ? 'text-slate-200' : 'text-gray-800')}>
                          <span className="truncate">{n.title}</span>
                          {n.status === 'mastered' && <CheckCircle size={12} className="text-green-500" aria-hidden="true" />}
                          {n.status === 'locked' && <Lock size={12} className="text-gray-400" aria-hidden="true" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-xs", isDark ? 'text-slate-500' : 'text-gray-500')}>
                            {n.knowledge_graphs?.title || t('common.search.unknownGraph')}
                          </span>
                          {n.tags && n.tags.length > 0 && (
                            <div className="flex gap-1">
                              {n.tags.slice(0, 2).map((tag: string, i: number) => (
                                <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded-full", isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500')}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredResults.graphs.length === 0 && filteredResults.nodes.length === 0 && (
                <div role="status" aria-live="polite" className={cn("p-8 text-center text-sm", isDark ? 'text-slate-500' : 'text-gray-500')}>
                  {t('common.search.noResults')}
                </div>
              )}
            </div>
          ) : query.trim() ? null : (
            <div className={cn("p-8 text-center text-sm", isDark ? 'text-slate-500' : 'text-gray-500')}>
              {t('common.search.inputToStart')}
            </div>
          )}

          <div className={cn("px-4 py-2 border-t flex items-center justify-between text-xs", isDark ? 'border-slate-700 text-slate-500' : 'border-gray-100 text-gray-400')}>
            <span>{t('common.search.shortcut')}</span>
            <span>{searchType === 'semantic' ? t('common.search.semanticMode') : t('common.search.keywordMode')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
