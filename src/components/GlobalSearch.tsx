import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, FileText, Loader2, X, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';

// Manual debounce hook
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchType, setSearchType] = useState<'keyword' | 'semantic'>('keyword');
  const [results, setResults] = useState<{ graphs: any[], nodes: any[], answer?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounceValue(query, 300);

  useEffect(() => {
    const search = async () => {
      if (!debouncedQuery.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const data = await api.search.query(debouncedQuery, searchType);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    search();
  }, [debouncedQuery, searchType]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-full max-w-md" ref={wrapperRef}>
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={searchType === 'semantic' ? "AI 语义搜索..." : "搜索图谱或节点..."}
          className={`w-full pl-10 pr-20 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isDark 
              ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' 
              : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-500'
          }`}
        />
        
        <button
            onClick={() => setSearchType(prev => prev === 'keyword' ? 'semantic' : 'keyword')}
            className={`absolute right-${query ? '9' : '3'} top-1/2 transform -translate-y-1/2 transition-colors p-1 rounded-md hover:bg-black/5 ${
              searchType === 'semantic' 
                ? 'text-purple-500' 
                : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
            }`}
            title={searchType === 'semantic' ? "切换回关键词搜索" : "开启AI语义搜索"}
        >
            <Sparkles size={16} fill={searchType === 'semantic' ? "currentColor" : "none"} />
        </button>

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults(null);
            }}
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
              isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (query.trim() !== '') && (
        <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
        }`}>
          {loading ? (
            <div className={`p-4 text-center flex items-center justify-center gap-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">搜索中...</span>
            </div>
          ) : results ? (
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* AI Answer Section */}
              {results.answer && (
                <div className={`p-4 border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-purple-50/50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-purple-500" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>AI 回答</span>
                  </div>
                  <div className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    {results.answer}
                  </div>
                </div>
              )}

              {/* Graphs Section */}
              {results.graphs.length > 0 && (
                <div className="py-2">
                  <div className={`px-4 py-1 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>图谱</div>
                  {results.graphs.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleSelect(`/graph/${g.id}`)}
                      className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors group ${
                        isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg transition-colors ${
                        isDark ? 'bg-blue-900/30 text-blue-400 group-hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                      }`}>
                        <LayoutGrid size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className={`font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{g.title}</div>
                        {g.description && <div className={`text-xs truncate max-w-[200px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{g.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Nodes Section */}
              {results.nodes.length > 0 && (
                <div className={`py-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <div className={`px-4 py-1 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>节点</div>
                  {results.nodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleSelect(`/graph/${n.graph_id}?node_id=${n.id}`)}
                      className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors group ${
                        isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg transition-colors ${
                        isDark ? 'bg-green-900/30 text-green-400 group-hover:bg-green-900/50' : 'bg-green-50 text-green-600 group-hover:bg-green-100'
                      }`}>
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium truncate flex items-center justify-between ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                            <span className="truncate">{n.title}</span>
                            <span className={`ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded-full shrink-0 ${
                              isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-400'
                            }`}>
                                {n.knowledge_graphs?.title || '未知图谱'}
                            </span>
                        </div>
                        {n.content && <div className={`text-xs truncate max-w-[260px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{n.content.slice(0, 50)}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.graphs.length === 0 && results.nodes.length === 0 && (
                <div className={`p-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  未找到相关内容
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
