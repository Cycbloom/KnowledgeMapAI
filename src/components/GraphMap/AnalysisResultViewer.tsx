import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Inbox } from 'lucide-react';
import type {
  AnalysisModuleId,
  AnalysisModuleState,
  RelationAnalysisResult,
  CrossDomainAnalysisResult,
  LearningPathAnalysisResult,
  KnowledgeGapAnalysisResult,
} from './types';
import { RelationsResultSection } from './RelationsResultSection';
import { CrossDomainInsightsSection } from './CrossDomainInsightsSection';
import { LearningPathSuggestionsSection } from './LearningPathSuggestionsSection';
import { KnowledgeGapsSection } from './KnowledgeGapsSection';

interface AnalysisResultViewerProps {
  isOpen: boolean;
  onClose: () => void;
  module: AnalysisModuleState | null;
  onGraphClick?: (graphId: string) => void;
  onCreateRelation?: (sourceId: string, targetId: string, relationType: string) => Promise<void>;
  onCreateGraph?: (title: string, domain?: string) => Promise<void>;
}

const moduleTitles: Record<AnalysisModuleId, string> = {
  relations: '关系发现结果',
  crossDomain: '跨学科洞察结果',
  learningPaths: '学习路径建议',
  knowledgeGaps: '知识缺口分析',
};

export const AnalysisResultViewer: React.FC<AnalysisResultViewerProps> = ({
  isOpen,
  onClose,
  module,
  onGraphClick,
  onCreateRelation,
  onCreateGraph,
}) => {
  if (!isOpen || !module) return null;

  const renderContent = () => {
    if (module.status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">正在分析中...</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            预计需要 {module.estimatedTime}
          </p>
        </div>
      );
    }

    if (module.status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">分析失败</p>
          <p className="text-sm text-red-500 dark:text-red-400 text-center max-w-md">
            {module.error || '未知错误，请重试'}
          </p>
        </div>
      );
    }

    if (module.status === 'idle' || !module.result) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">暂无分析结果</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            请先执行分析
          </p>
        </div>
      );
    }

    switch (module.id) {
      case 'relations':
        return (
          <RelationsResultSection
            result={module.result as RelationAnalysisResult}
            onGraphClick={onGraphClick}
            onCreateRelation={onCreateRelation}
          />
        );
      case 'crossDomain':
        return (
          <CrossDomainInsightsSection
            result={module.result as CrossDomainAnalysisResult}
            onGraphClick={onGraphClick}
          />
        );
      case 'learningPaths':
        return (
          <LearningPathSuggestionsSection
            result={module.result as LearningPathAnalysisResult}
            onGraphClick={onGraphClick}
          />
        );
      case 'knowledgeGaps':
        return (
          <KnowledgeGapsSection
            result={module.result as KnowledgeGapAnalysisResult}
            onGraphClick={onGraphClick}
            onCreateGraph={onCreateGraph}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {moduleTitles[module.id]}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {renderContent()}
          </div>

          <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
