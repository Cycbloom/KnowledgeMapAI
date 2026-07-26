import React, { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles, Network, ChevronDown, ChevronUp, Check, Settings2 } from 'lucide-react';
import type { GraphRelationType, InfiniteExpansionProgress } from '../../types';
import { message } from '@/utils/messageHelper';
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';

interface InfiniteExpansionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGraphId: string;
  sourceGraphTitle: string;
  onSubmit: (config: {
    max_depth: number;
    max_graphs_per_level: number;
    relation_types: GraphRelationType[];
    auto_generate_nodes: boolean;
    node_depth: number;
  }) => Promise<void>;
  progress?: InfiniteExpansionProgress | null;
  isRunning?: boolean;
  onEditPrompt?: () => void;
}

export const InfiniteExpansionPanel: React.FC<InfiniteExpansionPanelProps> = ({
  isOpen,
  onClose,
  sourceGraphId: _sourceGraphId,
  sourceGraphTitle,
  onSubmit,
  progress,
  isRunning = false,
  onEditPrompt,
}) => {
  const { t } = useTranslation();
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxGraphsPerLevel, setMaxGraphsPerLevel] = useState(3);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<GraphRelationType[]>(['prerequisite', 'extension', 'related']);
  const [autoGenerateNodes, setAutoGenerateNodes] = useState(true);
  const [nodeDepth, setNodeDepth] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const relationTypeOptions: Array<{ value: GraphRelationType; label: string; color: string }> = [
    { value: 'prerequisite', label: t('graphMap.infiniteExpansion.relationPrerequisite'), color: 'bg-primary-500' },
    { value: 'extension', label: t('graphMap.infiniteExpansion.relationExtension'), color: 'bg-green-500' },
    { value: 'related', label: t('graphMap.infiniteExpansion.relationRelated'), color: 'bg-amber-500' },
  ];

  const toggleRelationType = (type: GraphRelationType) => {
    setSelectedRelationTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (selectedRelationTypes.length === 0) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        max_depth: maxDepth,
        max_graphs_per_level: maxGraphsPerLevel,
        relation_types: selectedRelationTypes,
        auto_generate_nodes: autoGenerateNodes,
        node_depth: nodeDepth,
      });
    } catch (error) {
      console.error('Failed to start expansion:', error);
      message.error(t('graphMap.infiniteExpansion.startFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isRunning && progress) {
      setIsSubmitting(false);
    }
  }, [isRunning, progress]);

  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);
  const titleId = useId();
  const advancedControlsId = useId();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles aria-hidden="true" className="w-5 h-5 text-primary-500" />
              {t('graphMap.infiniteExpansion.title')}
            </h2>
            <div className="flex items-center gap-2">
              {onEditPrompt && (
                <button
                  onClick={onEditPrompt}
                  className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                  title={t('graphMap.infiniteExpansion.editPromptTitle')}
                  aria-label={t('common.aria.editPrompt')}
                >
                  <Settings2 aria-hidden="true" className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                aria-label={t('common.aria.close')}
              >
                <X aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300">
                <Network aria-hidden="true" className="w-4 h-4" />
                <span className="font-medium">{t('graphMap.infiniteExpansion.sourceGraphLabel')}</span>
                <span>{sourceGraphTitle}</span>
              </div>
              <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                {t('graphMap.infiniteExpansion.sourceGraphHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('graphMap.infiniteExpansion.relationType')}
              </label>
              <div className="flex gap-2">
                {relationTypeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => toggleRelationType(option.value)}
                    disabled={isRunning}
                    className={`flex-1 p-2 rounded-lg border-2 transition-all text-center ${
                      selectedRelationTypes.includes(option.value)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('graphMap.infiniteExpansion.depthLabel', { depth: maxDepth })}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={maxDepth}
                onChange={e => setMaxDepth(Number(e.target.value))}
                disabled={isRunning}
                aria-label={t('graphMap.infiniteExpansion.depthLabel', { depth: maxDepth })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>{t('graphMap.infiniteExpansion.depthMin')}</span>
                <span>{t('graphMap.infiniteExpansion.depthMax')}</span>
              </div>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              aria-controls={advancedControlsId}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
              {t('graphMap.infiniteExpansion.advancedOptions')}
            </button>

            {showAdvanced && (
              <motion.div
                id={advancedControlsId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('graphMap.infiniteExpansion.maxGraphsPerLevel', { count: maxGraphsPerLevel })}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxGraphsPerLevel}
                    onChange={e => setMaxGraphsPerLevel(Number(e.target.value))}
                    disabled={isRunning}
                    aria-label={t('graphMap.infiniteExpansion.maxGraphsPerLevel', { count: maxGraphsPerLevel })}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoGenerateNodes"
                    checked={autoGenerateNodes}
                    onChange={e => setAutoGenerateNodes(e.target.checked)}
                    disabled={isRunning}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="autoGenerateNodes" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <Sparkles aria-hidden="true" className="w-4 h-4 text-green-500" />
                    <span>{t('graphMap.infiniteExpansion.autoGenerateNodes')}</span>
                  </label>
                </div>

                {autoGenerateNodes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('graphMap.infiniteExpansion.nodeDepthLabel', { depth: nodeDepth })}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={nodeDepth}
                      onChange={e => setNodeDepth(Number(e.target.value))}
                      disabled={isRunning}
                      aria-label={t('graphMap.infiniteExpansion.nodeDepthLabel', { depth: nodeDepth })}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {(isRunning || isSubmitting) && progress && (
              <div role="status" className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 aria-hidden="true" className="w-5 h-5 text-primary-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('graphMap.infiniteExpansion.expanding')}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{t('graphMap.infiniteExpansion.currentDepth')}</span>
                    <span>{progress.current_depth} / {maxDepth}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{t('graphMap.infiniteExpansion.createdGraphs')}</span>
                    <span>{progress.total_graphs_created}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{t('graphMap.infiniteExpansion.createdNodes')}</span>
                    <span>{progress.total_nodes_created}</span>
                  </div>
                  {progress.current_graph_title && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      {t('graphMap.infiniteExpansion.processing', { title: progress.current_graph_title })}
                    </div>
                  )}
                </div>

                {progress.created_graphs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {t('graphMap.infiniteExpansion.createdGraphsList')}
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {progress.created_graphs.slice(-5).map((g, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            g.relation_type === 'prerequisite' ? 'bg-primary-500' :
                            g.relation_type === 'extension' ? 'bg-green-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{g.title}</span>
                          <span className="text-gray-400">{t('graphMap.infiniteExpansion.nodeCountShort', { count: g.node_count ?? 0 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {progress?.status === 'completed' && (
              <div role="status" className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                  <Check aria-hidden="true" className="w-5 h-5" />
                  <span className="font-medium">{t('graphMap.infiniteExpansion.completed')}</span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  {t('graphMap.infiniteExpansion.completedSummary', { graphs: progress.total_graphs_created, nodes: progress.total_nodes_created })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {progress?.status === 'completed' ? t('graphMap.infiniteExpansion.close') : t('graphMap.infiniteExpansion.cancel')}
            </button>
            {progress?.status !== 'completed' && progress?.status !== 'running' && (
              <button
                onClick={handleSubmit}
                disabled={selectedRelationTypes.length === 0 || isSubmitting || isRunning}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    {t('graphMap.infiniteExpansion.starting')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    {t('graphMap.infiniteExpansion.startExpansion')}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
