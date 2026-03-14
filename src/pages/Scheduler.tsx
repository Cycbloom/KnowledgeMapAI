import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  RefreshCw,
  Settings,
  Clock,
  Zap,
  AlertCircle,
  Sparkles,
  Calendar,
} from "lucide-react";
import {
  useSchedulerQueues,
  useCreateScheduledTaskMutation,
  useUpdateScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
  useMoveScheduledTaskMutation,
  useReorderScheduledTasksMutation,
  useStartScheduledTaskMutation,
  usePauseScheduledTaskMutation,
  useCompleteScheduledTaskMutation,
  useSchedulerSettings,
} from "../hooks";
import { useMessageStore } from "../store/useMessageStore";
import { HorizontalQueueView } from "../components/Scheduler/HorizontalQueueView";
import { KanbanView } from "../components/Scheduler/KanbanView";
import { ListView } from "../components/Scheduler/ListView";
import { TimelineView } from "../components/Scheduler/TimelineView";
import { TaskForm } from "../components/Scheduler/TaskForm";
import { ActiveTaskPanel } from "../components/Scheduler/ActiveTaskPanel";
import { TimeSlotSettings } from "../components/Scheduler/TimeSlotSettings";
import { SmartRecommendationBar } from "../components/Scheduler/SmartRecommendationBar";
import {
  ScheduledTask,
  CreateScheduledTaskData,
  QueueData,
} from "@shared/types";

type ViewType = "queue" | "kanban" | "list" | "timeline";

const DEFAULT_TIME_SLICES = {
  q0: 25,
  q1: 45,
  q2: 90,
};

const QueueDataDefault: QueueData = { q0: [], q1: [], q2: [] };

