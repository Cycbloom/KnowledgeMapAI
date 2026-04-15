import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { PromptEditor } from './PromptEditor';
import { Edit, RotateCcw, Network, Layers, MessageSquare, Wrench, ChevronDown, LayoutTemplate } from 'lucide-react';

interface PromptSettingsPanelProps {
  graphId?: string;
  scope: 'user' | 'graph';
}

const PROMPT_NAME_MAP: Record<string, string> = {
  expand_knowledge: '知识扩展 (Expand Knowledge)',
  generate_cards: '生成卡片 (Generate Cards - Generic)',
  generate_cards_qa: '生成卡片: 问答 (Generate QA)',
  generate_cards_choice: '生成卡片: 单选 (Generate Choice)',
  generate_cards_true_false: '生成卡片: 判断 (Generate True/False)',
  generate_cards_multi_choice: '生成卡片: 多选 (Generate Multi-Choice)',
  generate_cards_fill_blank: '生成卡片: 填空 (Generate Fill-Blank)',
  generate_cards_essay: '生成卡片: 问答/论述 (Generate Essay)',
  branch_suggestions: '分支建议 (Branch Suggestions)',
  generate_content: '内容生成 (Generate Content)',
  chat: 'AI 对话 (Chat)',
  text_to_graph: '文本转图谱 (Text to Graph)',
  recommend_connections: '推荐连线 (Recommend Connections)',
  tutor_chat: 'AI 助教 (Tutor Chat)',
  document_to_graph: '文档转图谱 (Document to Graph)',
  term_annotation: '术语标注 (Term Annotation)',
  infinite_graph_expansion: '无限扩展知识网络 (Infinite Graph Expansion)',
  auto_graph_init: '图谱初始化 (Auto Graph Init)',
  auto_graph_expand: '节点展开 (Auto Graph Expand)',
  generate_task_details: '任务详情生成 (Generate Task Details)',
  template_generation: '模板生成 (Template Generation)',
  template_type_knowledge_tree: '模板: 知识树 (Knowledge Tree)',
  template_type_skill_map: '模板: 技能图谱 (Skill Map)',
  template_type_concept_network: '模板: 概念网络 (Concept Network)',
  template_type_learning_path: '模板: 学习路径 (Learning Path)',
  template_type_topic_research: '模板: 专题研究 (Topic Research)',
  template_type_project_lifecycle: '模板: 项目生命周期 (Project Lifecycle)',
  template_type_dev_workflow: '模板: 开发流程 (Dev Workflow)',
  template_type_task_breakdown: '模板: 任务分解 (Task Breakdown)',
  template_type_sprint_planning: '模板: 迭代规划 (Sprint Planning)',
  template_type_root_cause: '模板: 根因分析 (Root Cause Analysis)',
  template_type_swot: '模板: SWOT 分析 (SWOT Analysis)',
  template_type_comparison: '模板: 对比分析 (Comparison)',
  template_type_decision_tree: '模板: 决策树 (Decision Tree)',
  template_type_tech_ecosystem: '模板: 技术生态 (Tech Ecosystem)',
  template_type_org_structure: '模板: 组织架构 (Org Structure)',
  template_type_system_architecture: '模板: 系统架构 (System Architecture)',
  template_type_knowledge_system: '模板: 知识体系 (Knowledge System)',
  template_type_blank: '模板: 空白图谱 (Blank Graph)',
};

const SOURCE_NAME_MAP: Record<string, string> = {
  'Graph': '图谱专属',
  'User': '用户全局',
  'System': '系统默认'
};

const PROMPT_CATEGORIES = [
  {
    id: 'graph_building',
    name: '知识图谱构建',
    icon: Network,
    color: 'emerald',
    codes: ['expand_knowledge', 'branch_suggestions', 'recommend_connections', 'text_to_graph', 'document_to_graph', 'infinite_graph_expansion', 'auto_graph_init', 'auto_graph_expand']
  },
  {
    id: 'card_generation',
    name: '卡片生成',
    icon: Layers,
    color: 'violet',
    codes: ['generate_cards', 'generate_cards_qa', 'generate_cards_choice', 'generate_cards_true_false', 
            'generate_cards_multi_choice', 'generate_cards_fill_blank', 'generate_cards_essay']
  },
  {
    id: 'ai_chat',
    name: 'AI 对话',
    icon: MessageSquare,
    color: 'amber',
    codes: ['chat', 'tutor_chat', 'generate_content']
  },
  {
    id: 'task_scheduler',
    name: '任务调度',
    icon: Wrench,
    color: 'cyan',
    codes: ['generate_task_details']
  },
  {
    id: 'template_generation',
    name: '模板生成',
    icon: LayoutTemplate,
    color: 'rose',
    codes: ['template_generation', 'template_type_knowledge_tree', 'template_type_skill_map', 'template_type_concept_network', 'template_type_learning_path', 'template_type_topic_research', 'template_type_project_lifecycle', 'template_type_dev_workflow', 'template_type_task_breakdown', 'template_type_sprint_planning', 'template_type_root_cause', 'template_type_swot', 'template_type_comparison', 'template_type_decision_tree', 'template_type_tech_ecosystem', 'template_type_org_structure', 'template_type_system_architecture', 'template_type_knowledge_system', 'template_type_blank']
  },
  {
    id: 'other',
    name: '其他工具',
    icon: Wrench,
    color: 'slate',
    codes: ['term_annotation']
  }
];

