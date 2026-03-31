import React from 'react';
import { motion } from 'framer-motion';
import {
  Route,
  Clock,
  BarChart3,
  ChevronRight,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import type { LearningPathAnalysisResult } from './types';

interface LearningPathSuggestionsSectionProps {
  result: LearningPathAnalysisResult;
  onGraphClick?: (graphId: string) => void;
}

const difficultyConfig = {
  beginner: {
    label: '入门',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-200 dark:border-green-800',
  },
  intermediate: {
    label: '中级',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800',
  },
  advanced: {
    label: '高级',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
  },
};

export const LearningPathSuggestionsSection: React.FC<LearningPathSuggestionsSectionProps> = ({
  result,
  onGraphClick,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {result.analysis_summary.total_paths}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">学习路径</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {result.analysis_summary.avg_path_length.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">平均长度</div>
        </div>
      </div>

      {result.learning_path_suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Route className="w-8 h-8 mx-auto mb-2 opacity-50" />
          没有发现学习路径建议
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            推荐的学习路径
          </div>
          {result.learning_path_suggestions.map((path, idx) => {
            const difficulty = difficultyConfig[path.difficulty];

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      路径 {idx + 1}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${difficulty.bg} ${difficulty.color}`}
                  >
                    {difficulty.label}
                  </span>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {path.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{path.estimated_time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    <span>{path.path.length} 个图谱</span>
                  </div>
                </div>

                {path.path_titles.length > 0 && (
                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <BookOpen className="w-3 h-3" />
                      学习顺序
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {path.path_titles.map((title, i) => (
                        <React.Fragment key={i}>
                          {onGraphClick && path.path[i] ? (
                            <button
                              onClick={() => onGraphClick(path.path[i])}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                            >
                              {title}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-700 dark:text-gray-300">
                              {title}
                            </span>
                          )}
                          {i < path.path_titles.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <span className="font-medium">提示：</span>
          学习路径基于图谱间的前置关系和知识依赖分析生成，建议按照推荐顺序学习以获得最佳效果
        </p>
      </div>
    </div>
  );
};
