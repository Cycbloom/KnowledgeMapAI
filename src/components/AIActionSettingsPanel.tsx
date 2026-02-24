import React, { useState, useEffect } from 'react';
import { api, AIAction } from '../services/api';
import { PromptEditor } from './PromptEditor';
import { Edit, Trash2, Plus, Zap, Copy } from 'lucide-react';

interface AIActionSettingsPanelProps {
  graphId?: string;
  scope: 'user' | 'graph';
}

const ACTION_MODE_MAP: Record<string, string> = {
  'show_result': '显示结果 (Show Result)',
  'update_node': '更新节点 (Update Node)',
  'spawn_children': '生成子节点 (Spawn Children)'
};

const SCOPE_MAP: Record<string, string> = {
  'system': '系统 (System)',
  'user': '用户 (User)',
  'graph': '图谱 (Graph)'
};

export const AIActionSettingsPanel: React.FC<AIActionSettingsPanelProps> = ({ graphId, scope }) => {
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAction, setEditingAction] = useState<Partial<AIAction> | null>(null);
  const [_isCreating, setIsCreating] = useState(false);

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
        setIsCreating(false);
        fetchActions();
    } catch (err) {
        console.error("Failed to save action", err);
        alert("保存失败");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个动作吗？')) {
        await api.aiActions.delete(id);
        fetchActions();
    }
  };

  const startCreate = () => {
      setEditingAction({
          name: '新动作',
          description: '',
          target_mode: 'show_result',
          scope,
          prompt_template: '{{nodeContent}}'
      });
      setIsCreating(true);
  };

  const handleDuplicate = (action: AIAction) => {
      setEditingAction({
          ...action,
          id: undefined, // Clear ID to create new
          name: `${action.name} (副本)`,
          scope, // Set to current scope
          graph_id: scope === 'graph' ? graphId : undefined,
          user_id: undefined // Let backend handle user_id
      });
      setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">自定义 AI 动作</h3>
        <button onClick={startCreate} className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
            <Plus size={16} className="mr-1"/> 新建动作
        </button>
      </div>

      {editingAction ? (
        <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
            <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">名称</label>
                    <input 
                        value={editingAction.name} 
                        onChange={e => setEditingAction({...editingAction, name: e.target.value})}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        placeholder="例如：润色内容"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">模式</label>
                    <select 
                        value={editingAction.target_mode}
                        onChange={e => setEditingAction({...editingAction, target_mode: e.target.value as any})}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    >
                        {Object.entries(ACTION_MODE_MAP).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">描述</label>
                    <input 
                        value={editingAction.description || ''} 
                        onChange={e => setEditingAction({...editingAction, description: e.target.value})}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        placeholder="描述该动作的功能..."
                    />
                </div>
                
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">上下文变量配置</label>
                    <div className="flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-700">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editingAction.variables?.includeParent || false}
                                onChange={e => setEditingAction({
                                    ...editingAction,
                                    variables: { ...editingAction.variables, includeParent: e.target.checked }
                                })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">包含父节点 ({'{{parents}}'})</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editingAction.variables?.includeSiblings || false}
                                onChange={e => setEditingAction({
                                    ...editingAction,
                                    variables: { ...editingAction.variables, includeSiblings: e.target.checked }
                                })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">包含兄弟节点 ({'{{siblings}}'})</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={editingAction.variables?.includeChildren || false}
                                onChange={e => setEditingAction({
                                    ...editingAction,
                                    variables: { ...editingAction.variables, includeChildren: e.target.checked }
                                })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">包含子节点 ({'{{children}}'})</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div className="mb-2 text-sm font-medium">提示词模板</div>
            <PromptEditor
                initialContent={editingAction.prompt_template || ''}
                onSave={handleSave}
                variables={['nodeTitle', 'nodeContent', 'userInputs', 'parents', 'children', 'siblings']}
                onCancel={() => { setEditingAction(null); setIsCreating(false); }}
            />
        </div>
      ) : (
        <div className="grid gap-4">
            {actions.map(action => {
                const isEditable = action.scope === scope || (scope === 'graph' && action.scope === 'graph') || (scope === 'user' && action.scope === 'user');
                
                return (
                <div key={action.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800 flex justify-between items-center hover:shadow-md transition-shadow">
                    <div className="flex items-start">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg mr-3">
                            <Zap size={20} className="text-purple-600 dark:text-purple-300"/>
                        </div>
                        <div>
                            <div className="font-medium flex items-center">
                                {action.name}
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                    action.scope === 'system' ? 'bg-gray-200 text-gray-700' :
                                    action.scope === 'user' ? 'bg-blue-100 text-blue-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                    {SCOPE_MAP[action.scope]}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500">{action.description || '无描述'}</div>
                            <div className="text-xs text-gray-400 mt-1">模式: {ACTION_MODE_MAP[action.target_mode]}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isEditable ? (
                             <>
                                <button 
                                    onClick={() => setEditingAction(action)}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="编辑"
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(action.id)}
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="删除"
                                >
                                    <Trash2 size={18} />
                                </button>
                             </>
                        ) : (
                            <button 
                                onClick={() => handleDuplicate(action)}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="复制到当前层级并编辑"
                            >
                                <Copy size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )})}
            {actions.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed">
                    暂无自定义动作，点击右上角新建
                </div>
            )}
        </div>
      )}
    </div>
  );
};
