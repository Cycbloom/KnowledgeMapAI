import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, AIAction } from '../../../services/api';
import { PromptEditor } from './PromptEditor';
import { Edit, Trash2, Plus, Zap, Copy } from 'lucide-react';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { message } from '@/utils/messageHelper';

interface AIActionSettingsPanelProps {
  graphId?: string;
  scope: 'user' | 'graph';
}

const getActionModeText = (mode: string, t: (key: string) => string) => {
  const modes: Record<string, string> = {
    'show_result': t('aiAction.modes.showResult'),
    'update_node': t('aiAction.modes.updateNode'),
    'spawn_children': t('aiAction.modes.spawnChildren')
  };
  return modes[mode] || mode;
};

const getScopeText = (scope: string, t: (key: string) => string) => {
  const scopes: Record<string, string> = {
    'system': t('aiAction.scopes.system'),
    'user': t('aiAction.scopes.user'),
    'graph': t('aiAction.scopes.graph')
  };
  return scopes[scope] || scope;
};

export const AIActionSettingsPanel: React.FC<AIActionSettingsPanelProps> = ({ graphId, scope }) => {
  const { t } = useTranslation();
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAction, setEditingAction] = useState<Partial<AIAction> | null>(null);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const data = await api.aiActions.list(graphId);
      setActions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [graphId, scope]);

  const handleSave = async (content: string) => {
    if (!editingAction) return;
    
    const actionData = {
        ...editingAction,
        prompt_template: content,
        scope,
        graph_id: scope === 'graph' ? graphId : undefined
    };

    try {
        if (actionData.id) {
            await api.aiActions.update(actionData.id, actionData);
        } else {
            await api.aiActions.create(actionData);
        }
        setEditingAction(null);
        fetchActions();
    } catch (err) {
        console.error("Failed to save action", err);
        message.error(t('aiAction.saveFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (await asyncConfirm({
      title: t('common.confirm.confirmTitle'),
      message: t('aiAction.confirmDelete'),
      isDangerous: true,
    })) {
        await api.aiActions.delete(id);
        fetchActions();
    }
  };

  const startCreate = () => {
      setEditingAction({
          name: t('aiAction.newAction'),
          description: '',
          target_mode: 'show_result',
          scope,
          prompt_template: '{{nodeContent}}'
      });
  };

  const handleDuplicate = (action: AIAction) => {
      setEditingAction({
          ...action,
          id: undefined, // Clear ID to create new
          name: `${action.name} (${t('aiAction.copy')})`,
          scope, // Set to current scope
          graph_id: scope === 'graph' ? graphId : undefined,
          user_id: undefined // Let backend handle user_id
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('aiAction.title')}</h3>
        <button onClick={startCreate} className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700">
            <Plus size={16} className="mr-1"/> {t('aiAction.createAction')}
        </button>
      </div>

      {editingAction ? (
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
            <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">{t('aiAction.name')}</label>
                    <input 
                        value={editingAction.name} 
                        onChange={e => setEditingAction({...editingAction, name: e.target.value})}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        placeholder={t('aiAction.namePlaceholder')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{t('aiAction.mode')}</label>
                    <select 
                        value={editingAction.target_mode}
                        onChange={e => setEditingAction({...editingAction, target_mode: e.target.value as any})}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    >
                        {[('show_result'), ('update_node'), ('spawn_children')].map((k) => (
                            <option key={k} value={k}>{getActionModeText(k, t)}</option>
                        ))}
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">{t('aiAction.description')}</label>
                    <input 
                        value={editingAction.description || ''} 
                        onChange={e => setEditingAction({...editingAction, description: e.target.value})}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        placeholder={t('aiAction.descriptionPlaceholder')}
                    />
                </div>
                
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">{t('aiAction.contextVariables')}</label>
                    <div className="flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editingAction.variables?.includeParent || false}
                                onChange={e => setEditingAction({
                                    ...editingAction,
                                    variables: { ...editingAction.variables, includeParent: e.target.checked }
                                })}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm">{t('aiAction.includeParent')} ({'{{parents}}'})</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editingAction.variables?.includeSiblings || false}
                                onChange={e => setEditingAction({
                                    ...editingAction,
                                    variables: { ...editingAction.variables, includeSiblings: e.target.checked }
                                })}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm">{t('aiAction.includeSiblings')} ({'{{siblings}}'})</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editingAction.variables?.includeChildren || false}
                                onChange={e => setEditingAction({
                                    ...editingAction,
                                    variables: { ...editingAction.variables, includeChildren: e.target.checked }
                                })}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm">{t('aiAction.includeChildren')} ({'{{children}}'})</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div className="mb-2 text-sm font-medium">{t('aiAction.promptTemplate')}</div>
            <PromptEditor
                initialContent={editingAction.prompt_template || ''}
                onSave={handleSave}
                variables={['nodeTitle', 'nodeContent', 'userInputs', 'parents', 'children', 'siblings']}
                onCancel={() => { setEditingAction(null); }}
            />
        </div>
      ) : (
        <div className="grid gap-4">
            {actions.map(action => {
                const isEditable = action.scope === scope || (scope === 'graph' && action.scope === 'graph') || (scope === 'user' && action.scope === 'user');
                
                return (
                <div key={action.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800 flex justify-between items-center hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg mr-3">
                            <Zap size={20} className="text-primary-600 dark:text-primary-300"/>
                        </div>
                        <div>
                            <div className="font-medium flex items-center">
                                {action.name}
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                    action.scope === 'system' ? 'bg-gray-200 text-gray-700' :
                                    action.scope === 'user' ? 'bg-primary-100 text-primary-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                    {getScopeText(action.scope, t)}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500">{action.description || t('aiAction.noDescription')}</div>
                            <div className="text-xs text-gray-400 mt-1">{t('aiAction.mode')}: {getActionModeText(action.target_mode, t)}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isEditable ? (
                             <>
                                <button 
                                    onClick={() => setEditingAction(action)}
                                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                    title={t('aiAction.edit')}
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(action.id)}
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title={t('aiAction.delete')}
                                >
                                    <Trash2 size={18} />
                                </button>
                             </>
                        ) : (
                            <button 
                                onClick={() => handleDuplicate(action)}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title={t('aiAction.copyToCurrentLevel')}
                            >
                                <Copy size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )})}
            {actions.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed">
{t('aiAction.noActions')}
                </div>
            )}
        </div>
      )}
    </div>
  );
};
