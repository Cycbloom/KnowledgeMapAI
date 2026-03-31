import React from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Loader2, 
  AlertCircle, 
  Clock, 
  Eye,
  GitBranch,
  Layers,
  Lightbulb,
  AlertTriangle,
  Settings
} from 'lucide-react';
import type { AnalysisModuleCardProps } from './types';

const moduleIcons = {
  relations: GitBranch,
  crossDomain: Layers,
  learningPaths: Lightbulb,
  knowledgeGaps: AlertTriangle,
};

const moduleColors = {
  relations: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    check: 'bg-blue-500',
  },
  crossDomain: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-500',
    check: 'bg-purple-500',
  },
  learningPaths: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    check: 'bg-green-500',
  },
  knowledgeGaps: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
    check: 'bg-amber-500',
  },
};

export const AnalysisModuleCard: React.FC<AnalysisModuleCardProps> = ({
  module,
  onToggle,
  onViewResult,
  onEditPrompt,
  disabled = false,
}) => {
  const Icon = moduleIcons[module.id];
  const colors = moduleColors[module.id];
  const isLoading = module.status === 'loading';
  const isCompleted = module.status === 'completed';
  const hasError = module.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative p-4 rounded-xl border-2 transition-all cursor-pointer
        ${module.selected 
          ? `${colors.bg} ${colors.border}` 
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${disabled || isLoading ? 'opacity-60 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && !isLoading && onToggle()}
    >
      <div className="flex items-start gap-3">
        <div className={`
          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
          ${module.selected 
            ? `${colors.check} border-transparent` 
            : 'border-gray-300 dark:border-gray-600'
          }
        `}>
          {module.selected && (
            <Check className="w-3 h-3 text-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${colors.icon}`} />
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {module.name}
              </span>
            </div>
            {onEditPrompt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPrompt();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                title="编辑提示词"
              >
                <Settings size={16} />
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
            {module.description}
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{module.estimatedTime}</span>
            </div>

            {isLoading && (
              <div className="flex items-center gap-1 text-xs text-purple-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>分析中...</span>
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <Check className="w-3 h-3" />
                <span>已完成</span>
              </div>
            )}

            {hasError && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                <span>出错</span>
              </div>
            )}
          </div>

          {hasError && module.error && (
            <p className="text-xs text-red-500 mt-2 line-clamp-1">
              {module.error}
            </p>
          )}
        </div>

        {isCompleted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewResult();
            }}
            className={`
              p-2 rounded-lg transition-colors flex-shrink-0
              ${colors.bg} hover:opacity-80
            `}
            title="查看结果"
          >
            <Eye className={`w-4 h-4 ${colors.icon}`} />
          </button>
        )}
      </div>

      {isLoading && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-b-xl overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className={`h-full ${colors.check}`}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
    </motion.div>
  );
};
