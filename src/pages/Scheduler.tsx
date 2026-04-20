import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  Route,
  Filter,
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
import { useScrollDirection } from "../hooks/useScrollDirection";
import { useLearningPaths } from "../hooks/queries/useLearningPathQueries";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import {
  ScheduledTask,
  CreateScheduledTaskData,
  QueueData,
} from "@shared/types";

const HorizontalQueueView = lazy(() =>
  import("../components/Scheduler/HorizontalQueueView").then((module) => ({
    default: module.HorizontalQueueView,
  })),
);

const KanbanView = lazy(() =>
  import("../components/Scheduler/KanbanView").then((module) => ({
    default: module.KanbanView,
  })),
);

const ListView = lazy(() =>
  import("../components/Scheduler/ListView").then((module) => ({
    default: module.ListView,
  })),
);

const TimelineView = lazy(() =>
  import("../components/Scheduler/TimelineView").then((module) => ({
    default: module.TimelineView,
  })),
);

const TaskForm = lazy(() =>
  import("../components/Scheduler/TaskForm").then((module) => ({
    default: module.TaskForm,
  })),
);

const ActiveTaskPanel = lazy(() =>
  import("../components/Scheduler/ActiveTaskPanel").then((module) => ({
    default: module.ActiveTaskPanel,
  })),
);

const TimeSlotSettings = lazy(() =>
  import("../components/Scheduler/TimeSlotSettings").then((module) => ({
    default: module.TimeSlotSettings,
  })),
);

const SmartRecommendationBar = lazy(() =>
  import("../components/Scheduler/SmartRecommendationBar").then((module) => ({
    default: module.SmartRecommendationBar,
  })),
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
  </div>
);

type ViewType = "queue" | "kanban" | "list" | "timeline";

const DEFAULT_TIME_SLICES = {
  q0: 25,
  q1: 45,
  q2: 90,
};

const QueueDataDefault: QueueData = { q0: [], q1: [], q2: [] };

