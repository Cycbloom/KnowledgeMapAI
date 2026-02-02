import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, FileText, Loader2, X } from 'lucide-react';
import { api } from '../services/api';

// Manual debounce hook since I'm not sure if useTheme exports one
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
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<{ graphs: any[], nodes: any[] } | null>(null);
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
        const data = await api.search.query(debouncedQuery);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    search();
  }, [debouncedQuery]);

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
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="搜索图谱或节点..."
          className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults(null);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (query.trim() !== '') && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          {loading ? (
            <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">搜索中...</span>
            </div>
          ) : results ? (
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Graphs Section */}
              {results.graphs.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">图谱</div>
                  {results.graphs.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleSelect(`/graph/${g.id}`)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors group"
                    >
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700">
                        <LayoutGrid size={18} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{g.title}</div>
                        {g.description && <div className="text-xs text-gray-500 truncate max-w-[200px]">{g.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Nodes Section */}
              {results.nodes.length > 0 && (
                <div className="py-2 border-t border-gray-100">
                  <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">节点</div>
                  {results.nodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleSelect(`/graph/${n.graph_id}?node_id=${n.id}`)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors group"
                    >
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 group-hover:text-green-700">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">
                            {n.title}
                            <span className="ml-2 text-xs text-gray-400 font-normal bg-gray-100 px-1.5 py-0.5 rounded-full">
                                {n.knowledge_graphs?.title || '未知图谱'}
                            </span>
                        </div>
                        {n.content && <div className="text-xs text-gray-500 truncate max-w-[260px]">{n.content.slice(0, 50)}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.graphs.length === 0 && results.nodes.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">
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
