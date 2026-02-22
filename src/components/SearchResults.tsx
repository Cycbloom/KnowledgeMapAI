import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, FileText, Sparkles, ArrowRight, Clock } from 'lucide-react';
import type { SearchResult } from '../services/api/search';

interface SearchResultsProps {
  results: SearchResult | null;
  isSearching: boolean;
  query: string;
  onClose?: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isSearching,
  query,
  onClose,
}) => {
  const navigate = useNavigate();

  const handleGraphClick = (graphId: string) => {
    navigate(`/graph/${graphId}`);
    onClose?.();
  };

  const handleNodeClick = (graphId: string) => {
    navigate(`/graph/${graphId}`);
    onClose?.();
  };

  const hasResults = results && (results.graphs.length > 0 || results.nodes.length > 0);

  if (isSearching) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 p-6">
        <div className="flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
          <span>正在搜索...</span>
        </div>
      </div>
    );
  }

  if (!results && query.length >= 2) {
    return null;
  }

  if (!hasResults && query.length >= 2) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>未找到与「{query}」相关的结果</p>
          <p className="text-sm mt-1">尝试使用不同的关键词或切换到语义搜索</p>
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 max-h-[70vh] overflow-y-auto"
      >
        {results?.answer && (
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">AI 回答</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{results.answer}</p>
          </div>
        )}

        {results?.graphs && results.graphs.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                图谱 ({results.graphs.length})
              </span>
            </div>
            <div className="space-y-2">
              {results.graphs.map((graph) => (
                <button
                  key={graph.id}
                  onClick={() => handleGraphClick(graph.id)}
                  className="w-full p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {graph.title}
                      </h4>
                      {graph.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {graph.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {graph.nodes_count !== undefined && (
                          <span>{graph.nodes_count} 个节点</span>
                        )}
                        {graph.updated_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(graph.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-2" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {results?.nodes && results.nodes.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                节点 ({results.nodes.length})
              </span>
            </div>
            <div className="space-y-2">
              {results.nodes.map((node, index) => (
                <button
                  key={`${node.knowledge_point_id}-${index}`}
                  onClick={() => handleNodeClick(node.graph_id)}
                  className="w-full p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {node.title}
                        </h4>
                        {node.similarity !== undefined && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            {(node.similarity * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {node.content && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {node.content}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                        所属图谱：{node.graph_title}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors flex-shrink-0 ml-2" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
