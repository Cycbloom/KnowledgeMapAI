import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, FileText, Sparkles, ChevronRight, Clock, Layers, BookOpen } from 'lucide-react';
import type { SearchResult, SearchNodeResult } from '../../services/api/search';
import {
  type SearchNodeNavigateTarget,
  type GraphEditorPreferences,
} from '../Settings/GraphEditorSettings';

const PREFS_STORAGE_KEY = 'graphEditorPreferences';

/** Get the node ID from a search result, handling both keyword (id) and semantic (knowledge_point_id) formats */
const getNodeId = (node: SearchNodeResult): string =>
  node.knowledge_point_id || node.id || '';

const getDefaultNavigateTarget = (): SearchNodeNavigateTarget => {
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) {
      const prefs: Partial<GraphEditorPreferences> = JSON.parse(stored);
      return prefs.searchNodeNavigateTarget ?? 'graph';
    }
  } catch {
    // ignore parse errors
  }
  return 'graph';
};

interface SearchResultsProps {
  results: SearchResult | null;
  isSearching: boolean;
  query: string;
  onClose?: () => void;
}

const HighlightText: React.FC<{ text: string; query: string; className?: string }> = ({ 
  text, 
  query, 
  className = '' 
}) => {
  const highlighted = useMemo(() => {
    if (!text || !query.trim()) return text || '';
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) 
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 text-inherit rounded px-0.5">{part}</mark>
        : part
    );
  }, [text, query]);

  return <span className={className}>{highlighted}</span>;
};

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isSearching,
  query,
  onClose,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGraphClick = useCallback((graphId: string) => {
    navigate(`/graph/${graphId}`);
    onClose?.();
  }, [navigate, onClose]);

  const navigateToNode = useCallback((graphId: string, nodeId: string, target: SearchNodeNavigateTarget) => {
    if (target === 'learning') {
      navigate(`/learning?graph_id=${graphId}&node_id=${nodeId}`);
    } else {
      navigate(`/graph/${graphId}?node_id=${nodeId}`);
    }
    onClose?.();
  }, [navigate, onClose]);

  const handleNodeMainClick = useCallback((graphId: string, nodeId: string) => {
    const target = getDefaultNavigateTarget();
    navigateToNode(graphId, nodeId, target);
  }, [navigateToNode]);

  const hasResults = results && (results.graphs.length > 0 || results.nodes.length > 0);

  if (isSearching) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50 p-3">
        <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-4 h-4" />
          </motion.div>
          <span>搜索中...</span>
        </div>
      </div>
    );
  }

  if (!results && query.length >= 2) {
    return null;
  }

  if (!hasResults && query.length >= 2) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50 p-3">
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
          未找到「{query}」相关结果
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50 max-h-[60vh] overflow-y-auto"
      >
        {results?.answer && (
          <div className="p-2 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-primary-500" />
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300">AI 回答</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">{results.answer}</p>
          </div>
        )}

        {results?.graphs && results.graphs.length > 0 && (
          <div className="py-1.5 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              <Network className="w-3 h-3 text-primary-500" />
              <span>图谱 {results.graphs.length}</span>
            </div>
            <div>
              {results.graphs.map((graph) => (
                <button
                  key={graph.id}
                  onClick={() => handleGraphClick(graph.id)}
                  className="w-full px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left flex items-center gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HighlightText 
                        text={graph.title} 
                        query={query} 
                        className="text-sm text-gray-900 dark:text-white truncate font-medium"
                      />
                      {graph.similarity !== undefined && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">
                          {(graph.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {graph.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        <HighlightText text={graph.description} query={query} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {graph.nodes_count !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5" />
                          {graph.nodes_count}
                        </span>
                      )}
                      {graph.updated_at && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(graph.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {results?.nodes && results.nodes.length > 0 && (
          <div className="py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              <FileText className="w-3 h-3 text-green-500" />
              <span>节点 {results.nodes.length}</span>
            </div>
            <div>
              {results.nodes.map((node, index) => (
                <div
                  key={`${getNodeId(node)}-${index}`}
                  className="w-full px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2 group"
                >
                  <button
                    onClick={() => handleNodeMainClick(node.graph_id, getNodeId(node))}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <HighlightText 
                        text={node.title} 
                        query={query} 
                        className="text-sm text-gray-900 dark:text-white truncate font-medium"
                      />
                      {node.similarity !== undefined && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300">
                          {(node.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {(node.summary || node.content) && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        <HighlightText text={node.summary || node.content || ''} query={query} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      <span className="flex items-center gap-0.5 truncate">
                        <Network className="w-2.5 h-2.5 flex-shrink-0" />
                        <HighlightText text={node.graph_title || ''} query={query} />
                      </span>
                      {node.updated_at && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(node.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToNode(node.graph_id, getNodeId(node), 'graph');
                      }}
                      className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-400 hover:text-primary-500 transition-colors"
                      title={t('dashboard.search.navigateToGraph')}
                      aria-label={t('dashboard.search.navigateToGraph')}
                    >
                      <Network className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToNode(node.graph_id, getNodeId(node), 'learning');
                      }}
                      className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/30 text-gray-400 hover:text-green-500 transition-colors"
                      title={t('dashboard.search.navigateToLearning')}
                      aria-label={t('dashboard.search.navigateToLearning')}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
