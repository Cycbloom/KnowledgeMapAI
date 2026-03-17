import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Check,
  BookOpen,
  Briefcase,
  GraduationCap,
  Layers,
  ChevronRight,
  X,
  PenTool,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler, useIsMobile } from "../../hooks";
import { useTopicCheck } from "../../hooks";

interface AutoGraphGeneratorProps {
  graphId?: string;
  onGraphGenerated?: (nodes: any[], edges: any[]) => void;
  onClose?: () => void;
}

interface GeneratedNode {
  title: string;
  content: string;
  level?: string;
}

interface TreeNode extends GeneratedNode {
  id: string;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

const styleOptions = [
  { 
    value: 'academic', 
    label: '学术风格', 
    icon: GraduationCap, 
    details: '专业术语，理论框架'
  },
  { 
    value: 'practical', 
    label: '实用风格', 
    icon: Briefcase, 
    details: '通俗易懂，实际应用'
  },
  { 
    value: 'beginner', 
    label: '入门风格', 
    icon: BookOpen, 
    details: '简单易懂，循序渐进'
  },
  { 
    value: 'custom', 
    label: '自定义', 
    icon: PenTool, 
    details: '自己编写生成规则'
  },
];

const getLevelColor = (level?: string) => {
  switch (level) {
    case 'root': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
    case 'core': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300';
    case 'sub': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300';
    case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
    case 'leaf': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
  }
};

const getNextLevel = (currentLevel?: string): string => {
  switch (currentLevel) {
    case 'root': return 'core';
    case 'core': return 'sub';
    case 'sub': return 'normal';
    case 'normal': return 'leaf';
    default: return 'leaf';
  }
};

let nodeIdCounter = 0;
const generateNodeId = () => `node-${++nodeIdCounter}`;

interface NodeItemProps {
  node: TreeNode;
  depth: number;
  style: 'academic' | 'practical' | 'beginner' | 'custom';
  graphId?: string;
  isMobile?: boolean;
  onExpand: (nodeId: string) => Promise<TreeNode[] | null>;
  onNodeUpdate: (nodeId: string, updates: Partial<TreeNode>) => void;
}

const NodeItem: React.FC<NodeItemProps> = ({ 
  node, 
  depth, 
  style, 
  graphId,
  isMobile,
  onExpand,
  onNodeUpdate 
}) => {
  const [isExpanding, setIsExpanding] = useState(false);

  const handleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isLoading || isExpanding) return;
    
    setIsExpanding(true);
    onNodeUpdate(node.id, { isLoading: true });
    
