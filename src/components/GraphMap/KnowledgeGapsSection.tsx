import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Plus,
  ExternalLink,
  BookOpen,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { KnowledgeGapAnalysisResult } from './types';

interface KnowledgeGapsSectionProps {
  result: KnowledgeGapAnalysisResult;
  onGraphClick?: (graphId: string) => void;
  onCreateGraph?: (title: string, domain?: string) => Promise<void>;
}

export const KnowledgeGapsSection: React.FC<KnowledgeGapsSectionProps> = ({
  result,
  onGraphClick,
  onCreateGraph,
}) => {
  const { t } = useTranslation();
  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(new Set());
  const [creatingGraph, setCreatingGraph] = useState<string | null>(null);

  const importanceConfig = {
    high: {
      label: t('graphMap.knowledgeGaps.priorityHigh'),
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800',
      dot: 'bg-red-500',
    },
    medium: {
      label: t('graphMap.knowledgeGaps.priorityMedium'),
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    low: {
      label: t('graphMap.knowledgeGaps.priorityLow'),
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-700',
      border: 'border-gray-200 dark:border-gray-600',
      dot: 'bg-gray-500',
    },
  };

  const actionConfig = {
    create: {
      label: t('graphMap.knowledgeGaps.actionCreate'),
      icon: Plus,
    },
    merge: {
      label: t('graphMap.knowledgeGaps.actionMerge'),
      icon: BookOpen,
    },
    expand: {
      label: t('graphMap.knowledgeGaps.actionExpand'),
      icon: Lightbulb,
    },
  };

  const toggleGap = (idx: number) => {
    setExpandedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleCreateGraph = async (missingTopic: string) => {
    if (!onCreateGraph) return;
    setCreatingGraph(missingTopic);
    try {
      await onCreateGraph(missingTopic);
    } finally {
      setCreatingGraph(null);
    }
  };

  // useMemo 缓存排序结果，避免每次渲染重复拷贝+排序 knowledge_gaps
  const sortedGaps = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 };
    return [...result.knowledge_gaps].sort((a, b) => {
      return order[a.importance] - order[b.importance];
    });
  }, [result.knowledge_gaps]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {result.analysis_summary.total_gaps}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.knowledgeGaps.knowledgeGapsLabel')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {result.analysis_summary.high_priority_count}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('graphMap.knowledgeGaps.highPriorityLabel')}</div>
        </div>
      </div>

      {result.knowledge_gaps.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {t('graphMap.knowledgeGaps.noGapsFound')}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('graphMap.knowledgeGaps.identifiedGaps')}
          </div>
          {sortedGaps.map((gap, idx) => {
            const importance = importanceConfig[gap.importance];
            const action = actionConfig[gap.suggested_action];
            const isExpanded = expandedGaps.has(idx);
            const isCreating = creatingGraph === gap.missing_topic;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-lg border overflow-hidden ${
                  gap.importance === 'high'
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => toggleGap(idx)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${importance.dot}`}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {gap.missing_topic}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${importance.bg} ${importance.color}`}
                      >
                        {importance.label}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-3 pb-3"
                  >
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {gap.reason}
                      </p>

                      {gap.related_graph_titles.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                            <BookOpen className="w-3 h-3" />
                            {t('graphMap.knowledgeGaps.relatedGraphs')}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {gap.related_graph_titles.map((title, i) => (
                              <React.Fragment key={i}>
                                {onGraphClick && gap.related_graphs[i] ? (
                                  <button
                                    onClick={() => onGraphClick(gap.related_graphs[i])}
                                    className="text-xs text-primary-600 dark:text-primary-400 underline flex items-center gap-0.5"
                                  >
                                    {title}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {title}
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <action.icon className="w-3 h-3" />
                          {t('graphMap.knowledgeGaps.suggestion')}{action.label}
                        </div>
                        {onCreateGraph && gap.suggested_action === 'create' && (
                          <button
                            onClick={() => handleCreateGraph(gap.missing_topic)}
                            disabled={isCreating}
                            className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                              isCreating
                                ? 'bg-gray-100 dark:bg-slate-600 text-gray-400 cursor-wait'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                          >
                            {isCreating ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                >
                                  <Plus className="w-3 h-3" />
                                </motion.div>
                                {t('graphMap.knowledgeGaps.creating')}
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                {t('graphMap.knowledgeGaps.createGraph')}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {result.analysis_summary.high_priority_count > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">
            <span className="font-medium">{t('graphMap.knowledgeGaps.suggestion')}</span>
            {t('graphMap.knowledgeGaps.recommendationText')}
          </p>
        </div>
      )}
    </div>
  );
};