export const Scheduler: React.FC = () => {
  const navigate = useNavigate();
  const { addMessage } = useMessageStore();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [defaultQueueLevel, setDefaultQueueLevel] = useState<number>(2);
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    return (localStorage.getItem("scheduler-view") as ViewType) || "queue";
  });

  const {
    data: queuesData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useSchedulerQueues();
  const { data: settings } = useSchedulerSettings();

  const createTaskMutation = useCreateScheduledTaskMutation();
  const updateTaskMutation = useUpdateScheduledTaskMutation();
  const deleteTaskMutation = useDeleteScheduledTaskMutation();
  const moveTaskMutation = useMoveScheduledTaskMutation();
  const reorderMutation = useReorderScheduledTasksMutation();
  const startTaskMutation = useStartScheduledTaskMutation();
  const pauseTaskMutation = usePauseScheduledTaskMutation();
  const completeTaskMutation = useCompleteScheduledTaskMutation();

  useEffect(() => {
    localStorage.setItem("scheduler-view", currentView);
  }, [currentView]);

  const queues = useMemo(() => {
    if (!queuesData || typeof queuesData !== "object") return QueueDataDefault;
    const actualData = (queuesData as any).data || queuesData;
    return {
      q0: Array.isArray(actualData.q0) ? actualData.q0 : [],
      q1: Array.isArray(actualData.q1) ? actualData.q1 : [],
      q2: Array.isArray(actualData.q2) ? actualData.q2 : [],
    };
  }, [queuesData]);

  const timeSlices = useMemo(
    () => ({
      q0: settings?.q0_time_slice || DEFAULT_TIME_SLICES.q0,
      q1: settings?.q1_time_slice || DEFAULT_TIME_SLICES.q1,
      q2: settings?.q2_time_slice || DEFAULT_TIME_SLICES.q2,
    }),
    [settings],
  );

  const allTasks = useMemo(() => {
    return [...queues.q0, ...queues.q1, ...queues.q2];
  }, [queues]);

  const activeTask = useMemo(() => {
    return allTasks.find((t) => t.status === "in_progress") || null;
  }, [allTasks]);

  const activeTaskTimeSlice = useMemo(() => {
    if (!activeTask) return DEFAULT_TIME_SLICES.q2;
    const queueKey = `q${activeTask.queue_level}` as keyof typeof timeSlices;
    return timeSlices[queueKey] || DEFAULT_TIME_SLICES.q2;
  }, [activeTask, timeSlices]);

  const stats = useMemo(() => {
    const pending = allTasks.filter((t) => t.status === "pending").length;
    const inProgress = allTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const totalEstimated = allTasks.reduce(
      (sum, t) => sum + (t.estimated_duration || 0),
      0,
    );
    return {
      total: allTasks.length,
      pending,
      inProgress,
      completed,
      totalEstimated,
    };
  }, [allTasks]);

  const findTaskById = useCallback(
    (taskId: string): ScheduledTask | undefined => {
      return allTasks.find((t) => t.id === taskId);
    },
    [allTasks],
  );

  const handleCreateTask = async (data: CreateScheduledTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      addMessage({ type: "success", content: "任务创建成功" });
      setShowTaskForm(false);
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "创建任务失败" });
    }
  };

  const handleUpdateTask = async (data: CreateScheduledTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      addMessage({ type: "success", content: "任务更新成功" });
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "更新任务失败" });
    }
  };

  const handleDeleteTask = async (task: ScheduledTask) => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      addMessage({ type: "success", content: "任务已删除" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "删除任务失败" });
    }
  };

  const handleMoveTask = async (taskId: string, targetQueue: number) => {
    try {
      await moveTaskMutation.mutateAsync({ id: taskId, targetQueue });
      addMessage({ type: "success", content: `任务已移动到 Q${targetQueue}` });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "移动任务失败" });
    }
  };

  const handleReorder = (queueLevel: number) => async (taskIds: string[]) => {
    try {
      await reorderMutation.mutateAsync({ queueLevel, taskIds });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "排序失败" });
    }
  };

  const handleStartTask = async (task: ScheduledTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      addMessage({ type: "success", content: "任务已开始" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "开始任务失败" });
    }
  };

  const handlePauseTask = async (task: ScheduledTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      addMessage({ type: "success", content: "任务已暂停" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "暂停任务失败" });
    }
  };

  const handleCompleteTask = async (task: ScheduledTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      addMessage({ type: "success", content: "任务已完成" });
    } catch (err: any) {
      addMessage({ type: "error", content: err.message || "完成任务失败" });
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

  const handleViewTaskDetail = (task: ScheduledTask) => {
    navigate(`/scheduler/task/${task.id}`);
  };

  const formatTotalTime = (minutes: number) => {
    if (minutes === 0) return "0分钟";
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-y-auto custom-scrollbar">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-full flex flex-col">
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      三层反馈队列 · 智能时间管理
                    </p>
                  </div>
                </motion.div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/calendar")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  <Calendar size={18} />
                  <span>日历</span>
                </motion.button>

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
                  <RefreshCw
                    size={18}
                    className={isFetching ? "animate-spin" : ""}
                  />
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2.5 rounded-xl border transition-all ${
                    showSettings
                      ? "bg-cyan-100 dark:bg-cyan-500/20 border-cyan-300 dark:border-cyan-500/50 text-cyan-600 dark:text-cyan-400"
                      : "bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  待处理
                </span>
                <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                  {stats.pending}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  进行中
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {stats.inProgress}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  已完成
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Clock size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  预计时长
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatTotalTime(stats.totalEstimated)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="flex-shrink-0 p-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400">
              <AlertCircle size={20} />
              <span>加载失败: {(error as Error).message}</span>
              <button
                onClick={() => refetch()}
                className="ml-auto text-sm underline hover:text-red-500 dark:hover:text-red-300"
              >
                重试
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-500/30 rounded-full animate-spin border-t-cyan-500" />
                  <Sparkles
                    size={24}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500 dark:text-cyan-400"
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  加载任务队列...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Smart Recommendation Bar - only show when no active task */}
              {!activeTask && (
                <div className="mb-6">
                  <SmartRecommendationBar
                    onStartTask={(taskId) => {
                      const task = findTaskById(taskId);
                      if (task) handleStartTask(task);
                    }}
                    onViewTask={(taskId) => {
                      const task = findTaskById(taskId);
                      if (task) handleViewTaskDetail(task);
                    }}
                    currentTaskId={null}
                  />
                </div>
              )}

              {activeTask && (
                <ActiveTaskPanel
                  task={activeTask}
                  timeSlice={activeTaskTimeSlice}
                  onPause={() => handlePauseTask(activeTask)}
                  onComplete={() => handleCompleteTask(activeTask)}
                />
              )}
              <HorizontalQueueView
                queues={queues}
                timeSlices={timeSlices}
                currentView={currentView}
                onViewChange={(view) => setCurrentView(view as ViewType)}
                onTaskMove={handleMoveTask}
                onReorder={(queueLevel, taskIds) =>
                  handleReorder(queueLevel)(taskIds)
                }
                onEditTask={openEditTaskForm}
                onDeleteTask={handleDeleteTask}
                onStartTask={handleStartTask}
                onPauseTask={handlePauseTask}
                onCompleteTask={handleCompleteTask}
                onAddTask={openAddTaskForm}
                onViewTaskDetail={handleViewTaskDetail}
              >
                {{
                  timeline: (
                    <TimelineView
                      tasks={allTasks}
                      onTaskClick={openEditTaskForm}
                    />
                  ),
                  kanban: (
                    <KanbanView
                      tasks={allTasks}
                      onTaskClick={openEditTaskForm}
                    />
                  ),
                  list: (
                    <ListView
                      tasks={allTasks}
                      onEditTask={openEditTaskForm}
                      onDeleteTask={handleDeleteTask}
                      onStartTask={handleStartTask}
                      onPauseTask={handlePauseTask}
                      onCompleteTask={handleCompleteTask}
                    />
                  ),
                }}
              </HorizontalQueueView>
            </>
          )}
        </main>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowSettings(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      任务设置
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      配置你的任务偏好和可用时间
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-slate-500 dark:text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  <TimeSlotSettings onClose={() => setShowSettings(false)} />
                </div>
              </motion.div>
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
