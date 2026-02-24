import React from 'react';
import { 
  ArrowLeft, 
  Plus, 
  RefreshCw,
  Network,
  BookOpen,
  Layers,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import type { GraphMapFilterMode } from '../../types';

interface GraphMapToolbarProps {
  onBack: () => void;
  onRefresh: () => void;
  onCreateRelation: () => void;
  onCreateGraph: () => void;
  onAnalyze: () => void;
  filterMode: GraphMapFilterMode;
  onFilterChange: (mode: GraphMapFilterMode) => void;
  graphCount: number;
  relationCount: number;
  isLoading?: boolean;
  fromGraphId?: string | null;
  fromGraphTitle?: string;
  onReturnToGraph?: () => void;
}

const filterOptions: Array<{ value: GraphMapFilterMode; label: string; icon: React.ReactNode }> = [
  { value: 'all', label: '全部', icon: <Layers className="w-4 h-4" /> },
  { value: 'prerequisite', label: '前置知识', icon: <Network className="w-4 h-4" /> },
  { value: 'extension', label: '扩展知识', icon: <BookOpen className="w-4 h-4" /> },
  { value: 'related', label: '相关知识', icon: <Network className="w-4 h-4" /> },
];

export const GraphMapToolbar: React.FC<GraphMapToolbarProps> = ({
  onBack,
  onRefresh,
  onCreateRelation,
  onCreateGraph,
  onAnalyze,
  filterMode,
  onFilterChange,
  graphCount,
  relationCount,
  isLoading = false,
  fromGraphId,
  fromGraphTitle,
  onReturnToGraph,
}) => {
  return (
    <div className="h-14 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-blue-500" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            图谱地图
          </h1>
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>{graphCount} 个图谱</span>
          <span className="mx-2">·</span>
          <span>{relationCount} 个关系</span>
        </div>

        {fromGraphId && onReturnToGraph && (
          <>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
            <button
              onClick={onReturnToGraph}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
              title={`返回 ${fromGraphTitle || '来源图谱'}`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="max-w-[120px] truncate">{fromGraphTitle || '返回来源图谱'}</span>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterMode === option.value
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={onAnalyze}
          className="flex items-center gap-2 px-3 py-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
          title="AI 分析图谱地图"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">AI 分析</span>
        </button>

        <button
          onClick={onCreateGraph}
          className="flex items-center gap-2 px-3 py-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
          title="创建新图谱"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">创建图谱</span>
        </button>

        <button
          onClick={onCreateRelation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Network className="w-4 h-4" />
          <span className="text-sm font-medium">创建关系</span>
        </button>
      </div>
    </div>
  );
};
