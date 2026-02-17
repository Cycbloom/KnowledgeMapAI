import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, GitBranch, Lightbulb, Merge, Loader2 } from 'lucide-react';
import type { MapAnalysisResult } from '../../types';

interface MapAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: MapAnalysisResult | null;
  isLoading: boolean;
  onGraphClick: (graphId: string) => void;
  onCreateRelation: (sourceId: string, targetId: string, type: 'prerequisite' | 'extension' | 'related') => void;
}

export const MapAnalysisPanel: React.FC<MapAnalysisPanelProps> = ({
  isOpen,
  onClose,
  analysis,
  isLoading,
  onGraphClick,
  onCreateRelation,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-500" />
              图谱地图分析
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-400">正在分析图谱地图...</p>
              </div>
            ) : analysis ? (
              <div className="space-y-6">
                {analysis.isolated_graphs.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      孤岛图谱 ({analysis.isolated_graphs.length})
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      以下图谱没有任何关联，建议添加关系以建立知识网络
                    </p>
                    <div className="space-y-2">
                      {analysis.isolated_graphs.map(graph => (
                        <div
                          key={graph.id}
                          className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg"
                        >
                          <button
                            onClick={() => onGraphClick(graph.id)}
                            className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                          >
                            {graph.title}
                          </button>
                          <span className="text-xs text-amber-600 dark:text-amber-400">无关系</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.missing_prerequisites.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      <GitBranch className="w-4 h-4 text-blue-500" />
                      建议添加前置知识 ({analysis.missing_prerequisites.length})
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      以下图谱可能需要前置知识图谱
                    </p>
                    <div className="space-y-2">
                      {analysis.missing_prerequisites.map(item => (
                        <div
                          key={item.graph_id}
                          className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => onGraphClick(item.graph_id)}
                              className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
                            >
                              {item.graph_title}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.suggested_topics.map((topic, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.suggested_paths.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      <GitBranch className="w-4 h-4 text-green-500" />
                      学习路径建议 ({analysis.suggested_paths.length})
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      推荐的学习路径
                    </p>
                    <div className="space-y-2">
                      {analysis.suggested_paths.slice(0, 5).map((path, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm"
                        >
                          <button
                            onClick={() => onGraphClick(path.from)}
                            className="text-green-700 dark:text-green-400 hover:underline font-medium"
                          >
                            {path.from_title}
                          </button>
                          <span className="text-green-500">→</span>
                          {path.via.length > 0 && (
                            <>
                              <span className="text-gray-400 text-xs">via</span>
                              <span className="text-green-600 dark:text-green-400 text-xs">
                                {path.via.length} 个图谱
                              </span>
                              <span className="text-green-500">→</span>
                            </>
                          )}
                          <button
                            onClick={() => onGraphClick(path.to)}
                            className="text-green-700 dark:text-green-400 hover:underline font-medium"
                          >
                            {path.to_title}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.merge_suggestions.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      <Merge className="w-4 h-4 text-purple-500" />
                      合并建议 ({analysis.merge_suggestions.length})
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      以下图谱内容相似，建议合并
                    </p>
                    <div className="space-y-2">
                      {analysis.merge_suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                        >
                          <div className="flex flex-wrap gap-2 mb-2">
                            {suggestion.graph_titles.map((title, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded"
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-purple-600 dark:text-purple-400">
                            {suggestion.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.isolated_graphs.length === 0 &&
                 analysis.missing_prerequisites.length === 0 &&
                 analysis.suggested_paths.length === 0 &&
                 analysis.merge_suggestions.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🎉</div>
                    <p className="text-gray-600 dark:text-gray-400">
                      你的图谱地图结构良好！
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      暂无优化建议
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  点击"开始分析"按钮分析图谱地图
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
