import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useTimerStore } from "../store/useTimerStore";
import { useFocusStore } from "../store/useFocusStore";
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
  Calendar,
  Route,
  Filter,
  Info,
} from "lucide-react";
import {
  useSchedulerQueues,
  useCreateUserTaskMutation,
  useUpdateUserTaskMutation,
  useDeleteUserTaskMutation,
  useMoveUserTaskMutation,
  useReorderUserTasksMutation,
  useStartUserTaskMutation,
  usePauseUserTaskMutation,
  useCompleteUserTaskMutation,
  useSchedulerSettings,
} from "../hooks";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { useLearningPaths } from "../hooks/queries/useLearningPathQueries";
import { useFocusTrap, useEscapeKey, useCelebration } from "@/hooks/common";
import { message } from "../utils/messageHelper";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { UserTask, CreateUserTaskData, QueueData, TaskSubtask } from "@shared/types";
import { api } from "../services/api";
import { SkeletonCard, ErrorBoundary, ErrorState } from "../components/common";
import { ShortcutHint } from "../components/common/ShortcutHint";

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
  <div className="max-w-7xl mx-auto p-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);

const SectionErrorFallback = (error: Error, resetErrorBoundary: () => void) => (
  <ErrorState
    message={error.message}
    onRetry={resetErrorBoundary}
    variant="panel"
  />
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
  const { triggerCelebration } = useCelebration();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);
  const [defaultQueueLevel, setDefaultQueueLevel] = useState<number>(2);
  const [showSettings, setShowSettings] = useState(false);
  const settingsModalRef = useFocusTrap<HTMLDivElement>({ enabled: showSettings });
  useEscapeKey(() => setShowSettings(false), showSettings);
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    return (localStorage.getItem("scheduler-view") as ViewType) || "queue";
  });
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [groupByPath, setGroupByPath] = useState(false);
  // will be used in Task 5 for ActiveTaskPanel
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const scrollDirection = useScrollDirection(mainRef, {
    threshold: 5,
    debounceMs: 80,
    scrollableSelector: "[data-scrollable-queue]",
  });
  const [recommendationCollapsed, setRecommendationCollapsed] = useState(false);
  const [showNoDeadlineHint, setShowNoDeadlineHint] = useState(false);

  useEffect(() => {
    if (scrollDirection === "down") {
      setRecommendationCollapsed(true);
    } else if (scrollDirection === "up") {
      setRecommendationCollapsed(false);
    }
  }, [scrollDirection]);

  const shouldIncludeCompleted =
    currentView === "kanban" ||
    currentView === "timeline" ||
    currentView === "list";

  const {
    data: queuesData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useSchedulerQueues({
    includeCompleted: shouldIncludeCompleted,
    includeCancelled: shouldIncludeCompleted,
  });
  const { data: settings } = useSchedulerSettings();
  const { data: learningPaths = [] } = useLearningPaths("active");

  const createTaskMutation = useCreateUserTaskMutation();
  const updateTaskMutation = useUpdateUserTaskMutation();
  const deleteTaskMutation = useDeleteUserTaskMutation();
  const moveTaskMutation = useMoveUserTaskMutation();
  const reorderMutation = useReorderUserTasksMutation();
  const startTaskMutation = useStartUserTaskMutation();
  const pauseTaskMutation = usePauseUserTaskMutation();
  const completeTaskMutation = useCompleteUserTaskMutation();

  useEffect(() => {
    localStorage.setItem("scheduler-view", currentView);
  }, [currentView]);

  const queues = useMemo(() => {
    if (!queuesData || typeof queuesData !== "object") return QueueDataDefault;
    // 兼容后端可能返回 { data: QueueData } 包装格式
    const wrapped = queuesData as { data?: QueueData };
    const actualData: QueueData = wrapped.data ?? queuesData;
    return {
      q0: Array.isArray(actualData.q0) ? actualData.q0 : [],
      q1: Array.isArray(actualData.q1) ? actualData.q1 : [],
      q2: Array.isArray(actualData.q2) ? actualData.q2 : [],
    };
  }, [queuesData]);

  const displayQueues = useMemo(() => {
    if (currentView === "queue") {
      const filterActive = (tasks: UserTask[]) =>
        tasks.filter(
          (t) => t.status !== "completed" && t.status !== "cancelled",
        );
      return {
        q0: filterActive(queues.q0),
        q1: filterActive(queues.q1),
        q2: filterActive(queues.q2),
      };
    }
    return queues;
  }, [queues, currentView]);

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
    const baseQueues = currentView === "queue" ? displayQueues : queues;
    if (!selectedPathId) return baseQueues;

    const filterByPath = (tasks: UserTask[]) => {
      return tasks.filter((task) => {
        const taskPathId = (task as UserTask & { learning_path_id?: string }).learning_path_id;
        return taskPathId === selectedPathId;
      });
    };

    return {
      q0: filterByPath(baseQueues.q0),
      q1: filterByPath(baseQueues.q1),
      q2: filterByPath(baseQueues.q2),
    };
  }, [queues, displayQueues, currentView, selectedPathId]);

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

  const noDeadlineTasks = useMemo(() => {
    return allTasks.filter(
      (task) =>
        !task.deadline &&
        task.status !== "completed" &&
        task.status !== "cancelled",
    );
  }, [allTasks]);

  const findTaskById = useCallback(
    (taskId: string): UserTask | undefined => {
      return allTasks.find((t) => t.id === taskId);
    },
    [allTasks],
  );

  const handleCreateTask = useCallback(async (data: CreateUserTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      message.success(t("toast.scheduler.taskCreated"));
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.createTaskFailed");
      message.error(errorMessage);
    }
  }, [createTaskMutation, t]);

  const handleUpdateTask = useCallback(async (data: CreateUserTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      message.success(t("toast.scheduler.taskUpdated"));
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.updateTaskFailed");
      message.error(errorMessage);
    }
  }, [editingTask, updateTaskMutation, t]);

  const handleDeleteTask = useCallback(async (task: UserTask) => {
    const confirmed = await asyncConfirm({
      title: t("scheduler.confirmDeleteTaskTitle"),
      message: t("scheduler.confirmDeleteTaskMessage", { title: task.title }),
      isDangerous: true,
    });
    if (!confirmed) return;
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      message.success(t("toast.scheduler.taskDeleted"));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.deleteTaskFailed");
      message.error(errorMessage);
    }
  }, [deleteTaskMutation, t]);

  const handleMoveTask = async (taskId: string, targetQueue: number) => {
    try {
      await moveTaskMutation.mutateAsync({ id: taskId, targetQueue });
      message.success(t("toast.scheduler.taskMoved", { queue: targetQueue }));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.moveTaskFailed");
      message.error(errorMessage);
    }
  };

  const handleReorder = (queueLevel: number) => async (taskIds: string[]) => {
    try {
      await reorderMutation.mutateAsync({ queueLevel, taskIds });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.reorderFailed");
      message.error(errorMessage);
    }
  };

  const fetchAndActivateFirstSubtask = useCallback(async (taskId: string) => {
    try {
      const subtaskList = await api.scheduler.getSubtasks(taskId);
      const firstPending = subtaskList.find(
        (s: TaskSubtask) => s.status === "pending" || s.status === "in_progress",
      );
      if (firstPending && firstPending.status === "pending") {
        await api.scheduler.updateSubtask(taskId, firstPending.id, {
          status: "in_progress",
        });
        setActiveSubtaskId(firstPending.id);
        useTimerStore.getState().setSubtask(firstPending.id);
      } else if (firstPending && firstPending.status === "in_progress") {
        setActiveSubtaskId(firstPending.id);
        useTimerStore.getState().setSubtask(firstPending.id);
      }
    } catch (err) {
      console.warn("Failed to activate subtask:", err);
    }
  }, []);

  const handleStartTask = useCallback(async (task: UserTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      message.success(t("toast.scheduler.taskStarted"));
      // 启动番茄钟计时器（使用专注时长，而非任务总时长）
      const { focusDuration } = useFocusStore.getState();
      useTimerStore.getState().start(task.id, focusDuration, task.queue_level);
      // 如果有子任务，自动激活第一个待做子任务
      const hasSubtasks =
        task.has_subtasks || (task.subtask_count ?? 0) > 0;
      if (hasSubtasks) {
        await fetchAndActivateFirstSubtask(task.id);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.startTaskFailed");
      message.error(errorMessage);
    }
  }, [startTaskMutation, t, fetchAndActivateFirstSubtask]);

  const handlePauseTask = useCallback(async (task: UserTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      message.success(t("toast.scheduler.taskPaused"));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.pauseTaskFailed");
      message.error(errorMessage);
    }
  }, [pauseTaskMutation, t]);

  const handleCompleteTask = useCallback(async (task: UserTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      message.success(t("toast.scheduler.taskCompleted"));
      triggerCelebration("task-completed");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("toast.scheduler.completeTaskFailed");
      message.error(errorMessage);
    }
  }, [completeTaskMutation, t, triggerCelebration]);

  const openAddTaskForm = (queueLevel: number = 2) => {
    setDefaultQueueLevel(queueLevel);
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const openEditTaskForm = useCallback((task: UserTask) => {
    setEditingTask(task);
    setShowTaskForm(true);
  }, []);

  const handleViewTaskDetail = useCallback((task: UserTask) => {
    navigate(`/scheduler/task/${task.id}`);
  }, [navigate]);

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
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/5 dark:bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
          <div className="px-3 sm:px-6 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30">
                    <Zap size={20} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary-500 via-primary-500 to-primary-500 dark:from-primary-400 dark:via-primary-400 dark:to-primary-400 bg-clip-text text-transparent">
                    {t("scheduler.title")}
                  </h1>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.pending")}
                  </span>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                    {stats.pending}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.inProgress")}
                  </span>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                    {stats.inProgress}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t("scheduler.completed")}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.completed}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
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
                  className="p-2.5 sm:flex sm:items-center sm:gap-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
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
                  className="flex items-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all min-h-[44px]"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline text-sm">
                    {t("scheduler.newTask")}
                  </span>
                </motion.button>

                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                >
                  <RefreshCw
                    size={16}
                    className={isFetching ? "animate-spin" : ""}
                  />
                </button>

                <ShortcutHint actionId="settings">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2.5 rounded-xl border transition-all min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${
                      showSettings
                        ? "bg-primary-100 dark:bg-primary-500/20 border-primary-300 dark:border-primary-500/50 text-primary-600 dark:text-primary-400"
                        : "bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <Settings size={16} />
                  </button>
                </ShortcutHint>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-2 mt-2 overflow-x-auto">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-xs text-slate-500">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-xs text-slate-500">
                  {stats.inProgress}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-slate-500">
                  {stats.completed}
                </span>
              </div>
            </div>

            {learningPaths.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-500">
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
                    className={`px-2.5 py-2 sm:py-0.5 rounded-lg text-xs font-medium transition-all min-h-[44px] sm:min-h-0 ${
                      !selectedPathId && !groupByPath
                        ? "bg-primary-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {t("scheduler.allTasks")}
                  </button>
                  {learningPaths.map((path: { id: string; title: string }) => (
                    <button
                      key={path.id}
                      onClick={() =>
                        setSelectedPathId(
                          selectedPathId === path.id ? null : path.id,
                        )
                      }
                      className={`px-2.5 py-2 sm:py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 min-h-[44px] sm:min-h-0 ${
                        selectedPathId === path.id
                          ? "bg-primary-500 text-white"
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
                    className={`px-2.5 py-2 sm:py-0.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 min-h-[44px] sm:min-h-0 ${
                      groupByPath
                        ? "bg-primary-500 text-white"
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

        <div ref={mainRef} role="region" aria-label={t("scheduler.regionLabel")} className="flex-1 min-h-0 flex flex-col p-3 sm:p-6">
          {isLoading && !isFetching ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-7xl mx-auto p-3 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
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
                        navigate(`/scheduler/task/${taskId}`);
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
                      activeSubtaskId={activeSubtaskId}
                      setActiveSubtaskId={setActiveSubtaskId}
                      onViewDetail={() =>
                        navigate(`/scheduler/task/${activeTask.id}`)
                      }
                      onStop={() => handlePauseTask(activeTask)}
                    />
                  </Suspense>
                </div>
              )}
              <div
                className="flex-1 min-h-0"
                role={currentView === "queue" ? "tabpanel" : undefined}
                id={currentView === "queue" ? "scheduler-view-panel-queue" : undefined}
                aria-labelledby={
                  currentView === "queue" ? "scheduler-view-tab-queue" : undefined
                }
                tabIndex={currentView === "queue" ? 0 : undefined}
              >
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
                        <div
                          role="tabpanel"
                          id="scheduler-view-panel-timeline"
                          aria-labelledby="scheduler-view-tab-timeline"
                          tabIndex={0}
                          className="h-full"
                        >
                          <Suspense fallback={<LoadingFallback />}>
                            <ErrorBoundary
                              fallbackRender={SectionErrorFallback}
                            >
                              <TimelineView
                                tasks={allTasks}
                                onTaskClick={openEditTaskForm}
                              />
                            </ErrorBoundary>
                          </Suspense>
                        </div>
                      ),
                      kanban: (
                        <div
                          role="tabpanel"
                          id="scheduler-view-panel-kanban"
                          aria-labelledby="scheduler-view-tab-kanban"
                          tabIndex={0}
                          className="h-full"
                        >
                          <Suspense fallback={<LoadingFallback />}>
                            <ErrorBoundary
                              fallbackRender={SectionErrorFallback}
                            >
                              <KanbanView
                                tasks={allTasks}
                                onTaskClick={openEditTaskForm}
                              />
                            </ErrorBoundary>
                          </Suspense>
                        </div>
                      ),
                      list: (
                        <div
                          role="tabpanel"
                          id="scheduler-view-panel-list"
                          aria-labelledby="scheduler-view-tab-list"
                          tabIndex={0}
                          className="h-full"
                        >
                          <Suspense fallback={<LoadingFallback />}>
                            <ErrorBoundary
                              fallbackRender={SectionErrorFallback}
                            >
                              <ListView
                                tasks={allTasks}
                                onEditTask={openEditTaskForm}
                                onDeleteTask={handleDeleteTask}
                                onStartTask={handleStartTask}
                                onPauseTask={handlePauseTask}
                                onCompleteTask={handleCompleteTask}
                              />
                            </ErrorBoundary>
                          </Suspense>
                        </div>
                      ),
                    }}
                  </HorizontalQueueView>
                </Suspense>
              </div>
            </div>
          )}
        </div>

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
                ref={settingsModalRef}
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
              {noDeadlineTasks.length > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={() => setShowNoDeadlineHint(!showNoDeadlineHint)}
                    className="flex items-center gap-1 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                  >
                    <Info size={12} />
                    <span>
                      {t("scheduler.timeline.noDeadline")} (
                      {noDeadlineTasks.length})
                    </span>
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>{t("scheduler.totalTasks", { count: stats.total })}</span>
            </div>
          </div>
          <AnimatePresence>
            {showNoDeadlineHint && noDeadlineTasks.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2"
              >
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  {noDeadlineTasks.slice(0, 10).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => openEditTaskForm(task)}
                      className="px-2 py-1 rounded-md bg-white dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors border border-slate-200 dark:border-slate-500 truncate max-w-[180px]"
                    >
                      {task.title}
                    </button>
                  ))}
                  {noDeadlineTasks.length > 10 && (
                    <span className="px-2 py-1 text-xs text-slate-400 self-center">
                      +{noDeadlineTasks.length - 10} {t("scheduler.more")}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