const CATEGORY_COLOR_MAP: Record<string, { bg: string; bgHover: string; icon: string; border: string }> = {
  emerald: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-900/30',
    bgHover: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-700'
  },
  violet: {
    bg: 'bg-violet-50/70 dark:bg-violet-900/30',
    bgHover: 'hover:bg-violet-100/80 dark:hover:bg-violet-900/50',
    icon: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-700'
  },
  amber: {
    bg: 'bg-amber-50/70 dark:bg-amber-900/30',
    bgHover: 'hover:bg-amber-100/80 dark:hover:bg-amber-900/50',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-700'
  },
  cyan: {
    bg: 'bg-cyan-50/70 dark:bg-cyan-900/30',
    bgHover: 'hover:bg-cyan-100/80 dark:hover:bg-cyan-900/50',
    icon: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-700'
  },
  rose: {
    bg: 'bg-rose-50/70 dark:bg-rose-900/30',
    bgHover: 'hover:bg-rose-100/80 dark:hover:bg-rose-900/50',
    icon: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-700'
  },
  slate: {
    bg: 'bg-slate-50/70 dark:bg-slate-900/30',
    bgHover: 'hover:bg-slate-100/80 dark:hover:bg-slate-900/50',
    icon: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700'
  }
};

export const PromptSettingsPanel: React.FC<PromptSettingsPanelProps> = ({ graphId, scope }) => {
  const [templates, setTemplates] = useState<any>({ system: [], user: [], graph: [] });
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      scope,
      template_content: content,
      graph_id: scope === 'graph' ? graphId : undefined
    });
    setEditingCode(null);
    fetchTemplates();
  };
  
  const handleReset = async (code: string) => {
    const effective = getEffectiveTemplate(code);
    const canReset = (scope === 'graph' && effective.source === 'Graph') || 
                     (scope === 'user' && effective.source === 'User');

    if (canReset && effective.id) {
        if (confirm(`确定要重置回${scope === 'graph' ? '用户/系统默认' : '系统默认'}设置吗？`)) {
            await api.prompts.reset(effective.id);
            fetchTemplates();
        }
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

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
    term_annotation: [],
    infinite_graph_expansion: ['domainTitle', 'domainDescription', 'maxGraphsPerLevel'],
    auto_graph_init: ['topic', 'isCustom', 'customPrompt', 'isAcademic', 'isPractical', 'isBeginner', 'hasSources', 'sources'],
    auto_graph_expand: ['nodeTitle', 'nodeContent', 'nodeLevel', 'isCustom', 'customPrompt', 'isAcademic', 'isPractical', 'isBeginner', 'existingChildren']
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
    <div className="space-y-3">
      {PROMPT_CATEGORIES.map(category => {
        const isExpanded = expandedCategories.has(category.id);
        const IconComponent = category.icon;
        const colorStyle = CATEGORY_COLOR_MAP[category.color] || CATEGORY_COLOR_MAP.emerald;
        
        return (
          <div key={category.id} className={`border rounded-lg overflow-hidden transition-all duration-300 ${colorStyle.border}`}>
            <button
              onClick={() => toggleCategory(category.id)}
              className={`w-full flex items-center justify-between p-4 transition-all duration-200 ${colorStyle.bg} ${colorStyle.bgHover}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/50 dark:bg-black/20 ${colorStyle.icon}`}>
                  <IconComponent size={18} />
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({category.codes.length})</span>
              </div>
              <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown size={20} className="text-gray-500" />
              </div>
            </button>
            
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="divide-y dark:divide-gray-700">
                {category.codes.map(code => {
                  const effective = getEffectiveTemplate(code);
                  const isCustomizedAtScope = (scope === 'graph' && effective.source === 'Graph') || 
                                              (scope === 'user' && effective.source === 'User');
                  
                  return (
                    <div key={code} className="p-4 flex items-center justify-between bg-white/80 hover:bg-gray-50/80 transition-colors dark:bg-gray-800/80 dark:hover:bg-gray-750/80">
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
            </div>
          </div>
        );
      })}
    </div>
  );
};
