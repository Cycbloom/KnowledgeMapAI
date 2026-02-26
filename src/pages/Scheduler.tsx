import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  Over,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { logger } from '../utils/logger';
import { 
  Plus, 
  RefreshCw, 
  Settings, 
  Clock, 
  Target, 
  Zap, 
  ListTodo,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { 
  useQueues, 
  useCreateScheduledTaskMutation,
  useUpdateScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
  useMoveTaskMutation,
  useReorderTasksMutation,
  useStartTaskMutation,
  usePauseTaskMutation,
  useCompleteTaskMutation,
  useTaskSettings
} from '../hooks/useQueries';
import { useMessageStore } from '../store/useMessageStore';
import { QueueColumn } from '../components/Scheduler/QueueColumn';
import { TaskCard } from '../components/Scheduler/TaskCard';
import { TaskForm } from '../components/Scheduler/TaskForm';
import { ScheduledTask, CreateScheduledTaskData, QueueData } from '../services/api/scheduler';

const DEFAULT_TIME_SLICES = {
  q0: 25,
  q1: 45,
  q2: 90,
};

const QueueDataDefault: QueueData = { q0: [], q1: [], q2: [] };

export const Scheduler: React.FC = () => {
  const { addMessage } = useMessageStore();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [defaultQueueLevel, setDefaultQueueLevel] = useState<number>(2);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTask, setActiveTask] = useState<ScheduledTask | null>(null);
  const [localQueues, setLocalQueues] = useState<QueueData | null>(null);
  
  const sourceQueueRef = useRef<string | null>(null);
  const currentQueueRef = useRef<string | null>(null);
  const targetIndexRef = useRef<number>(-1);

  const { data: queuesData, isLoading, error, refetch, isFetching } = useQueues();
  const { data: settings } = useTaskSettings();

  const createTaskMutation = useCreateScheduledTaskMutation();
  const updateTaskMutation = useUpdateScheduledTaskMutation();
  const deleteTaskMutation = useDeleteScheduledTaskMutation();
  const moveTaskMutation = useMoveTaskMutation();
  const reorderMutation = useReorderTasksMutation();
  const startTaskMutation = useStartTaskMutation();
  const pauseTaskMutation = usePauseTaskMutation();
  const completeTaskMutation = useCompleteTaskMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCenter(args);
  }, []);

  const queues = useMemo(() => {
    if (!queuesData || typeof queuesData !== 'object') return QueueDataDefault;
    const actualData = (queuesData as any).data || queuesData;
    return {
      q0: Array.isArray(actualData.q0) ? actualData.q0 : [],
      q1: Array.isArray(actualData.q1) ? actualData.q1 : [],
      q2: Array.isArray(actualData.q2) ? actualData.q2 : [],
    };
  }, [queuesData]);

  const displayQueues = localQueues || queues;

  const timeSlices = useMemo(() => ({
    q0: settings?.q0_time_slice || DEFAULT_TIME_SLICES.q0,
    q1: settings?.q1_time_slice || DEFAULT_TIME_SLICES.q1,
    q2: settings?.q2_time_slice || DEFAULT_TIME_SLICES.q2,
  }), [settings]);

  const stats = useMemo(() => {
    const allTasks = [...displayQueues.q0, ...displayQueues.q1, ...displayQueues.q2];
    const pending = allTasks.filter(t => t.status === 'pending').length;
    const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const totalEstimated = allTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    return { total: allTasks.length, pending, inProgress, completed, totalEstimated };
  }, [displayQueues]);

  const findTaskById = (id: string, searchQueues: QueueData): { task: ScheduledTask; queueKey: string } | null => {
    for (const key of ['q0', 'q1', 'q2'] as const) {
      const task = searchQueues[key].find(t => t.id === id);
      if (task) {
        return { task, queueKey: key };
      }
    }
    return null;
  };

  const getQueueKeyFromOver = (over: Over, searchQueues: QueueData): { queueKey: string; index: number } | null => {
    const overId = over.id as string;
    
    if (overId.startsWith('queue-')) {
      return { queueKey: overId.replace('queue-', 'q'), index: -1 };
    }
    
    for (const key of ['q0', 'q1', 'q2'] as const) {
      const index = searchQueues[key].findIndex(t => t.id === overId);
      if (index !== -1) {
        return { queueKey: key, index };
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const result = findTaskById(active.id as string, queues);
    logger.debug('handleDragStart', { activeId: active.id, result });
    if (result) {
      setActiveTask(result.task);
      sourceQueueRef.current = result.queueKey;
      currentQueueRef.current = result.queueKey;
      targetIndexRef.current = -1;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeQueueKey = currentQueueRef.current;
    if (!activeQueueKey) return;

    const overResult = getQueueKeyFromOver(over, displayQueues);
    logger.debug('handleDragOver', { activeId, overId: over.id, activeQueueKey, overResult });
    if (!overResult) return;

    const { queueKey: overQueueKey, index: overIndex } = overResult;

    if (activeQueueKey !== overQueueKey) {
      const newQueues = { ...displayQueues };
      const sourceTasks = [...newQueues[activeQueueKey as keyof QueueData]];
      const destTasks = [...newQueues[overQueueKey as keyof QueueData]];
      
      const taskIndex = sourceTasks.findIndex(t => t.id === activeId);
      if (taskIndex === -1) return;
      
      const [movedTask] = sourceTasks.splice(taskIndex, 1);
      const updatedTask = { ...movedTask, queue_level: parseInt(overQueueKey.replace('q', '')) };
      
      if (overIndex !== -1) {
        destTasks.splice(overIndex, 0, updatedTask);
        targetIndexRef.current = overIndex;
      } else {
        destTasks.push(updatedTask);
        targetIndexRef.current = destTasks.length - 1;
      }
      
      newQueues[activeQueueKey as keyof QueueData] = sourceTasks;
      newQueues[overQueueKey as keyof QueueData] = destTasks;
      
      setLocalQueues(newQueues);
      currentQueueRef.current = overQueueKey;
    } else {
      const tasks = [...displayQueues[activeQueueKey as keyof QueueData]];
      const oldIndex = tasks.findIndex(t => t.id === activeId);
      
      if (overIndex !== -1 && oldIndex !== -1 && oldIndex !== overIndex) {
        const newTasks = arrayMove(tasks, oldIndex, overIndex);
        const newQueues = { ...displayQueues, [activeQueueKey]: newTasks };
        setLocalQueues(newQueues);
        targetIndexRef.current = overIndex;
      } else if (overIndex === -1 && oldIndex !== -1) {
        targetIndexRef.current = tasks.length - 1;
      }
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    sourceQueueRef.current = null;
    currentQueueRef.current = null;
    targetIndexRef.current = -1;
    setLocalQueues(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const sourceQueue = sourceQueueRef.current;
    let targetQueueKey = currentQueueRef.current;
    let targetIndex = targetIndexRef.current;
    
    logger.debug('handleDragEnd start:', { 
      activeId: active.id, 
      overId: over?.id,
      sourceQueue,
      targetQueueKey,
      targetIndex
    });
    
    setActiveTask(null);
    sourceQueueRef.current = null;
    currentQueueRef.current = null;
    targetIndexRef.current = -1;

    if (!over) {
      setLocalQueues(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (!targetQueueKey) {
      const overResult = getQueueKeyFromOver(over, queues);
      logger.debug('getQueueKeyFromOver result:', overResult);
      if (overResult) {
        targetQueueKey = overResult.queueKey;
        if (targetIndex === -1) {
          targetIndex = overResult.index;
        }
      }
    }

    if (!targetQueueKey) {
      setLocalQueues(null);
      return;
    }

    const tasks = queues[targetQueueKey as keyof QueueData] as ScheduledTask[];
    
    if (targetIndex === -1) {
      logger.debug('Calculating targetIndex:', { overId, activeId, tasksLength: tasks.length });
      if (overId.startsWith('queue-')) {
        targetIndex = tasks.length > 0 ? tasks.length - 1 : 0;
      } else if (overId !== activeId) {
        targetIndex = tasks.findIndex((t: ScheduledTask) => t.id === overId);
      } else {
        targetIndex = tasks.findIndex((t: ScheduledTask) => t.id === activeId);
      }
    }
    
    logger.debug('Final values:', { sourceQueue, targetQueueKey, targetIndex, activeId });

    if (sourceQueue && sourceQueue !== targetQueueKey) {
      const targetQueueLevel = parseInt(targetQueueKey.replace('q', ''));
      try {
        await moveTaskMutation.mutateAsync({ taskId: activeId, targetQueue: targetQueueLevel });
        addMessage({ type: 'success', content: `任务已移动到 Q${targetQueueLevel}` });
      } catch (err: any) {
        const details = err.details?.map((d: any) => `${d.field}: ${d.message}`).join(', ');
        addMessage({ type: 'error', content: details || err.message || '移动任务失败' });
      }
    } else if (sourceQueue === targetQueueKey && targetIndex !== -1) {
      const oldIndex = tasks.findIndex((t: ScheduledTask) => t.id === activeId);
      
      if (oldIndex !== -1 && oldIndex !== targetIndex) {
        const newOrder = arrayMove(tasks, oldIndex, targetIndex);
        const taskIds = newOrder.map((t: ScheduledTask) => t.id);
        const queueLevel = parseInt(targetQueueKey.replace('q', ''));
        try {
          await reorderMutation.mutateAsync({ queueLevel, taskIds });
          addMessage({ type: 'success', content: '任务顺序已更新' });
        } catch (err: any) {
          const details = err.details?.map((d: any) => `${d.field}: ${d.message}`).join(', ');
          addMessage({ type: 'error', content: details || err.message || '排序失败' });
        }
      }
    }

    setLocalQueues(null);
  };

  const handleCreateTask = async (data: CreateScheduledTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      addMessage({ type: 'success', content: '任务创建成功' });
      setShowTaskForm(false);
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '创建任务失败' });
    }
  };

  const handleUpdateTask = async (data: CreateScheduledTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      addMessage({ type: 'success', content: '任务更新成功' });
      setEditingTask(null);
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '更新任务失败' });
    }
  };

  const handleDeleteTask = async (task: ScheduledTask) => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      addMessage({ type: 'success', content: '任务已删除' });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '删除任务失败' });
    }
  };

  const handleMoveTask = async (taskId: string, targetQueue: number) => {
    try {
      await moveTaskMutation.mutateAsync({ taskId, targetQueue });
      addMessage({ type: 'success', content: `任务已移动到 Q${targetQueue}` });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '移动任务失败' });
    }
  };

  const handleReorder = (queueLevel: number) => async (taskIds: string[]) => {
    try {
      await reorderMutation.mutateAsync({ queueLevel, taskIds });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '排序失败' });
    }
  };

  const handleStartTask = async (task: ScheduledTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      addMessage({ type: 'success', content: '任务已开始' });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '开始任务失败' });
    }
  };

  const handlePauseTask = async (task: ScheduledTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      addMessage({ type: 'success', content: '任务已暂停' });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '暂停任务失败' });
    }
  };

  const handleCompleteTask = async (task: ScheduledTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      addMessage({ type: 'success', content: '任务已完成' });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '完成任务失败' });
    }
  };

  const openAddTaskForm = (queueLevel: number = 2) => {
    setDefaultQueueLevel(queueLevel);
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const openEditTaskForm = (task: ScheduledTask) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const formatTotalTime = (minutes: number) => {
    if (minutes === 0) return '0分钟';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3"
                >
                  <div className="relative">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                      <Zap size={24} className="text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 dark:from-cyan-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                      任务调度器
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">三层反馈队列 · 智能时间管理</p>
                  </div>
                </motion.div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openAddTaskForm(2)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
                >
                  <Plus size={18} />
                  <span>新建任务</span>
                </motion.button>

                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2.5 rounded-xl border transition-all ${
                    showSettings 
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-300 dark:border-cyan-500/50 text-cyan-600 dark:text-cyan-400' 
                      : 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
                <span className="text-sm text-slate-500 dark:text-slate-400">待处理</span>
                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                <span className="text-sm text-slate-500 dark:text-slate-400">进行中</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">已完成</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Clock size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">预计时长</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{formatTotalTime(stats.totalEstimated)}</span>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="flex-shrink-0 p-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400">
              <AlertCircle size={20} />
              <span>加载失败: {(error as Error).message}</span>
              <button onClick={() => refetch()} className="ml-auto text-sm underline hover:text-red-500 dark:hover:text-red-300">
                重试
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-hidden p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-500/30 rounded-full animate-spin border-t-cyan-500" />
                  <Sparkles size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500 dark:text-cyan-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400">加载任务队列...</p>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="h-full flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
                <QueueColumn
                    level={0}
                    title="紧急队列"
                    timeSlice={timeSlices.q0}
                    tasks={displayQueues.q0}
                    onTaskMove={handleMoveTask}
                    onReorder={handleReorder(0)}
                    onEditTask={openEditTaskForm}
                    onDeleteTask={handleDeleteTask}
                    onStartTask={handleStartTask}
                    onPauseTask={handlePauseTask}
                    onCompleteTask={handleCompleteTask}
                    onAddTask={() => openAddTaskForm(0)}
                  />
                  <QueueColumn
                    level={1}
                    title="重要队列"
                    timeSlice={timeSlices.q1}
                    tasks={displayQueues.q1}
                    onTaskMove={handleMoveTask}
                    onReorder={handleReorder(1)}
                    onEditTask={openEditTaskForm}
                    onDeleteTask={handleDeleteTask}
                    onStartTask={handleStartTask}
                    onPauseTask={handlePauseTask}
                    onCompleteTask={handleCompleteTask}
                    onAddTask={() => openAddTaskForm(1)}
                  />
                  <QueueColumn
                    level={2}
                    title="待办队列"
                    timeSlice={timeSlices.q2}
                    tasks={displayQueues.q2}
                    onTaskMove={handleMoveTask}
                    onReorder={handleReorder(2)}
                    onEditTask={openEditTaskForm}
                    onDeleteTask={handleDeleteTask}
                    onStartTask={handleStartTask}
                    onPauseTask={handlePauseTask}
                    onCompleteTask={handleCompleteTask}
                    onAddTask={() => openAddTaskForm(2)}
                  />
                </div>

              <DragOverlay>
                {activeTask ? (
                  <div className="opacity-90">
                    <TaskCard task={activeTask} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </main>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl p-4"
            >
              <div className="flex items-center gap-6">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">时间片设置</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-cyan-600 dark:text-cyan-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Q0:</span>
                    <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{timeSlices.q0}分钟</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Q1:</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{timeSlices.q1}分钟</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ListTodo size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Q2:</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{timeSlices.q2}分钟</span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500">休息时长:</span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{settings?.break_duration || 5}分钟</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/80 dark:bg-slate-900/30 backdrop-blur-sm px-6 py-3">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-4">
              <span>拖拽任务卡片可在队列间移动或重新排序</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>任务完成后将自动降级到下一队列</span>
            </div>
            <div className="flex items-center gap-2">
              <span>总任务: {stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showTaskForm && (
          <TaskForm
            task={editingTask || undefined}
            onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
            onCancel={() => {
              setShowTaskForm(false);
              setEditingTask(null);
            }}
            defaultQueueLevel={defaultQueueLevel}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
