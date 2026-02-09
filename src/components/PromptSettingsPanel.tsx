import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PromptEditor } from './PromptEditor';
import { Edit, RotateCcw } from 'lucide-react';

interface PromptSettingsPanelProps {
  graphId?: string;
  scope: 'user' | 'graph';
}

const PROMPT_NAME_MAP: Record<string, string> = {
  expand_knowledge: '知识扩展 (Expand Knowledge)',
  generate_cards: '生成卡片 (Generate Cards)',
  branch_suggestions: '分支建议 (Branch Suggestions)',
  generate_content: '内容生成 (Generate Content)',
  chat: 'AI 对话 (Chat)',
  text_to_graph: '文本转图谱 (Text to Graph)',
  recommend_connections: '推荐连线 (Recommend Connections)',
  tutor_chat: 'AI 助教 (Tutor Chat)',
  document_to_graph: '文档转图谱 (Document to Graph)',
  term_annotation: '术语标注 (Term Annotation)'
};

const SOURCE_NAME_MAP: Record<string, string> = {
  'Graph': '图谱专属',
  'User': '用户全局',
  'System': '系统默认'
};

export const PromptSettingsPanel: React.FC<PromptSettingsPanelProps> = ({ graphId, scope }) => {
  const [templates, setTemplates] = useState<any>({ system: [], user: [], graph: [] });
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.prompts.list(graphId);
      setTemplates(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [graphId, scope]);

  const getEffectiveTemplate = (code: string) => {
    // If scope is graph, check graph -> user -> system
    if (scope === 'graph') {
        const graphTemp = templates.graph.find((t: any) => t.code === code);
        if (graphTemp) return { ...graphTemp, source: 'Graph' };
    }
    
    // If scope is user (or fallback for graph), check user -> system
    const userTemp = templates.user.find((t: any) => t.code === code);
    if (userTemp) return { ...userTemp, source: 'User' };
    
    const sysTemp = templates.system.find((t: any) => t.code === code);
    return { ...sysTemp || {}, source: 'System' };
  };

  const handleSave = async (content: string) => {
    if (!editingCode) return;
    await api.prompts.save({
      code: editingCode,
      scope: scope,
      template_content: content,
      graph_id: scope === 'graph' ? graphId : undefined
    });
    setEditingCode(null);
    fetchTemplates();
  };
  
  const handleReset = async (code: string) => {
    const effective = getEffectiveTemplate(code);
    // Only allow reset if the current effective template matches the current scope
    // e.g. If we are in 'graph' scope, and effective source is 'Graph', we can reset.
    // If we are in 'user' scope, and effective source is 'User', we can reset.
    
    const canReset = (scope === 'graph' && effective.source === 'Graph') || 
                     (scope === 'user' && effective.source === 'User');

    if (canReset && effective.id) {
        if (confirm(`确定要重置回${scope === 'graph' ? '用户/系统默认' : '系统默认'}设置吗？`)) {
            await api.prompts.reset(effective.id);
            fetchTemplates();
        }
    }
  };

  const promptCodes = [
    'expand_knowledge', 'generate_cards', 'branch_suggestions', 
    'generate_content', 'chat', 'text_to_graph', 'recommend_connections', 'tutor_chat', 'document_to_graph',
    'term_annotation'
  ];
  
  // Variables mapping for suggestion chips
  const variableMap: Record<string, string[]> = {
    expand_knowledge: ['isRootOrCore', 'isLeaf', 'isRoot', 'topic'],
    generate_cards: ['count', 'context', 'allowedTypes', 'includesQA', 'includesChoice'],
    branch_suggestions: ['isRootOrCore', 'isLeaf', 'topic'],
    generate_content: ['topic', 'context', 'isRoot', 'isLeaf', 'isNormal'],
    chat: ['contextText'],
    text_to_graph: [],
    recommend_connections: ['node_title', 'node_content', 'existing_nodes_json'],
    tutor_chat: ['isGuided', 'currentNodeId', 'currentNodeTitle', 'currentNodeContent', 'existingNodes'],
    document_to_graph: [],
    term_annotation: []
  };

  if (editingCode) {
    const currentTemp = getEffectiveTemplate(editingCode);
    const displayName = PROMPT_NAME_MAP[editingCode] || editingCode;
    return (
      <div className="h-[600px]">
        <PromptEditor
          initialContent={currentTemp?.template_content || ''}
          variables={variableMap[editingCode] || []}
          onSave={handleSave}
          onCancel={() => setEditingCode(null)}
          title={`编辑: ${displayName} (${scope === 'graph' ? '图谱专用' : '用户全局'})`}
        />
      </div>
    );
  }

  if (loading) {
      return <div className="p-8 text-center text-gray-500">加载模板中...</div>;
  }

  return (
    <div className="space-y-4">
      {promptCodes.map(code => {
        const effective = getEffectiveTemplate(code);
        
        // Determine if we have customized at THIS scope
        const isCustomizedAtScope = (scope === 'graph' && effective.source === 'Graph') || 
                                    (scope === 'user' && effective.source === 'User');
        
        return (
          <div key={code} className="p-4 border rounded-lg flex items-center justify-between bg-white hover:border-indigo-300 transition-colors dark:bg-gray-800 dark:border-gray-700">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                {PROMPT_NAME_MAP[code] || code}
              </h4>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className={`px-2 py-0.5 rounded-full border ${
                  effective.source === 'Graph' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  effective.source === 'User' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-gray-50 text-gray-600 border-gray-200'
                }`}>
                  {SOURCE_NAME_MAP[effective.source] || effective.source}
                </span>
                {effective.updated_at && (
                    <span className="text-gray-400">更新于: {new Date(effective.updated_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isCustomizedAtScope && (
                <button 
                  onClick={() => handleReset(code)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="重置为默认"
                >
                  <RotateCcw size={18} />
                </button>
              )}
              <button 
                onClick={() => setEditingCode(code)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                title="自定义模板"
              >
                <Edit size={16} />
                {isCustomizedAtScope ? '编辑' : '自定义'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
