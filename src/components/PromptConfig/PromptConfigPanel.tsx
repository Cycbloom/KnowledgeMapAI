import React, { useState, useEffect } from 'react';
import { X, Edit, Zap, Globe, User, Network, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { PromptEditor } from '../GraphEditor/panels/PromptEditor';
import { PROMPT_SCENARIOS, getScenarioById, type PromptScenario } from './promptScenarios';
import { useStore } from '../../store/useStore';
import { useMessageStore } from '../../store/useMessageStore';
import { api } from '../../services/api';

interface PromptTemplate {
  id: string;
  code: string;
  scope: 'system' | 'user' | 'graph';
  user_id?: string;
  graph_id?: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

interface PromptConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialScenarioId?: string;
  graphId?: string;
}

type TemplateScope = 'system' | 'user' | 'graph';

export const PromptConfigPanel: React.FC<PromptConfigPanelProps> = ({
  isOpen,
  onClose,
  initialScenarioId,
  graphId,
}) => {
  const { token } = useStore();
  const { addMessage } = useMessageStore();

  const [selectedScenario, setSelectedScenario] = useState<PromptScenario | null>(null);
  const [editingScope, setEditingScope] = useState<TemplateScope | null>(null);
  const [editedTemplate, setEditedTemplate] = useState('');
  const [templates, setTemplates] = useState<{
    system: PromptTemplate[];
    user: PromptTemplate[];
    graph: PromptTemplate[];
  }>({ system: [], user: [], graph: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [showScopeInfo, setShowScopeInfo] = useState(false);

  useEffect(() => {
    if (initialScenarioId) {
      const scenario = getScenarioById(initialScenarioId);
      if (scenario) {
        setSelectedScenario(scenario);
      }
    }
  }, [initialScenarioId]);

  useEffect(() => {
    if (isOpen && token) {
      loadTemplates();
    }
  }, [isOpen, token, graphId]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await api.prompts.list(graphId);
      setTemplates(result as { system: PromptTemplate[]; user: PromptTemplate[]; graph: PromptTemplate[] });
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTemplateContent = (code: string, scope: TemplateScope): string => {
    const templateList = templates[scope];
    const template = templateList.find((t) => t.code === code);
    return template?.template_content || '';
  };

  const getEffectiveTemplate = (code: string): { content: string; scope: TemplateScope } => {
    if (graphId) {
      const graphTemplate = getTemplateContent(code, 'graph');
      if (graphTemplate) {
        return { content: graphTemplate, scope: 'graph' };
      }
    }
    const userTemplate = getTemplateContent(code, 'user');
    if (userTemplate) {
      return { content: userTemplate, scope: 'user' };
    }
    const scenario = PROMPT_SCENARIOS.find((s) => s.id === code);
    return { content: scenario?.defaultTemplate || '', scope: 'system' };
  };

  useEffect(() => {
    if (selectedScenario && !editingScope) {
      const { content } = getEffectiveTemplate(selectedScenario.id);
      setEditedTemplate(content);
    }
  }, [selectedScenario, templates, editingScope]);

  const handleStartEdit = (scope: TemplateScope) => {
    if (!selectedScenario) return;
    const content = getTemplateContent(selectedScenario.id, scope);
    setEditedTemplate(content || selectedScenario.defaultTemplate);
    setEditingScope(scope);
  };

  const handleSave = async (content: string) => {
    if (!selectedScenario || !editingScope) return;

    try {
      if (editingScope === 'system') {
        addMessage({ type: 'error', content: '系统级模板不可修改' });
        return;
      }

      await api.prompts.save({
        code: selectedScenario.id,
        scope: editingScope,
        template_content: content,
        graph_id: editingScope === 'graph' ? graphId : undefined,
      });

      addMessage({ type: 'success', content: 'Prompt配置已保存' });
      setEditingScope(null);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to save prompt config:', error);
      addMessage({ type: 'error', content: '保存失败' });
    }
  };

  const handleCancel = () => {
    setEditingScope(null);
  };

  const handleResetToDefault = () => {
    if (!selectedScenario) return;
    setEditedTemplate(selectedScenario.defaultTemplate);
  };

  const handleDeleteTemplate = async (scope: TemplateScope) => {
    if (!selectedScenario) return;
    
    const template = templates[scope].find((t) => t.code === selectedScenario.id);
    if (!template) return;

    try {
      await api.prompts.reset(template.id);
      addMessage({ type: 'success', content: '已重置为默认模板' });
      await loadTemplates();
    } catch (error) {
      console.error('Failed to reset template:', error);
      addMessage({ type: 'error', content: '重置失败' });
    }
  };

  const getScopeLabel = (scope: TemplateScope) => {
    switch (scope) {
      case 'system':
        return '系统级';
      case 'user':
        return '用户级';
      case 'graph':
        return '图谱级';
    }
  };

  const getScopeDescription = (scope: TemplateScope) => {
    switch (scope) {
      case 'system':
        return '全局默认模板，所有用户共享';
      case 'user':
        return '您的个人模板，全局生效';
      case 'graph':
        return '当前图谱专用模板，优先级最高';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Prompt 模板配置
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              配置场景
            </h3>
            <div className="space-y-2">
              {PROMPT_SCENARIOS.map((scenario) => {
                const isSelected = selectedScenario?.id === scenario.id;
                const effective = getEffectiveTemplate(scenario.id);

                return (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setSelectedScenario(scenario);
                      setEditingScope(null);
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`p-1.5 rounded ${
                          isSelected
                            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {scenario.icon}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {scenario.name}
                      </span>
                      {effective.scope !== 'system' && (
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                          {getScopeLabel(effective.scope)}
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
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : editingScope ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-600 dark:text-purple-400">
                      {selectedScenario?.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {selectedScenario?.name} - {getScopeLabel(editingScope)}模板
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getScopeDescription(editingScope)}
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
                    variables={selectedScenario?.variables || []}
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
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-600 dark:text-purple-400">
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
                </div>

                <div className="mb-4">
                  <button
                    onClick={() => setShowScopeInfo(!showScopeInfo)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showScopeInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    模板优先级说明
                  </button>
                  {showScopeInfo && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                      <p className="mb-2">
                        模板按以下优先级生效：<strong>图谱级 {'>'} 用户级 {'>'} 系统级</strong>
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          <Network size={12} className="text-purple-500" />
                          <span><strong>图谱级</strong>：仅对当前图谱生效，优先级最高</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <User size={12} className="text-blue-500" />
                          <span><strong>用户级</strong>：对您的所有图谱生效</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Globe size={12} className="text-gray-500" />
                          <span><strong>系统级</strong>：全局默认模板，不可修改</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

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

                <div className="flex-1 overflow-y-auto space-y-4">
                  {graphId && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20">
                        <div className="flex items-center gap-2">
                          <Network size={16} className="text-purple-600 dark:text-purple-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            图谱级模板
                          </span>
                          <span className="text-xs text-purple-600 dark:text-purple-400">
                            最高优先级
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTemplateContent(selectedScenario.id, 'graph') && (
                            <button
                              onClick={() => handleDeleteTemplate('graph')}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              删除
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit('graph')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            <Edit size={12} />
                            {getTemplateContent(selectedScenario.id, 'graph') ? '编辑' : '创建'}
                          </button>
                        </div>
                      </div>
                      {getTemplateContent(selectedScenario.id, 'graph') && (
                        <div className="p-3 bg-white dark:bg-slate-900">
                          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                            {getTemplateContent(selectedScenario.id, 'graph')}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          用户级模板
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          全局生效
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTemplateContent(selectedScenario.id, 'user') && (
                          <button
                            onClick={() => handleDeleteTemplate('user')}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            删除
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit('user')}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Edit size={12} />
                          {getTemplateContent(selectedScenario.id, 'user') ? '编辑' : '创建'}
                        </button>
                      </div>
                    </div>
                    {getTemplateContent(selectedScenario.id, 'user') && (
                      <div className="p-3 bg-white dark:bg-slate-900">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                          {getTemplateContent(selectedScenario.id, 'user')}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden opacity-75">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-gray-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          系统级模板
                        </span>
                        <span className="text-xs text-gray-500">
                          默认模板
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">不可修改</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                        {selectedScenario.defaultTemplate}
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
      </div>
    </div>
  );
};