export const Scheduler: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [defaultQueueLevel, setDefaultQueueLevel] = useState<number>(2);
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    return (localStorage.getItem("scheduler-view") as ViewType) || "queue";
  });
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [groupByPath, setGroupByPath] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const scrollDirection = useScrollDirection(mainRef, {
    threshold: 5,
    debounceMs: 80,
    scrollableSelector: "[data-scrollable-queue]",
  });
  const [recommendationCollapsed, setRecommendationCollapsed] = useState(false);

  useEffect(() => {
    if (scrollDirection === "down") {
      setRecommendationCollapsed(true);
    } else if (scrollDirection === "up") {
      setRecommendationCollapsed(false);
    }
  }, [scrollDirection]);

  const {
    data: queuesData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useSchedulerQueues();
  const { data: settings } = useSchedulerSettings();
  const { data: learningPaths = [] } = useLearningPaths("active");

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

  const filteredQueues = useMemo(() => {
    if (!selectedPathId) return queues;

    const filterByPath = (tasks: ScheduledTask[]) => {
      return tasks.filter((task) => {
        const taskPathId = (task as any).learning_path_id;
        return taskPathId === selectedPathId;
      });
    };

    return {
      q0: filterByPath(queues.q0),
      q1: filterByPath(queues.q1),
      q2: filterByPath(queues.q2),
    };
  }, [queues, selectedPathId]);

  const filteredTasks = useMemo(() => {
    return [...filteredQueues.q0, ...filteredQueues.q1, ...filteredQueues.q2];
  }, [filteredQueues]);

  const activeTask = useMemo(() => {
    return allTasks.find((t) => t.status === "in_progress") || null;
  }, [allTasks]);

  const activeTaskTimeSlice = useMemo(() => {
    if (!activeTask) return DEFAULT_TIME_SLICES.q2;
    const queueKey = `q${activeTask.queue_level}` as keyof typeof timeSlices;
    return timeSlices[queueKey] || DEFAULT_TIME_SLICES.q2;
  }, [activeTask, timeSlices]);

  const stats = useMemo(() => {
    const pending = filteredTasks.filter((t) => t.status === "pending").length;
    const inProgress = filteredTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const completed = filteredTasks.filter(
      (t) => t.status === "completed",
    ).length;
    const totalEstimated = filteredTasks.reduce(
      (sum, t) => sum + (t.estimated_duration || 0),
      0,
    );
    return {
      total: filteredTasks.length,
      pending,
      inProgress,
      completed,
      totalEstimated,
    };
  }, [filteredTasks]);

  const findTaskById = useCallback(
    (taskId: string): ScheduledTask | undefined => {
      return allTasks.find((t) => t.id === taskId);
    },
    [allTasks],
  );

  const handleCreateTask = async (data: CreateScheduledTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      frontendEventBus.publish("message_show", { type: "success", content: t("scheduler.taskCreated") });
      setShowTaskForm(false);
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.createTaskFailed"),
      });
    }
  };

  const handleUpdateTask = async (data: CreateScheduledTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      frontendEventBus.publish("message_show", { type: "success", content: t("scheduler.taskUpdated") });
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.updateTaskFailed"),
      });
    }
  };

  const handleDeleteTask = async (task: ScheduledTask) => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("scheduler.taskDeleted") });
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.deleteTaskFailed"),
      });
    }
  };

  const handleMoveTask = async (taskId: string, targetQueue: number) => {
    try {
      await moveTaskMutation.mutateAsync({ id: taskId, targetQueue });
      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("scheduler.taskMoved", { queue: targetQueue }),
      });
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.moveTaskFailed"),
      });
    }
  };

  const handleReorder = (queueLevel: number) => async (taskIds: string[]) => {
    try {
      await reorderMutation.mutateAsync({ queueLevel, taskIds });
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.reorderFailed"),
      });
    }
  };

  const handleStartTask = async (task: ScheduledTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("scheduler.taskStarted") });
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.startTaskFailed"),
      });
    }
  };

  const handlePauseTask = async (task: ScheduledTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("scheduler.taskPaused") });
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.pauseTaskFailed"),
      });
    }
  };

  const handleCompleteTask = async (task: ScheduledTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("scheduler.taskCompleted") });
    } catch (err: any) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: err.message || t("scheduler.completeTaskFailed"),
      });
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
    if (minutes === 0) return t("scheduler.minutes", { count: 0 });
    if (minutes < 60) return t("scheduler.minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0
      ? t("scheduler.hoursAndMinutes", { hours, minutes: mins })
      : t("scheduler.hours", { count: hours });
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
          <div className="px-3 sm:px-6 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 dark:from-cyan-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {t("scheduler.title")}
                  </h1>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.pending")}
                  </span>
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                    {stats.pending}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.inProgress")}
                  </span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {stats.inProgress}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.completed")}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.completed}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Clock size={12} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatTotalTime(stats.totalEstimated)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/calendar")}
                  className="p-2 sm:flex sm:items-center sm:gap-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  <Calendar size={16} />
                  <span className="hidden sm:inline text-sm">
                    {t("scheduler.calendar")}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openAddTaskForm(2)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline text-sm">
                    {t("scheduler.newTask")}
                  </span>
                </motion.button>

                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={isFetching ? "animate-spin" : ""}
                  />
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-xl border transition-all ${
                    showSettings
                      ? "bg-cyan-100 dark:bg-cyan-500/20 border-cyan-300 dark:border-cyan-500/50 text-cyan-600 dark:text-cyan-400"
                      : "bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-2 mt-2 overflow-x-auto">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                <span className="text-xs text-slate-500">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-xs text-slate-500">
                  {stats.inProgress}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-500">
                  {stats.completed}
                </span>
              </div>
            </div>

            {learningPaths.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <Filter size={12} className="text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.filter")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedPathId(null);
                      setGroupByPath(false);
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all ${
                      !selectedPathId && !groupByPath
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {t("scheduler.allTasks")}
                  </button>
                  {learningPaths.map((path: any) => (
                    <button
                      key={path.id}
                      onClick={() =>
                        setSelectedPathId(
                          selectedPathId === path.id ? null : path.id,
                        )
                      }
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                        selectedPathId === path.id
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Route size={10} />
                      {path.title}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setGroupByPath(!groupByPath)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      groupByPath
                        ? "bg-purple-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Route size={10} />
                    {t("scheduler.groupByPath")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="flex-shrink-0 p-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400">
              <AlertCircle size={20} />
              <span>
                {t("scheduler.loadFailed", { error: (error as Error).message })}
              </span>
              <button
                onClick={() => refetch()}
                className="ml-auto text-sm underline hover:text-red-500 dark:hover:text-red-300"
              >
                {t("scheduler.retry")}
              </button>
            </div>
          </div>
        )}

        <main ref={mainRef} className="flex-1 min-h-0 flex flex-col p-3 sm:p-6">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-500/30 rounded-full animate-spin border-t-cyan-500" />
                  <Sparkles
                    size={24}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500 dark:text-cyan-400"
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  {t("scheduler.loadingQueues")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-3 sm:gap-6">
              {!activeTask && (
                <div className="flex-shrink-0">
                  <Suspense fallback={<LoadingFallback />}>
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
                      isCollapsed={recommendationCollapsed}
                      onToggleCollapse={() =>
                        setRecommendationCollapsed(!recommendationCollapsed)
                      }
                    />
                  </Suspense>
                </div>
              )}

              {activeTask && (
                <div className="flex-shrink-0">
                  <Suspense fallback={<LoadingFallback />}>
                    <ActiveTaskPanel
                      task={activeTask}
                      timeSlice={activeTaskTimeSlice}
                      onPause={() => handlePauseTask(activeTask)}
                      onComplete={() => handleCompleteTask(activeTask)}
                    />
                  </Suspense>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <Suspense fallback={<LoadingFallback />}>
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
                        <Suspense fallback={<LoadingFallback />}>
                          <TimelineView
                            tasks={allTasks}
                            onTaskClick={openEditTaskForm}
                          />
                        </Suspense>
                      ),
                      kanban: (
                        <Suspense fallback={<LoadingFallback />}>
                          <KanbanView
                            tasks={allTasks}
                            onTaskClick={openEditTaskForm}
                          />
                        </Suspense>
                      ),
                      list: (
                        <Suspense fallback={<LoadingFallback />}>
                          <ListView
                            tasks={allTasks}
                            onEditTask={openEditTaskForm}
                            onDeleteTask={handleDeleteTask}
                            onStartTask={handleStartTask}
                            onPauseTask={handlePauseTask}
                            onCompleteTask={handleCompleteTask}
                          />
                        </Suspense>
                      ),
                    }}
                  </HorizontalQueueView>
                </Suspense>
              </div>
            </div>
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
                className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-2xl shadow-2xl m-2 sm:m-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {t("scheduler.taskSettings")}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {t("scheduler.taskSettingsDesc")}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px]"
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
                <div className="p-4 sm:p-6">
                  <Suspense fallback={<LoadingFallback />}>
                    <TimeSlotSettings onClose={() => setShowSettings(false)} />
                  </Suspense>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/80 dark:bg-slate-900/30 backdrop-blur-sm px-3 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span>{t("scheduler.dragToMove")}</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">
                |
              </span>
              <span className="hidden sm:inline">
                {t("scheduler.taskAutoDowngrade")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{t("scheduler.totalTasks", { count: stats.total })}</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showTaskForm && (
          <Suspense fallback={<LoadingFallback />}>
            <TaskForm
              task={editingTask || undefined}
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onCancel={() => {
                setShowTaskForm(false);
                setEditingTask(null);
              }}
              defaultQueueLevel={defaultQueueLevel}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};
