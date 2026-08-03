import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles, ArrowRight, AlertCircle, Settings, Check } from 'lucide-react';
import type { GraphRelationType, QuickCreateGraphRequest } from '../../types';
import type { DomainTreeNode } from '@shared/types/graph';
import { useTopicCheck } from "../../hooks";
import { PromptSettingsPanel } from '../GraphEditor/panels/PromptSettingsPanel';
import { domainsApi } from '../../services/api/domains';

interface QuickCreateGraphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: QuickCreateGraphRequest) => Promise<void>;
  relatedGraphId?: string;
  relatedGraphTitle?: string;
  defaultRelationType?: GraphRelationType;
  domains?: DomainTreeNode[];
}

export const QuickCreateGraphPanel: React.FC<QuickCreateGraphPanelProps> = ({
  isOpen,
  onClose,
  onSubmit,
  relatedGraphId,
  relatedGraphTitle,
  defaultRelationType = 'related',
  domains,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [relationType, setRelationType] = useState<GraphRelationType>(defaultRelationType);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [aiDomainRecommendations, setAiDomainRecommendations] = useState<Array<{
    id: string;
    name: string;
    confidence: number;
    reason: string;
  }>>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [selectedRecommendedDomains, setSelectedRecommendedDomains] = useState<Set<string>>(new Set());

  const { isChecking, isDuplicate, similarGraphs, checkTopic, reset: resetTopicCheck } = useTopicCheck({ debounceMs: 500 });

  useEffect(() => {
    if (title.trim().length >= 2) {
      checkTopic(title);
    } else {
      resetTopicCheck();
    }
  }, [title, checkTopic, resetTopicCheck]);

  useEffect(() => {
    if (!title || title.length <= 2) {
      setAiDomainRecommendations([]);
      setShowRecommendations(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingRecommendations(true);
      try {
        const result = await domainsApi.recommendDomains(title, description);
        if (result.recommendations && result.recommendations.length > 0) {
          setAiDomainRecommendations(result.recommendations);
          setShowRecommendations(true);
        } else {
          setShowRecommendations(false);
        }
      } catch (error) {
        console.error('Failed to get domain recommendations:', error);
      } finally {
        setIsLoadingRecommendations(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [title, description]);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setAutoGenerate(false);
      setSelectedDomainIds(new Set());
      resetTopicCheck();
      setAiDomainRecommendations([]);
      setShowRecommendations(false);
      setIsLoadingRecommendations(false);
      setSelectedRecommendedDomains(new Set());
    }
  }, [isOpen, resetTopicCheck]);

  const handleSubmit = async () => {
    if (!title.trim() || isDuplicate) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        relation_to: relatedGraphId ? {
          graph_id: relatedGraphId,
          type: relationType,
        } : undefined,
        auto_generate_content: autoGenerate,
        domains: selectedDomainIds.size > 0
          ? Array.from(selectedDomainIds).map(id => ({ domain_id: id }))
          : undefined,
      });
      onClose();
      setTitle('');
      setDescription('');
      setAutoGenerate(false);
      setSelectedDomainIds(new Set());
      resetTopicCheck();
    } catch (error) {
      console.error('Failed to create graph:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRecommendedDomain = (domainId: string) => {
    setSelectedRecommendedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domainId)) {
        newSet.delete(domainId);
        setSelectedDomainIds(prevIds => {
          const next = new Set(prevIds);
          next.delete(domainId);
          return next;
        });
      } else {
        newSet.add(domainId);
        setSelectedDomainIds(prevIds => {
          const next = new Set(prevIds);
          next.add(domainId);
          return next;
        });
      }
      return newSet;
    });
  };

  const relationTypeOptions: Array<{ value: GraphRelationType; label: string; description: string; color: string }> = [
    { value: 'prerequisite', label: t('quickCreate.relation.prerequisite'), description: t('quickCreate.relation.prerequisiteDesc'), color: 'bg-primary-500' },
    { value: 'extension', label: t('quickCreate.relation.extension'), description: t('quickCreate.relation.extensionDesc'), color: 'bg-green-500' },
    { value: 'related', label: t('quickCreate.relation.related'), description: t('quickCreate.relation.relatedDesc'), color: 'bg-amber-500' },
  ];

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
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('quickCreate.title')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPromptConfig(true)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                title={t('quickCreate.promptConfig')}
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('quickCreate.graphName')} <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  aria-required={true}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('quickCreate.namePlaceholder')}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${
                    isDuplicate 
                      ? 'border-amber-500 focus:ring-amber-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
                  }`}
                />
                {isChecking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary-500" />
                )}
              </div>
              {isDuplicate && similarGraphs.length > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">{t('quickCreate.duplicateTopic')}</p>
                    <p className="mt-0.5">
                      {t('quickCreate.similarTo', { title: similarGraphs[0].title, similarity: (similarGraphs[0].similarity * 100).toFixed(1) })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('quickCreate.descriptionOptional')}
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('quickCreate.descriptionPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            {relatedGraphId && relatedGraphTitle && (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="truncate max-w-[150px]">{relatedGraphTitle}</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                  <span className="text-primary-600 dark:text-primary-400 font-medium">{t('quickCreate.newGraph')}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('quickCreate.relationType')}
                  </label>
                  <div className="space-y-2">
                    {relationTypeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setRelationType(option.value)}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          relationType === option.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${option.color}`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <input
                type="checkbox"
                id="autoGenerate"
                checked={autoGenerate}
                onChange={e => setAutoGenerate(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="autoGenerate" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <span>{t('quickCreate.autoGenerate')}</span>
              </label>
            </div>

            {showRecommendations && (
              <div className="mb-3 p-3 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {t('quickCreate.aiRecommendDomains')}
                  </span>
                  <button
                    onClick={() => setShowRecommendations(false)}
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    {t('quickCreate.ignore')}
                  </button>
                </div>

                {isLoadingRecommendations ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                    <span className="text-sm text-primary-600 dark:text-primary-400">{t('quickCreate.analyzing')}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {aiDomainRecommendations.map((rec) => {
                      const isSelected = selectedRecommendedDomains.has(rec.id);
                      const confidencePercent = Math.round(rec.confidence * 100);

                      return (
                        <button
                          key={rec.id}
                          onClick={() => toggleRecommendedDomain(rec.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-primary-500 text-white ring-2 ring-primary-300'
                              : confidencePercent >= 80
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 hover:bg-primary-200'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                          }`}
                          title={rec.reason}
                        >
                          {rec.name}
                          <span className={`text-[10px] ${
                            isSelected ? 'text-primary-100' : 'text-gray-400'
                          }`}>
                            {confidencePercent}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {(!domains || domains.length === 0) && !showRecommendations && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('quickCreate.noDomains')}</p>
            )}

            {domains && domains.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('quickCreate.domainsOptional')}
                </label>
                <div className="max-h-[160px] overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-1.5 space-y-0.5">
                  {domains.map((domain) => {
                    const isSelected = selectedDomainIds.has(domain.id);
                    return (
                      <button
                        key={domain.id}
                        onClick={() => {
                          const next = new Set(selectedDomainIds);
                          if (isSelected) next.delete(domain.id);
                          else next.add(domain.id);
                          setSelectedDomainIds(next);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: domain.color || '#94A3B8' }} />
                        <span className="flex-1 text-left truncate">{domain.name}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting || isChecking || isDuplicate}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('quickCreate.create')}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {showPromptConfig && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4 backdrop-blur-sm"
          onClick={() => setShowPromptConfig(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('quickCreate.promptConfig')}
              </h2>
              <button
                onClick={() => setShowPromptConfig(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <PromptSettingsPanel scope="user" />
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
