import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Play, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { ModularAnalysisPanelProps, AnalysisModuleId } from './types';
import { AnalysisModuleCard } from './AnalysisModuleCard';
import { PromptEditor } from '../GraphEditor/panels/PromptEditor';
import { MODULE_TO_SCENARIO } from './types';
import { getScenarioById } from '../PromptConfig';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';

export const ModularAnalysisPanel: React.FC<ModularAnalysisPanelProps> = ({
  isOpen,
  onClose,
  modules,
  onToggleModule,
  onExecuteModules,
  onViewResult,
  onEditPrompt: _onEditPrompt,
  promptContents,
}) => {
  const [editingPromptModule, setEditingPromptModule] = useState<AnalysisModuleId | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<Record<string, string>>({});
  const { addMessage } = useMessageStore();
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

  const loadPromptTemplates = async () => {
    try {
      const response = await api.prompts.list();
      const templates: Record<string, string> = {};
      if (Array.isArray(response)) {
        response.forEach((item: { code: string; template_content: string }) => {
          templates[item.code] = item.template_content;
        });
      }
      setPromptTemplates(templates);
    } catch (error) {
      console.error('Failed to load prompt templates:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPromptTemplates();
    }
  }, [isOpen]);

  const handleSavePrompt = async (moduleId: AnalysisModuleId, content: string) => {
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    try {
      await api.prompts.save({
        code: scenarioId,
        scope: 'user',
        template_content: content,
      });
      setPromptTemplates(prev => ({
        ...prev,
        [scenarioId]: content,
      }));
      addMessage({
        type: 'success',
        content: '提示词保存成功',
        duration: 3000,
      });
      setEditingPromptModule(null);
    } catch (error) {
      addMessage({
        type: 'error',
        content: `保存失败: ${(error as Error).message}`,
        duration: 5000,
      });
      throw error;
    }
  };

  const getPromptContent = (moduleId: AnalysisModuleId): string => {
    if (promptContents && promptContents[moduleId]) {
      return promptContents[moduleId];
    }
    const scenarioId = MODULE_TO_SCENARIO[moduleId];
    if (promptTemplates[scenarioId]) {
      return promptTemplates[scenarioId];
    }
    const scenario = getScenarioById(scenarioId);
    return scenario?.defaultTemplate || '';
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              模块化分析
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
                  已选择 <span className="font-medium text-gray-900 dark:text-white">{selectedModules.length}</span> 个模块
                </span>
                {completedCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {completedCount} 已完成
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    {errorCount} 出错
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  modules.forEach(m => {
                    if (!m.selected) onToggleModule(m.id);
                  });
                }}
                className="text-purple-500 hover:text-purple-600 dark:hover:text-purple-400 text-xs"
              >
                全选
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
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  暂无可用的分析模块
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isAnyLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  正在分析中，请稍候...
                </span>
              ) : selectedIds.length > 0 ? (
                <span>
                  即将执行 {selectedIds.length} 个分析模块
                </span>
              ) : (
                <span>请选择至少一个分析模块</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                关闭
              </button>
              <button
                onClick={handleExecute}
                disabled={selectedIds.length === 0 || isAnyLoading}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isAnyLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    开始分析
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {editingPromptModule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden">
            <PromptEditor
              initialContent={getPromptContent(editingPromptModule)}
              variables={getPromptVariables(editingPromptModule)}
              onSave={(content) => handleSavePrompt(editingPromptModule, content)}
              onCancel={() => setEditingPromptModule(null)}
              title={`${modules.find(m => m.id === editingPromptModule)?.name} - 提示词编辑`}
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
