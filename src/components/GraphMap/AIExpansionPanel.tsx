import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles, Network, ChevronDown, ChevronUp, Check, Settings2, Layers, GitBranch, BookOpen, Briefcase, GraduationCap, PenTool, Link, Plus } from 'lucide-react';
import type { GraphRelationType, InfiniteExpansionProgress } from '../../types';

type ExpansionMode = 'depth' | 'width';
type DepthStyle = 'academic' | 'practical' | 'beginner' | 'custom';

interface AIExpansionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGraphId: string;
  sourceGraphTitle: string;
  sourceGraphDescription?: string;
  onDepthExpand: (config: {
    style: DepthStyle;
    customPrompt?: string;
    sources?: string[];
    depth: number;
  }) => Promise<{ root: any; coreNodes: any[] } | null>;
  onDepthExpandNode?: (config: {
    nodeId: string;
    nodeTitle: string;
    nodeContent?: string;
    nodeLevel?: string;
    style: DepthStyle;
    customPrompt?: string;
    existingChildren?: { title: string }[];
  }) => Promise<any[] | null>;
  onWidthExpand: (config: {
    max_depth: number;
    max_graphs_per_level: number;
    relation_types: GraphRelationType[];
    auto_generate_nodes: boolean;
    node_depth: number;
  }) => Promise<void>;
  progress?: InfiniteExpansionProgress | null;
  isRunning?: boolean;
  onEditPrompt?: (mode: ExpansionMode) => void;
  hasNodes?: boolean;
}

const styleOptions = [
  { 
    value: 'academic' as const, 
    label: '学术风格', 
    icon: GraduationCap, 
    details: '专业术语，理论框架'
  },
  { 
    value: 'practical' as const, 
    label: '实用风格', 
    icon: Briefcase, 
    details: '通俗易懂，实际应用'
  },
  { 
    value: 'beginner' as const, 
    label: '入门风格', 
    icon: BookOpen, 
    details: '简单易懂，循序渐进'
  },
  { 
    value: 'custom' as const, 
    label: '自定义', 
    icon: PenTool, 
    details: '自己编写生成规则'
  },
];

