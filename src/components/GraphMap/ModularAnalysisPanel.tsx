import React, { useMemo, useState, useId } from 'react';
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Play, CheckCircle2, AlertCircle, Loader2, Layers } from 'lucide-react';
import { AnalysisModuleCard } from './AnalysisModuleCard';
import { PromptEditor } from '../GraphEditor/panels/PromptEditor';
import { MODULE_TO_SCENARIO, type ModularAnalysisPanelProps, type AnalysisModuleId } from './types';
import { getScenarioById } from '../PromptConfig';
import { api } from '../../services/api';
import { message } from "../../utils/messageHelper";
import { EmptyState } from '../common/EmptyState';
import { queryKeys, defaultQueryConfig } from '@/hooks/queries/config';
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';

interface PromptTemplateItem {
  code: string;
  template_content: string;
}

interface PromptListResponse {
  system: PromptTemplateItem[];
  user: PromptTemplateItem[];
  graph: PromptTemplateItem[];
}

export const ModularAnalysisPanel: React.FC<ModularAnalysisPanelProps> = ({
  isOpen,
  onClose,
  modules,
  onToggleModule,
  onExecuteModules,
  onViewResult,
  onEditPrompt: _onEditPrompt,
  promptContents,
  graphId,
}) => {
  const [editingPromptModule, setEditingPromptModule] = useState<AnalysisModuleId | null>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const selectedModules = useMemo(
    () => modules.filter(m => m.selected),
    [modules]
  );

  const selectedIds = useMemo(
    () => selectedModules.map(m => m.id),
    [selectedModules]
  );

  const isAnyLoading = useMemo(
    () => modules.some(m => m.status === 'loading'),
    [modules]
  );

  const completedCount = useMemo(
    () => modules.filter(m => m.status === 'completed').length,
    [modules]
  );

  const errorCount = useMemo(
    () => modules.filter(m => m.status === 'error').length,
    [modules]
  );

  const handleExecute = () => {
    if (selectedIds.length > 0 && !isAnyLoading) {
      onExecuteModules(selectedIds);
    }
  };

  const { data: promptTemplates, isLoading: isPromptsLoading } = useQuery({
    queryKey: queryKeys.modularAnalysis(graphId ?? ''),
    queryFn: async (): Promise<Record<string, string>> => {
      const response = (await api.prompts.list(graphId)) as PromptListResponse;
      const templates: Record<string, string> = {};
      // 优先级递增：system < user < graph，后者覆盖前者
      const merged = [
        ...(response.system ?? []),
        ...(response.user ?? []),
        ...(response.graph ?? []),
      ];
      for (const item of merged) {
        templates[item.code] = item.template_content;
      }
      return templates;
    },
    enabled: !!graphId && isOpen,
    ...defaultQueryConfig,
  });

  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);
  const titleId = useId();

  const handleSavePrompt = async (moduleId: AnalysisModuleId, content: string) => {
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    try {
      await api.prompts.save({
        code: scenarioId,
        scope: 'user',
        template_content: content,
      });
      await queryClient.invalidateQueries({ queryKey: ['modularAnalysis'] });
      message.success(t('graphMap.modularAnalysis.promptSaveSuccess'), { duration: 3000 });
      setEditingPromptModule(null);
    } catch (error) {
      message.error(t('graphMap.modularAnalysis.promptSaveFailed', { message: (error as Error).message }), { duration: 5000 });
      throw error;
    }
  };

  const getPromptContent = (moduleId: AnalysisModuleId): string => {
    if (promptContents && promptContents[moduleId]) {
      return promptContents[moduleId];
    }
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    if (promptTemplates?.[scenarioId]) {
      return promptTemplates[scenarioId];
    }
    const scenario = getScenarioById(scenarioId);
    return scenario?.defaultTemplate ?? '';
  };

  const getPromptVariables = (moduleId: AnalysisModuleId): string[] => {
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    const scenario = getScenarioById(scenarioId);
    return scenario?.variables || [];
  };

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
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              {t('graphMap.modularAnalysis.title')}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('graphMap.modularAnalysis.selectedPrefix')} <span className="font-medium text-gray-900 dark:text-white">{selectedModules.length}</span> {t('graphMap.modularAnalysis.selectedSuffix')}
                </span>
                {completedCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('graphMap.modularAnalysis.completedCount', { count: completedCount })}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    {t('graphMap.modularAnalysis.errorCount', { count: errorCount })}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  modules.forEach(m => {
                    if (!m.selected) onToggleModule(m.id);
                  });
                }}
                className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 text-xs"
              >
                {t('graphMap.modularAnalysis.selectAll')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {modules.map(module => (
                <AnalysisModuleCard
                  key={module.id}
                  module={module}
                  onToggle={() => onToggleModule(module.id)}
                  onViewResult={() => onViewResult(module.id)}
                  onEditPrompt={() => setEditingPromptModule(module.id)}
                  disabled={isAnyLoading}
                />
              ))}
            </div>

            {modules.length === 0 && (
              <EmptyState
                icon={<Layers size={32} />}
                title={t('graphMap.empty.modules')}
              />
            )}
          </div>

          <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isAnyLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('graphMap.modularAnalysis.analyzing')}
                </span>
              ) : selectedIds.length > 0 ? (
                <span>
                  {t('graphMap.modularAnalysis.aboutToExecute', { count: selectedIds.length })}
                </span>
              ) : (
                <span>{t('graphMap.modularAnalysis.selectAtLeastOne')}</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('graphMap.modularAnalysis.close')}
              </button>
              <button
                onClick={handleExecute}
                disabled={selectedIds.length === 0 || isAnyLoading}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isAnyLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('graphMap.modularAnalysis.analyzingButton')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('graphMap.modularAnalysis.startAnalysis')}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {editingPromptModule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal-overlay p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden">
            {isPromptsLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                {t('graphMap.modularAnalysis.promptLoading')}
              </div>
            ) : (
              <PromptEditor
                initialContent={getPromptContent(editingPromptModule)}
                variables={getPromptVariables(editingPromptModule)}
                onSave={(content) => handleSavePrompt(editingPromptModule, content)}
                onCancel={() => setEditingPromptModule(null)}
                title={t('graphMap.modularAnalysis.promptEditTitle', { name: t((modules.find(m => m.id === editingPromptModule)?.nameKey ?? '') as never) })}
              />
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
