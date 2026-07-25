import React, { useState, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Link as LinkIcon, Loader2 } from 'lucide-react';
import type { Graph, GraphRelationType } from '../../types';
import { message } from '@/utils/messageHelper';
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';

interface CreateRelationPanelProps {
  graphs: Graph[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: GraphRelationType;
    context?: string;
  }) => Promise<void>;
  initialSourceId?: string;
}

export const CreateRelationPanel: React.FC<CreateRelationPanelProps> = ({
  graphs,
  isOpen,
  onClose,
  onSubmit,
  initialSourceId,
}) => {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = useState(initialSourceId || '');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState<GraphRelationType>('related');
  const [context, setContext] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTargets = useMemo(() => {
    return graphs.filter(g => g.id !== sourceId);
  }, [graphs, sourceId]);

  const handleSubmit = async () => {
    if (!sourceId || !targetId) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        source_graph_id: sourceId,
        target_graph_id: targetId,
        relation_type: relationType,
        context: context || undefined,
      });
      onClose();
      setSourceId('');
      setTargetId('');
      setRelationType('related');
      setContext('');
    } catch (error) {
      console.error('Failed to create relation:', error);
      message.error(t('graphMap.createRelation.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const relationTypeOptions: Array<{ value: GraphRelationType; label: string; description: string; color: string }> = [
    { value: 'prerequisite', label: t('createRelation.prerequisite'), description: t('createRelation.prerequisiteDesc'), color: 'bg-primary-500' },
    { value: 'extension', label: t('createRelation.extension'), description: t('createRelation.extensionDesc'), color: 'bg-green-500' },
    { value: 'related', label: t('createRelation.related'), description: t('createRelation.relatedDesc'), color: 'bg-amber-500' },
  ];

  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);
  const titleId = useId();

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
          ref={containerRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              {t('createRelation.title')}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createRelation.sourceGraph')}
              </label>
              <select
                value={sourceId}
                onChange={e => setSourceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('createRelation.selectSource')}</option>
                {graphs.map(graph => (
                  <option key={graph.id} value={graph.id}>
                    {graph.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400 rotate-90" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createRelation.targetGraph')}
              </label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('createRelation.selectTarget')}</option>
                {availableTargets.map(graph => (
                  <option key={graph.id} value={graph.id}>
                    {graph.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('createRelation.relationType')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {relationTypeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setRelationType(option.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createRelation.contextOptional')}
              </label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder={t('createRelation.contextPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>
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
              disabled={!sourceId || !targetId || isSubmitting}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? t('createRelation.creating') : t('createRelation.create')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