export const AIExpansionPanel: React.FC<AIExpansionPanelProps> = ({
  isOpen,
  onClose,
  sourceGraphId: _sourceGraphId,
  sourceGraphTitle,
  sourceGraphDescription: _sourceGraphDescription,
  onDepthExpand,
  onDepthExpandNode,
  onWidthExpand,
  progress,
  isRunning = false,
  onEditPrompt,
  hasNodes = false,
}) => {
  const [mode, setMode] = useState<ExpansionMode>(hasNodes ? 'width' : 'depth');

  const [depthStyle, setDepthStyle] = useState<DepthStyle>('academic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [depthLevel, setDepthLevel] = useState(2);

  const [maxDepth, setMaxDepth] = useState(2);
  const [maxGraphsPerLevel, setMaxGraphsPerLevel] = useState(3);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<GraphRelationType[]>(['prerequisite', 'extension', 'related']);
  const [autoGenerateNodes, setAutoGenerateNodes] = useState(true);
  const [nodeDepth, setNodeDepth] = useState(2);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [depthProgress, setDepthProgress] = useState<{
    status: 'idle' | 'init' | 'expanding' | 'completed';
    currentStep: string;
    nodesCreated: number;
    error?: string;
  }>({ status: 'idle', currentStep: '', nodesCreated: 0 });

  const relationTypeOptions: Array<{ value: GraphRelationType; label: string; color: string }> = [
    { value: 'prerequisite', label: '前置知识', color: 'bg-blue-500' },
    { value: 'extension', label: '扩展知识', color: 'bg-green-500' },
    { value: 'related', label: '相关知识', color: 'bg-amber-500' },
  ];

  const toggleRelationType = (type: GraphRelationType) => {
    setSelectedRelationTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleAddSource = () => {
    if (newSource.trim()) {
      setSources(prev => [...prev, newSource.trim()]);
      setNewSource('');
    }
  };

  const handleRemoveSource = (index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (mode === 'depth') {
        if (depthStyle === 'custom' && !customPrompt.trim()) {
          setIsSubmitting(false);
          return;
        }
        
        setDepthProgress({ status: 'init', currentStep: '正在初始化图谱...', nodesCreated: 0 });
        
        const result = await onDepthExpand({
          style: depthStyle,
          customPrompt: depthStyle === 'custom' ? customPrompt : undefined,
          sources: sources.length > 0 ? sources : undefined,
          depth: depthLevel,
        });
        
        if (result && onDepthExpandNode && depthLevel > 1) {
          setDepthProgress({ status: 'expanding', currentStep: '正在展开核心节点...', nodesCreated: result.coreNodes.length });
          
          for (const coreNode of result.coreNodes) {
            setDepthProgress(prev => ({ 
              ...prev, 
              currentStep: `正在展开「${coreNode.title}」...` 
            }));
            
            const children = await onDepthExpandNode({
              nodeId: coreNode.id || coreNode.title,
              nodeTitle: coreNode.title,
              nodeContent: coreNode.content,
              nodeLevel: 'core',
              style: depthStyle,
              customPrompt: depthStyle === 'custom' ? customPrompt : undefined,
              existingChildren: [],
            });
            
            if (children) {
              setDepthProgress(prev => ({ 
                ...prev, 
                nodesCreated: prev.nodesCreated + children.length 
              }));
            }
          }
        }
        
        setDepthProgress({ status: 'completed', currentStep: '完成', nodesCreated: result?.coreNodes.length || 0 });
      } else {
        if (selectedRelationTypes.length === 0) return;
        await onWidthExpand({
          max_depth: maxDepth,
          max_graphs_per_level: maxGraphsPerLevel,
          relation_types: selectedRelationTypes,
          auto_generate_nodes: autoGenerateNodes,
          node_depth: nodeDepth,
        });
      }
    } catch (error) {
      console.error('Failed to start expansion:', error);
      setDepthProgress(prev => ({ ...prev, status: 'idle', error: String(error) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isRunning && progress) {
      setIsSubmitting(false);
    }
  }, [isRunning, progress]);
  
  useEffect(() => {
    if (isOpen) {
      setDepthProgress({ status: 'idle', currentStep: '', nodesCreated: 0 });
    }
  }, [isOpen]);

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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 智能拓展
            </h2>
            <div className="flex items-center gap-2">
              {onEditPrompt && (
                <button
                  onClick={() => onEditPrompt(mode)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                  title="编辑提示词"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                <Network className="w-4 h-4" />
                <span className="font-medium">源图谱：</span>
                <span>{sourceGraphTitle}</span>
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                选择拓展方式，AI 将自动生成相关内容
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                拓展方式
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('depth')}
                  disabled={isRunning}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    mode === 'depth'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-gray-900 dark:text-white">深度拓展</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    生成图谱内的知识点
                  </p>
                </button>
                <button
                  onClick={() => setMode('width')}
                  disabled={isRunning}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    mode === 'width'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-gray-900 dark:text-white">宽度拓展</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    生成相关知识网络
                  </p>
                </button>
              </div>
            </div>

            {mode === 'depth' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    生成风格
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {styleOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setDepthStyle(option.value)}
                        disabled={isRunning}
                        className={`p-2 rounded-lg border-2 transition-all text-left ${
                          depthStyle === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{option.details}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {depthStyle === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      自定义生成规则
                    </label>
                    <textarea
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      disabled={isRunning}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                      placeholder="描述你希望如何生成知识点..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    参考来源（可选）
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSource}
                        onChange={e => setNewSource(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSource()}
                        disabled={isRunning}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                        placeholder="输入 URL 或文本..."
                      />
                      <button
                        onClick={handleAddSource}
                        disabled={isRunning || !newSource.trim()}
                        className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sources.map((source, index) => (
                          <div key={index} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-xs">
                            <Link className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{source}</span>
                            <button
                              onClick={() => handleRemoveSource(index)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    生成深度：{depthLevel} 层
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={depthLevel}
                    onChange={e => setDepthLevel(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>1 层</span>
                    <span>4 层</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {depthLevel === 1 && '生成根节点和核心节点，适合快速构建知识框架。'}
                    {depthLevel === 2 && '生成根节点、核心节点和一级子节点，适合中等详细程度的知识图谱。'}
                    {depthLevel === 3 && '生成根节点、核心节点和两级子节点，适合详细的知识图谱。'}
                    {depthLevel === 4 && '生成根节点、核心节点和三级子节点，适合非常详细的知识图谱，内容最丰富。'}
                  </p>
                </div>

                {depthProgress.status !== 'idle' && (
                  <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      {depthProgress.status === 'completed' ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                      )}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {depthProgress.status === 'completed' ? '生成完成' : depthProgress.currentStep}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      已创建 {depthProgress.nodesCreated} 个知识点
                    </div>
                    {depthProgress.error && (
                      <div className="text-sm text-red-500 mt-1">{depthProgress.error}</div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {mode === 'width' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    关系类型
                  </label>
                  <div className="flex gap-2">
                    {relationTypeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleRelationType(option.value)}
                        disabled={isRunning}
                        className={`flex-1 p-2 rounded-lg border-2 transition-all text-center ${
                          selectedRelationTypes.includes(option.value)
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
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
                    扩展深度：{maxDepth} 层
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={e => setMaxDepth(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full h-2 bg-emerald-200 dark:bg-emerald-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>1 层</span>
                    <span>5 层</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  高级选项
                </button>

                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        每层最大图谱数：{maxGraphsPerLevel}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={maxGraphsPerLevel}
                        onChange={e => setMaxGraphsPerLevel(Number(e.target.value))}
                        disabled={isRunning}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <input
                        type="checkbox"
                        id="autoGenerateNodes"
                        checked={autoGenerateNodes}
                        onChange={e => setAutoGenerateNodes(e.target.checked)}
                        disabled={isRunning}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="autoGenerateNodes" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span>自动生成图谱内的知识点</span>
                      </label>
                    </div>

                    {autoGenerateNodes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          知识点深度：{nodeDepth} 层
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          value={nodeDepth}
                          onChange={e => setNodeDepth(Number(e.target.value))}
                          disabled={isRunning}
                          className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {maxDepth === 1 && '创建与当前图谱直接相关的知识图谱，适合快速扩展知识网络。'}
                    {maxDepth === 2 && '创建两层相关知识图谱，适合中等规模的知识网络扩展。'}
                    {maxDepth === 3 && '创建三层相关知识图谱，适合较大规模的知识网络扩展。'}
                    {maxDepth === 4 && '创建四层相关知识图谱，适合大规模的知识网络扩展。'}
                    {maxDepth === 5 && '创建五层相关知识图谱，适合最大规模的知识网络扩展，覆盖面最广。'}
                  </p>
                  {autoGenerateNodes && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                      同时为每个新图谱生成 {nodeDepth} 层深度的知识点。
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {(isRunning || isSubmitting) && progress && (
              <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    正在拓展...
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>当前深度</span>
                    <span>{progress.current_depth} / {maxDepth}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>已创建图谱</span>
                    <span>{progress.total_graphs_created}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>已创建知识点</span>
                    <span>{progress.total_nodes_created}</span>
                  </div>
                  {progress.current_graph_title && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      正在处理：{progress.current_graph_title}
                    </div>
                  )}
                </div>

                {progress.created_graphs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      已创建的图谱
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {progress.created_graphs.slice(-5).map((g, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            g.relation_type === 'prerequisite' ? 'bg-blue-500' :
                            g.relation_type === 'extension' ? 'bg-green-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{g.title}</span>
                          <span className="text-gray-400">({g.node_count ?? 0} 节点)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {progress?.status === 'completed' && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">拓展完成！</span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  共创建 {progress.total_graphs_created} 个图谱，{progress.total_nodes_created} 个知识点
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 sticky bottom-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {progress?.status === 'completed' ? '关闭' : '取消'}
            </button>
            {progress?.status !== 'completed' && progress?.status !== 'running' && (
              <button
                onClick={handleSubmit}
                disabled={(mode === 'depth' && depthStyle === 'custom' && !customPrompt.trim()) || (mode === 'width' && selectedRelationTypes.length === 0) || isSubmitting || isRunning}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    启动中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    开始拓展
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
