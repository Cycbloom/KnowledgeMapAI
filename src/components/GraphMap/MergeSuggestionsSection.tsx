import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitMerge,
  Link2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MergeSuggestion } from '../../services/api/agent';

interface MergeSuggestionsSectionProps {
  suggestions: MergeSuggestion[];
  onMerge: (graphIds: string[]) => Promise<void>;
  onLink: (graphIds: string[]) => Promise<void>;
  onDismiss: (graphIds: string[]) => Promise<void>;
}

const getSimilarityColor = (score: number) => {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.6) return 'text-amber-600 dark:text-amber-400';
  return 'text-gray-600 dark:text-gray-400';
};

export const MergeSuggestionsSection: React.FC<MergeSuggestionsSectionProps> = ({
  suggestions,
  onMerge,
  onLink,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [completedActions, setCompletedActions] = useState<Map<string, 'merge' | 'link' | 'dismiss'>>(new Map());

  const actionConfig = {
    merge: {
      label: t('graphMap.mergeSuggestions.actions.merge'),
      icon: GitMerge,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      border: 'border-purple-200 dark:border-purple-800',
    },
    link: {
      label: t('graphMap.mergeSuggestions.actions.link'),
      icon: Link2,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-800',
    },
    keep_separate: {
      label: t('graphMap.mergeSuggestions.actions.keepSeparate'),
      icon: XCircle,
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-700',
      border: 'border-gray-200 dark:border-gray-600',
    },
  };

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleAction = async (
    action: 'merge' | 'link' | 'dismiss',
    suggestion: MergeSuggestion,
  ) => {
    const idKey = suggestion.graph_ids.join('-');
    setProcessingIds((prev) => new Set(prev).add(idKey));

    try {
      if (action === 'merge') {
        await onMerge(suggestion.graph_ids);
      } else if (action === 'link') {
        await onLink(suggestion.graph_ids);
      } else {
        await onDismiss(suggestion.graph_ids);
      }
      setCompletedActions((prev) => new Map(prev).set(idKey, action));
    } catch (error) {
      console.error(`Failed to ${action} graphs:`, error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(idKey);
        return next;
      });
    }
  };

  const isProcessing = (graphIds: string[]) => processingIds.has(graphIds.join('-'));
  const isCompleted = (graphIds: string[]) => completedActions.has(graphIds.join('-'));
  const getCompletedAction = (graphIds: string[]) => completedActions.get(graphIds.join('-'));

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <h4 className="font-medium text-gray-900 dark:text-white">{t('graphMap.mergeSuggestions.title')}</h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
          {t('graphMap.mergeSuggestions.itemCount', { count: suggestions.length })}
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          const isExpanded = expandedItems.has(idx);
          const processing = isProcessing(suggestion.graph_ids);
          const completed = isCompleted(suggestion.graph_ids);
          const completedAction = getCompletedAction(suggestion.graph_ids);
          const action = actionConfig[suggestion.suggested_action];

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-lg border overflow-hidden ${
                completed
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
              }`}
            >
              <div
                className="p-3 cursor-pointer"
                onClick={() => !completed && toggleItem(idx)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <GitMerge className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {suggestion.graph_titles.slice(0, 2).map((title, i) => (
                        <React.Fragment key={i}>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {title}
                          </span>
                          {i < Math.min(suggestion.graph_titles.length, 2) - 1 && (
                            <span className="text-gray-400 text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                      {suggestion.graph_titles.length > 2 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {t('graphMap.mergeSuggestions.moreItems', { count: suggestion.graph_titles.length - 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${action.bg} ${action.color}`}
                    >
                      {action.label}
                    </span>
                    <span
                      className={`text-xs font-medium ${getSimilarityColor(
                        suggestion.similarity_score,
                      )}`}
                    >
                      {Math.round(suggestion.similarity_score * 100)}%
                    </span>
                    {!completed && (
                      isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && !completed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3"
                >
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {suggestion.reason}
                    </p>

                    {suggestion.shared_concepts.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {t('graphMap.mergeSuggestions.sharedConcepts')}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.shared_concepts.map((concept, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                            >
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('merge', suggestion);
                        }}
                        disabled={processing}
                        className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
                          processing
                            ? 'bg-gray-100 dark:bg-slate-600 text-gray-400 cursor-wait'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        {processing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <GitMerge className="w-3 h-3" />
                        )}
                        {t('graphMap.mergeSuggestions.merge')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('link', suggestion);
                        }}
                        disabled={processing}
                        className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
                          processing
                            ? 'bg-gray-100 dark:bg-slate-600 text-gray-400 cursor-wait'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {processing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Link2 className="w-3 h-3" />
                        )}
                        {t('graphMap.mergeSuggestions.link')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction('dismiss', suggestion);
                        }}
                        disabled={processing}
                        className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        {t('graphMap.mergeSuggestions.dismiss')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {completed && (
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    {completedAction === 'merge' && t('graphMap.mergeSuggestions.merged')}
                    {completedAction === 'link' && t('graphMap.mergeSuggestions.linked')}
                    {completedAction === 'dismiss' && t('graphMap.mergeSuggestions.dismissed')}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          <span className="font-medium">{t('graphMap.mergeSuggestions.tip')}</span>
          {t('graphMap.mergeSuggestions.tipContent')}
        </p>
      </div>
    </div>
  );
};