    try {
      const children = await onExpand(node.id);
      if (children && children.length > 0) {
        onNodeUpdate(node.id, { 
          children, 
          isExpanded: true,
          isLoading: false 
        });
      } else {
        onNodeUpdate(node.id, { isLoading: false });
      }
    } catch (error) {
      onNodeUpdate(node.id, { isLoading: false });
    } finally {
      setIsExpanding(false);
    }
  };

  const toggleExpand = () => {
    onNodeUpdate(node.id, { isExpanded: !node.isExpanded });
  };

  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * (isMobile ? 12 : 16);

  return (
    <div className="node-item">
      <div 
        className={`${isMobile ? 'p-2' : 'p-3'} rounded-lg border cursor-pointer hover:shadow-sm transition-all ${getLevelColor(node.level)}`}
        style={{ marginLeft: `${indent}px` }}
        onClick={toggleExpand}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className={`font-medium truncate ${isMobile ? 'text-sm' : ''}`}>{node.title}</div>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} mt-1 opacity-70 line-clamp-1`}>{node.content}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleExpand}
              disabled={node.isLoading || isExpanding}
              className={`${isMobile ? 'p-1' : 'p-1.5'} bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors`}
              title="AI 展开此节点"
            >
              {node.isLoading || isExpanding ? (
                <Loader2 size={isMobile ? 12 : 14} className="animate-spin" />
              ) : (
                <Sparkles size={isMobile ? 12 : 14} />
              )}
            </button>
            {hasChildren && (
              <ChevronRight 
                size={isMobile ? 14 : 16} 
                className={`transition-transform ${node.isExpanded ? 'rotate-90' : ''}`} 
              />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {node.isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="children-container"
          >
            {node.children!.map((child) => (
              <NodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                style={style}
                graphId={graphId}
                isMobile={isMobile}
                onExpand={onExpand}
                onNodeUpdate={onNodeUpdate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AutoGraphGenerator: React.FC<AutoGraphGeneratorProps> = ({
  graphId,
  onGraphGenerated,
  onClose
}) => {
  const { isMobile } = useIsMobile();
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<'academic' | 'practical' | 'beginner' | 'custom'>('academic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  
  const [rootNode, setRootNode] = useState<TreeNode | null>(null);
  const [createdGraphId, setCreatedGraphId] = useState<string | null>(null);
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const { isChecking, isDuplicate, similarGraphs, checkTopic, reset: resetTopicCheck } = useTopicCheck({ 
    debounceMs: 500,
    excludeGraphId: graphId 
  });

  useEffect(() => {
    if (topic.trim().length >= 2 && !graphId) {
      checkTopic(topic);
    } else {
      resetTopicCheck();
    }
  }, [topic, checkTopic, resetTopicCheck, graphId]);

  const handleAddSource = useCallback(() => {
    if (newSource.trim()) {
      setSources(prev => [...prev, newSource.trim()]);
      setNewSource('');
    }
  }, [newSource]);

  const handleRemoveSource = useCallback((index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleInitialize = useCallback(async () => {
    if (!topic.trim()) {
      addMessage({ type: 'warning', content: '请输入主题' });
      return;
    }

    if (!graphId && isDuplicate) {
      addMessage({ type: 'warning', content: '主题重复，请修改主题名称' });
      return;
    }

    if (style === 'custom' && !customPrompt.trim()) {
      addMessage({ type: 'warning', content: '请输入自定义生成规则' });
      return;
    }

    setIsInitializing(true);
    setRootNode(null);
    nodeIdCounter = 0;

    try {
      const result = await api.autoGraph.init({
        topic,
        style,
        customPrompt: style === 'custom' ? customPrompt : undefined,
        sources: sources.length > 0 ? sources : undefined,
        graph_id: graphId
      });

      const root: TreeNode = {
        id: generateNodeId(),
        title: result.root.title,
        content: result.root.content,
        level: 'root',
        children: result.coreNodes.map((n: any) => ({
          id: generateNodeId(),
          title: n.title,
          content: n.content,
          level: 'core',
          children: [],
          isExpanded: false
        })),
        isExpanded: true
      };

      setRootNode(root);
      setIsInputCollapsed(true);
      addMessage({ type: 'success', content: '知识图谱初始化成功！点击 ✨ 展开节点' });

    } catch (error) {
      handleError(error, { context: 'AutoGraphInit', fallbackMessage: '初始化失败' });
    } finally {
      setIsInitializing(false);
    }
  }, [topic, style, sources, graphId, addMessage, handleError, isDuplicate]);

  const handleExpandNode = useCallback(async (nodeId: string, node: TreeNode): Promise<TreeNode[] | null> => {
    try {
      const result = await api.autoGraph.expand({
        node_id: nodeId,
        node_title: node.title,
        node_content: node.content,
        node_level: node.level,
        graph_id: createdGraphId || graphId || 'temp',
        style,
        customPrompt: style === 'custom' ? customPrompt : undefined,
        existing_children: node.children?.map(c => ({ title: c.title }))
      });

      const childLevel = getNextLevel(node.level);
      return result.children.map((n: any) => ({
        id: generateNodeId(),
        title: n.title,
        content: n.content,
        level: childLevel,
        children: [],
        isExpanded: false
      }));

    } catch (error) {
      handleError(error, { context: 'ExpandNode', fallbackMessage: '展开失败' });
      return null;
    }
  }, [createdGraphId, graphId, style, customPrompt, handleError]);

  const updateNodeInTree = useCallback((node: TreeNode, nodeId: string, updates: Partial<TreeNode>): TreeNode => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => updateNodeInTree(child, nodeId, updates))
      };
    }
    return node;
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<TreeNode>) => {
    setRootNode(prev => {
      if (!prev) return prev;
      return updateNodeInTree(prev, nodeId, updates);
    });
  }, [updateNodeInTree]);

  const hasAnyNodeLoading = useCallback((node: TreeNode): boolean => {
    if (node.isLoading) return true;
    if (node.children) {
      return node.children.some(child => hasAnyNodeLoading(child));
    }
    return false;
  }, []);

  const handleExpandWrapper = useCallback((nodeId: string): Promise<TreeNode[] | null> => {
    const findNode = (node: TreeNode, id: string): TreeNode | null => {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, id);
          if (found) return found;
        }
      }
      return null;
    };

    if (!rootNode) return Promise.resolve(null);
    const node = findNode(rootNode, nodeId);
    if (!node) return Promise.resolve(null);
    
    return handleExpandNode(nodeId, node);
  }, [rootNode, handleExpandNode]);

  const collectAllNodes = useCallback((node: TreeNode, parentId?: string): any[] => {
    const nodes = [{ 
      id: node.id,
      title: node.title, 
      content: node.content, 
      level: node.level,
      parentId 
    }];
    if (node.children) {
      node.children.forEach(child => {
        nodes.push(...collectAllNodes(child, node.id));
      });
    }
    return nodes;
  }, []);

  const handleSaveToGraph = useCallback(async () => {
    if (!rootNode) return;

    setIsSaving(true);

    try {
      let targetGraphId: string | undefined = graphId;
      
      if (!targetGraphId) {
        const createResult = await api.graphs.create({
          title: topic,
          description: rootNode.content
        });
        targetGraphId = createResult.id;
        if (targetGraphId) {
          setCreatedGraphId(targetGraphId);
        }
      }

      if (!targetGraphId) {
        handleError(new Error('Failed to create graph'), { context: 'SaveGraph', fallbackMessage: '创建图谱失败' });
        return;
      }

      const allNodes = collectAllNodes(rootNode);

      await api.autoGraph.saveNodes({
        graph_id: targetGraphId,
        nodes: allNodes
      });

      addMessage({ type: 'success', content: '知识图谱已保存' });
      onGraphGenerated?.(allNodes, []);
      onClose?.();

    } catch (error) {
      handleError(error, { context: 'SaveGraph', fallbackMessage: '保存失败' });
    } finally {
      setIsSaving(false);
    }
  }, [graphId, rootNode, topic, collectAllNodes, onGraphGenerated, onClose, addMessage, handleError]);

  return (
    <div className={`auto-graph-generator bg-white dark:bg-slate-800 ${isMobile ? 'rounded-none' : 'rounded-xl'} shadow-lg ${isMobile ? 'p-4' : 'p-6'} w-full ${isMobile ? 'h-full' : 'max-w-2xl max-h-[90vh]'} overflow-y-auto`}>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`${isMobile ? 'p-1.5' : 'p-2'} bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg`}>
            <Layers className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
          </div>
          <div>
            <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900 dark:text-white`}>AI 知识图谱生成器</h2>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>渐进式生成，无限展开</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X size={isMobile ? 18 : 20} />
          </button>
        )}
      </div>

      <div className="space-y-3 md:space-y-4">
        <AnimatePresence mode="wait">
          {isInputCollapsed && rootNode ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-2 md:p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-300`}>主题：</span>
                  <span className={`font-medium text-gray-900 dark:text-white ${isMobile ? 'text-sm' : ''}`}>{topic}</span>
                  <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400 dark:text-gray-500 px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded`}>
                    {style === 'custom' ? '自定义' : style === 'academic' ? '学术' : style === 'practical' ? '实用' : '入门'}
                  </span>
                </div>
                <button
                  onClick={() => setIsInputCollapsed(false)}
                  className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-blue-500 hover:text-blue-600 flex items-center gap-1`}
                >
                  <ChevronDown size={isMobile ? 12 : 14} />
                  修改
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 md:space-y-4"
            >
              <div>
                <label className={`block ${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}>
                  主题 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="例如：机器学习基础、量子计算入门"
                    className={`w-full ${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-3'} border rounded-lg focus:ring-2 focus:border-transparent dark:bg-slate-700 dark:text-white ${
                      isDuplicate 
                        ? 'border-amber-500 focus:ring-amber-500' 
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                    disabled={isInitializing}
                  />
                  {isChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                  )}
                </div>
                {isDuplicate && similarGraphs.length > 0 && !graphId && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mt-0.5 flex-shrink-0`} />
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <p className="font-medium">主题重复</p>
                      <p className="mt-0.5">
                        与现有图谱「{similarGraphs[0].title}」相似度为 {(similarGraphs[0].similarity * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`block ${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2`}>
                  生成风格
                </label>
                <div className={`grid ${isMobile ? 'grid-cols-2 gap-1.5' : 'grid-cols-4 gap-2'}`}>
                  {styleOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setStyle(option.value as any)}
                        disabled={isInitializing}
                        className={`${isMobile ? 'p-2' : 'p-2'} rounded-lg border-2 transition-all text-left ${
                          style === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className={`flex items-center gap-1 ${isMobile ? 'mb-0.5' : 'mb-0.5'}`}>
                          <Icon className={`${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${
                            style === option.value ? 'text-blue-500' : 'text-gray-400'
                          }`} />
                          <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium ${
                            style === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {option.label}
                          </span>
                        </div>
                        <p className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-gray-500 dark:text-gray-400 line-clamp-1`}>
                          {option.details}
                        </p>
                      </button>
                    );
                  })}
                </div>
                
                <AnimatePresence>
                  {style === 'custom' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`flex items-center justify-between ${isMobile ? 'mb-1.5 mt-2' : 'mb-2 mt-3'}`}>
                        <label className={`block ${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-700 dark:text-gray-300`}>
                          自定义生成规则
                        </label>
                        <button
                          onClick={async () => {
                            if (!topic.trim()) {
                              addMessage({ type: 'warning', content: '请先输入主题' });
                              return;
                            }
                            try {
                              const result = await api.autoGraph.optimizePrompt({ topic, currentPrompt: customPrompt });
                              setCustomPrompt(result.optimizedPrompt);
                              addMessage({ type: 'success', content: '规则已优化' });
                            } catch (error) {
                              handleError(error, { context: 'OptimizePrompt', fallbackMessage: '优化失败' });
                            }
                          }}
                          disabled={isInitializing}
                          className={`flex items-center gap-1 px-2 py-1 ${isMobile ? 'text-[10px]' : 'text-xs'} bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50`}
                        >
                          <Sparkles size={isMobile ? 10 : 12} />
                          AI 优化
                        </button>
                      </div>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="例如：请用简单的语言解释概念，每个节点不超过50字，重点关注实际应用场景..."
                        className={`w-full ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white ${isMobile ? 'min-h-[80px]' : 'min-h-[100px]'} resize-y`}
                        disabled={isInitializing}
                      />
                      <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400 mt-1`}>
                        描述你希望 AI 如何生成知识图谱节点
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200`}
              >
                {showAdvanced ? <ChevronUp size={isMobile ? 14 : 16} /> : <ChevronDown size={isMobile ? 14 : 16} />}
                参考来源
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 md:space-y-3 overflow-hidden"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        placeholder="输入 URL 或文本内容"
                        className={`flex-1 ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white`}
                        disabled={isInitializing}
                      />
                      <button
                        onClick={handleAddSource}
                        disabled={isInitializing || !newSource.trim()}
                        className={`${isMobile ? 'px-2 py-1.5' : 'px-3 py-2'} bg-gray-100 dark:bg-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500 disabled:opacity-50`}
                      >
                        <Plus size={isMobile ? 14 : 16} />
                      </button>
                    </div>
                    {sources.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {sources.map((source, index) => (
                          <span
                            key={index}
                            className={`inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-600 rounded ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                          >
                            {source.slice(0, 30)}...
                            <button
                              onClick={() => handleRemoveSource(index)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={handleInitialize}
                disabled={isInitializing || !topic.trim() || isChecking || isDuplicate}
                className={`w-full ${isMobile ? 'py-2.5 px-3 text-sm' : 'py-3 px-4'} bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} />
                    正在初始化...
                  </>
                ) : (
                  <>
                    <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                    开始生成
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {rootNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 md:space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>
                生成结果
              </h3>
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>
                点击 ✨ 展开任意节点
              </span>
            </div>

            <div className={`space-y-2 ${isMobile ? 'max-h-[300px]' : 'max-h-[400px]'} overflow-y-auto`}>
              <NodeItem
                node={rootNode}
                depth={0}
                style={style}
                graphId={createdGraphId || graphId}
                isMobile={isMobile}
                onExpand={handleExpandWrapper}
                onNodeUpdate={handleNodeUpdate}
              />
            </div>

            <button
              onClick={handleSaveToGraph}
              disabled={isSaving || (rootNode && hasAnyNodeLoading(rootNode))}
              className={`w-full ${isMobile ? 'py-2 px-3 text-sm' : 'py-2 px-4'} bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {isSaving ? (
                <Loader2 className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} />
              ) : (
                <Check className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
              )}
              {graphId ? '保存到当前图谱' : '创建新图谱并保存'}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AutoGraphGenerator;
