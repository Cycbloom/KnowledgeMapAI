import React, { useState, useCallback, useMemo } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  CheckCircle2, 
  Circle, 
  Clock, 
  SkipForward,
  Play,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  Target,
  Calendar,
  Timer
} from 'lucide-react';
import { useTheme } from "../../hooks";
import { api } from '../../services/api';
import { frontendEventBus } from "../../services/timer/FrontendEventBus";

interface LearningPathNode {
  id: string;
  node_id: string;
  node?: {
    id: string;
    title: string;
    content?: string;
    level?: string;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  estimated_minutes: number;
  difficulty_level: number;
  completed_at?: string;
}

interface LearningPathStage {
  id?: string;
  nodeId?: string;
  nodeTitle?: string;
  estimatedTime?: number;
  priority?: string;
  nodes?: Array<{
    knowledge_point_id?: string;
  }>;
}

interface LearningPath {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  total_nodes: number;
  completed_nodes: number;
  progress_percentage: number;
  estimated_hours?: number;
  daily_minutes_target?: number;
  target_completion_date?: string;
  nodes: LearningPathNode[];
}

interface LearningPathEditorProps {
  graphId: string;
  learningPath: LearningPath | null;
  nodes: Array<{ id: string; title: string; level?: string }>;
  onNodeSelect: (nodeId: string) => void;
  onRefresh: () => void;
  isOpen: boolean;
  onClose: () => void;
}

interface SortableNodeProps {
  node: LearningPathNode;
  index: number;
  onNodeSelect: (nodeId: string) => void;
  onStatusChange: (nodeRefId: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped') => void;
  onRemove: (nodeRefId: string) => void;
  isDark: boolean;
}

const SortableNode: React.FC<SortableNodeProps> = ({
  node,
  index,
  onNodeSelect,
  onStatusChange,
  onRemove,
  isDark
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusIcons = {
    pending: <Circle className="w-5 h-5 text-gray-400" />,
    in_progress: <Play className="w-5 h-5 text-primary-500" />,
    completed: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    skipped: <SkipForward className="w-5 h-5 text-orange-500" />,
  };

  const statusColors = {
    pending: isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200',
    in_progress: isDark ? 'bg-primary-900/20 border-primary-700' : 'bg-primary-50 border-primary-200',
    completed: isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200',
    skipped: isDark ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-200',
  };

  const difficultyColors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all
        ${statusColors[node.status]}
        ${isDragging ? 'shadow-lg' : 'hover:shadow-md'}
      `}
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing p-1 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 text-sm font-medium">
        {index + 1}
      </div>

      <button
        onClick={() => node.node && onNodeSelect(node.node.id)}
        className="flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {node.node?.title || '未知节点'}
          </span>
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: difficultyColors[Math.min(node.difficulty_level - 1, 4)] }}
            title={`难度: ${node.difficulty_level}/5`}
          />
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {node.estimated_minutes}分钟
          </span>
          {node.node?.level && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 dark:bg-slate-600">
              {node.node.level}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onStatusChange(node.id, node.status === 'completed' ? 'pending' : 'completed')}
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
          title={node.status === 'completed' ? '标记为未完成' : '标记为完成'}
        >
          {statusIcons[node.status]}
        </button>
        <button
          onClick={() => onRemove(node.id)}
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'}`}
          title="从路径中移除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const LearningPathEditor: React.FC<LearningPathEditorProps> = ({
  graphId,
  learningPath,
  nodes,
  onNodeSelect,
  onRefresh,
  isOpen,
  onClose
}) => {
  const { isDark } = useTheme();
  
  const [pathNodes, setPathNodes] = useState<LearningPathNode[]>(learningPath?.nodes || []);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [selectedNewNode, setSelectedNewNode] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    if (learningPath?.nodes) {
      setPathNodes(learningPath.nodes);
    }
  }, [learningPath]);

  const availableNodes = useMemo(() => {
    const pathNodeIds = new Set(pathNodes.map(pn => pn.node_id));
    return nodes.filter(n => !pathNodeIds.has(n.id));
  }, [nodes, pathNodes]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPathNodes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleStatusChange = useCallback(async (nodeRefId: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped') => {
    if (!learningPath) return;
    
    try {
      await api.learningPaths.updateNodeStatus(learningPath.id, nodeRefId, status);
      setPathNodes(prev => prev.map(pn => 
        pn.id === nodeRefId ? { ...pn, status } : pn
      ));
      frontendEventBus.publish("message_show", { type: 'success', content: '状态已更新' });
    } catch (_error) {
      frontendEventBus.publish("message_show", { type: 'error', content: '更新状态失败' });
    }
  }, [learningPath]);

  const handleRemoveNode = useCallback(async (nodeRefId: string) => {
    if (!learningPath) return;
    
    try {
      await api.learningPaths.removeNode(learningPath.id, nodeRefId);
      setPathNodes(prev => prev.filter(pn => pn.id !== nodeRefId));
      frontendEventBus.publish("message_show", { type: 'success', content: '节点已从路径中移除' });
      onRefresh();
    } catch (_error) {
      frontendEventBus.publish("message_show", { type: 'error', content: '移除节点失败' });
    }
  }, [learningPath, onRefresh]);

  const handleAddNode = useCallback(async () => {
    if (!learningPath || !selectedNewNode) return;
    
    setIsSaving(true);
    try {
      await api.learningPaths.addNode(learningPath.id, { 
        node_id: selectedNewNode,
        estimated_minutes: 30,
        difficulty_level: 3
      });
      setSelectedNewNode('');
      setIsAddingNode(false);
      frontendEventBus.publish("message_show", { type: 'success', content: '节点已添加到路径' });
      onRefresh();
    } catch (_error) {
      frontendEventBus.publish("message_show", { type: 'error', content: '添加节点失败' });
    } finally {
      setIsSaving(false);
    }
  }, [learningPath, selectedNewNode, onRefresh]);

  const handleSaveOrder = useCallback(async () => {
    if (!learningPath) return;
    
    setIsSaving(true);
    try {
      await api.learningPaths.reorderNodes(learningPath.id, pathNodes.map(pn => pn.id));
      frontendEventBus.publish("message_show", { type: 'success', content: '顺序已保存' });
      onRefresh();
    } catch (_error) {
      frontendEventBus.publish("message_show", { type: 'error', content: '保存顺序失败' });
    } finally {
      setIsSaving(false);
    }
  }, [learningPath, pathNodes, onRefresh]);

  const handleGeneratePath = useCallback(async () => {
    setIsGenerating(true);
    try {
      if (learningPath) {
        try {
          await api.learningPaths.delete(learningPath.id);
        } catch (e) {
          console.warn('Failed to delete old path:', e);
        }
      }
      
      const result = await api.learningPath.generate({
        graph_id: graphId,
        target_goal: '根据图谱结构生成最优学习路径',
        learning_style: 'sequential',
        daily_time_minutes: 30
      }) as { stages: LearningPathStage[]; graphTitle: string; targetGoal?: string };

      if (result.stages && result.stages.length > 0) {
        const nodes = result.stages.map((stage: LearningPathStage, index: number) => ({
          knowledge_point_id: stage.nodeId,
          order_index: index,
          title: stage.nodeTitle || '',
          estimated_time: stage.estimatedTime,
          is_milestone: stage.priority === 'high',
        }));
        
        await api.learningPaths.create({
          title: `学习路径 - ${result.graphTitle}`,
          description: result.targetGoal || 'AI 生成的学习路径',
          goal: result.targetGoal,
          daily_minutes_target: 30,
          ai_generated: true,
          nodes,
        });
        
        frontendEventBus.publish("message_show", { type: 'success', content: 'AI 学习路径已生成！' });
        onRefresh();
      } else {
        frontendEventBus.publish("message_show", { type: 'warning', content: '无法生成学习路径，请检查图谱是否有节点' });
      }
    } catch (error) {
      console.error('Generate path error:', error);
      frontendEventBus.publish("message_show", { type: 'error', content: '生成学习路径失败' });
    } finally {
      setIsGenerating(false);
    }
  }, [graphId, learningPath, onRefresh]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={`
        relative w-full max-w-2xl max-h-[75vh] rounded-xl shadow-2xl overflow-hidden flex flex-col
        ${isDark ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border border-gray-200 text-gray-900'}
      `}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-primary-500" />
            <div>
              <h2 className="text-lg font-semibold">学习路径编辑器</h2>
              {learningPath && (
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {learningPath.title} · {learningPath.completed_nodes}/{learningPath.total_nodes} 已完成
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {learningPath ? (
            <>
              <div className={`flex items-center justify-between mb-4 p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {learningPath.completed_nodes ?? 0} 已完成
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-primary-500" />
                    {learningPath.estimated_hours?.toFixed(1) ?? '-'} 小时
                  </span>
                  {learningPath.target_completion_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-primary-500" />
                      {new Date(learningPath.target_completion_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex-1 mx-4">
                  <div className={`h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-500"
                      style={{ width: `${learningPath.progress_percentage ?? 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium">{(learningPath.progress_percentage ?? 0).toFixed(0)}%</span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={pathNodes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {pathNodes.map((node, index) => (
                      <SortableNode
                        key={node.id}
                        node={node}
                        index={index}
                        onNodeSelect={onNodeSelect}
                        onStatusChange={handleStatusChange}
                        onRemove={handleRemoveNode}
                        isDark={isDark}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {isAddingNode && (
                <div className={`mt-4 p-4 rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
                  <h4 className="text-sm font-medium mb-3">添加节点到路径</h4>
                  <div className="flex gap-2">
                    <select
                      value={selectedNewNode}
                      onChange={(e) => setSelectedNewNode(e.target.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border ${
                        isDark 
                          ? 'bg-slate-700 border-slate-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">选择节点...</option>
                      {availableNodes.map(node => (
                        <option key={node.id} value={node.id}>{node.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddNode}
                      disabled={!selectedNewNode || isSaving}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '添加'}
                    </button>
                    <button
                      onClick={() => { setIsAddingNode(false); setSelectedNewNode(''); }}
                      className={`px-4 py-2 rounded-lg ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Target className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-gray-300'}`} />
              <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                尚未创建学习路径
              </h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                让AI根据图谱结构为您生成最优学习路径
              </p>
              <button
                onClick={handleGeneratePath}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-600 text-white rounded-lg hover:from-primary-700 hover:to-primary-700 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI生成学习路径
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {learningPath && (
          <div className={`flex items-center justify-between px-6 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingNode(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Plus className="w-4 h-4" />
                添加节点
              </button>
              <button
                onClick={handleGeneratePath}
                disabled={isGenerating}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gradient-to-r from-primary-600 to-primary-600 text-white hover:from-primary-700 hover:to-primary-700 disabled:opacity-50`}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                AI 重新生成
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                取消
              </button>
              <button
                onClick={handleSaveOrder}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                保存更改
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
