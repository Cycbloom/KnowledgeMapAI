import React, { useState, useEffect } from 'react';
import { Edit, Zap } from 'lucide-react';
import { PromptEditor } from '../GraphEditor/panels/PromptEditor';
import { PROMPT_SCENARIOS, getScenarioById, type PromptScenario } from './promptScenarios';
import { useUpdateProfileMutation } from '../../hooks/mutations';
import { useUser } from '../../hooks/queries';
import { useStore } from '../../store/useStore';
import { message } from "../../utils/messageHelper";

interface PromptConfigContentProps {
  initialScenarioId?: string;
}

export const PromptConfigContent: React.FC<PromptConfigContentProps> = ({
  initialScenarioId,
}) => {
  const { token } = useStore();
  const { data: userData } = useUser(!!token);
  const updateProfileMutation = useUpdateProfileMutation();

  const [selectedScenario, setSelectedScenario] = useState<PromptScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<PromptScenario | null>(null);
  const [editedTemplate, setEditedTemplate] = useState('');

  const profile = userData?.user?.profile;
  const settings = profile?.settings as { prompt_configs?: Record<string, string> } | undefined;
  const promptConfigs = settings?.prompt_configs || {};

  useEffect(() => {
    if (initialScenarioId) {
      const scenario = getScenarioById(initialScenarioId);
      if (scenario) {
        setSelectedScenario(scenario);
      }
    }
  }, [initialScenarioId]);

  useEffect(() => {
    if (selectedScenario && !editingScenario) {
      const savedTemplate = promptConfigs[selectedScenario.id];
      if (savedTemplate) {
        setEditedTemplate(savedTemplate);
      } else {
        setEditedTemplate(selectedScenario.defaultTemplate);
      }
    }
  }, [selectedScenario, promptConfigs, editingScenario]);

  const handleStartEdit = (scenario: PromptScenario) => {
    const savedTemplate = promptConfigs[scenario.id];
    setEditedTemplate(savedTemplate || scenario.defaultTemplate);
    setEditingScenario(scenario);
  };

  const handleSave = async (content: string) => {
    if (!editingScenario) return;

    try {
      const newPromptConfigs = {
        ...promptConfigs,
        [editingScenario.id]: content,
      };

      await updateProfileMutation.mutateAsync({
        settings: {
          ...settings,
          prompt_configs: newPromptConfigs,
        },
      });

      message.success('Prompt配置已保存');
      setEditingScenario(null);
    } catch (error) {
      console.error('Failed to save prompt config:', error);
      message.error('保存失败');
    }
  };

  const handleCancel = () => {
    setEditingScenario(null);
  };

  const handleResetToDefault = () => {
    if (!editingScenario) return;
    setEditedTemplate(editingScenario.defaultTemplate);
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          配置场景
        </h3>
        <div className="space-y-2">
          {PROMPT_SCENARIOS.map((scenario) => {
            const isSelected = selectedScenario?.id === scenario.id;
            const hasCustomConfig = !!promptConfigs[scenario.id];

            return (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`p-1.5 rounded ${
                      isSelected
                        ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {scenario.icon}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {scenario.name}
                  </span>
                  {hasCustomConfig && (
                    <span className="ml-auto text-xs text-primary-600 dark:text-primary-400">
                      已配置
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  {scenario.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {editingScenario ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded text-primary-600 dark:text-primary-400">
                  {editingScenario.icon}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {editingScenario.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {editingScenario.description}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetToDefault}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                重置为默认
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <PromptEditor
                initialContent={editedTemplate}
                variables={editingScenario.variables}
                onSave={handleSave}
                onCancel={handleCancel}
                title=""
              />
            </div>
          </div>
        ) : selectedScenario ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded text-primary-600 dark:text-primary-400">
                  {selectedScenario.icon}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {selectedScenario.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedScenario.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleStartEdit(selectedScenario)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Edit size={16} />
                编辑
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  可用变量
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedScenario.variables.map((variable) => (
                    <span
                      key={variable}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-300"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  当前模板
                </h4>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                    {promptConfigs[selectedScenario.id] || selectedScenario.defaultTemplate}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>请从左侧选择一个配置场景</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
