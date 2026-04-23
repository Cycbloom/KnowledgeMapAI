import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  RefreshCw,
  Clock,
  Zap,
  AlertCircle,
  Sparkles,
  BookOpen,
  Target,
  TrendingUp,
  Brain,
  Link2,
  CheckCircle2,
  Calendar,
  Layers,
  BarChart3,
  ChevronRight,
  Timer,
  Flame,
} from "lucide-react";
import {
  useSchedulerQueues,
  useCreateScheduledTaskMutation,
  useUpdateScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
  useStartScheduledTaskMutation,
  usePauseScheduledTaskMutation,
  useCompleteScheduledTaskMutation,
  useSchedulerSettings,
} from "../hooks";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { TaskForm } from "../components/Scheduler/TaskForm";
import { api } from "../services/api";
import type {
  ScheduledTask,
  CreateScheduledTaskData,
  QueueData,
  PendingReviewTask,
  ReviewTaskStats,
  KnowledgePoint,
} from "@shared/types";

const DEFAULT_TIME_SLICES = {
  q0: 25,
  q1: 45,
  q2: 90,
};

const QueueDataDefault: QueueData = { q0: [], q1: [], q2: [] };

interface KnowledgePointWithStatus extends KnowledgePoint {
  lastStudiedAt?: string;
  studyCount?: number;
  masteryLevel?: number;
}

interface TodayStats {
  totalStudyTime: number;
  completedTasks: number;
  reviewCompleted: number;
  streak: number;
}

const QUEUE_COLORS = {
  0: {
    border: "border-primary-300 dark:border-primary-400",
    glow: "shadow-primary-500/30",
    bg: "bg-primary-100 dark:bg-primary-500/10",
    text: "text-primary-600 dark:text-primary-400",
    badge: "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
    accent: "bg-primary-500",
  },
  1: {
    border: "border-secondary-300 dark:border-secondary-400",
    glow: "shadow-secondary-500/30",
    bg: "bg-secondary-100 dark:bg-secondary-500/10",
    text: "text-secondary-600 dark:text-secondary-400",
    badge: "bg-secondary-100 text-secondary-700 dark:bg-secondary-500/20 dark:text-secondary-300",
    accent: "bg-secondary-500",
  },
  2: {
    border: "border-tertiary-300 dark:border-tertiary-400",
    glow: "shadow-tertiary-500/30",
    bg: "bg-tertiary-100 dark:bg-tertiary-500/10",
    text: "text-tertiary-600 dark:text-tertiary-400",
    badge: "bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-500/20 dark:text-tertiary-300",
    accent: "bg-tertiary-500",
  },
};

const STATUS_CONFIG = {
  pending: {
    label: "待处理",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
  },
  in_progress: {
    label: "进行中",
    color: "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400",
  },
  paused: {
    label: "已暂停",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  },
  completed: {
    label: "已完成",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  cancelled: {
    label: "已取消",
    color: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  },
};

const URGENCY_CONFIG = {
  overdue: {
    label: "已过期",
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/20",
  },
  today: {
    label: "今天",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
  },
  upcoming: {
    label: "即将到期",
    color: "text-primary-500 dark:text-primary-400",
    bg: "bg-primary-100 dark:bg-primary-500/20",
  },
  future: {
    label: "计划中",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
  },
};

export const UnifiedWorkbench: React.FC = () => {
  const navigate = useNavigate();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [defaultQueueLevel, setDefaultQueueLevel] = useState<number>(2);
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [knowledgePointSearch, setKnowledgePointSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgePoint[]>([]);

  const {
    data: queuesData,
    isLoading: queuesLoading,
    error: queuesError,
    refetch: refetchQueues,
    isFetching: isFetchingQueues,
  } = useSchedulerQueues();
  const { data: settings } = useSchedulerSettings();

  const createTaskMutation = useCreateScheduledTaskMutation();
  const updateTaskMutation = useUpdateScheduledTaskMutation();
  const deleteTaskMutation = useDeleteScheduledTaskMutation();
  const startTaskMutation = useStartScheduledTaskMutation();
  const pauseTaskMutation = usePauseScheduledTaskMutation();
  const completeTaskMutation = useCompleteScheduledTaskMutation();

  const [reviewStats, setReviewStats] = useState<ReviewTaskStats | null>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewTask[]>([]);
  const [recentKnowledgePoints, setRecentKnowledgePoints] = useState<KnowledgePointWithStatus[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalStudyTime: 0,
    completedTasks: 0,
    reviewCompleted: 0,
    streak: 0,
  });

  const queues = useMemo(() => {
    if (!queuesData || typeof queuesData !== "object") return QueueDataDefault;
    const actualData = (queuesData as unknown as { data?: QueueData }).data || queuesData;
    const queueData = actualData as QueueData;
    return {
      q0: Array.isArray(queueData.q0) ? queueData.q0 : [],
      q1: Array.isArray(queueData.q1) ? queueData.q1 : [],
      q2: Array.isArray(queueData.q2) ? queueData.q2 : [],
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

  const taskStats = useMemo(() => {
    const pending = allTasks.filter((t) => t.status === "pending").length;
    const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
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

  const activeTask = useMemo(() => {
    return allTasks.find((t) => t.status === "in_progress") || null;
  }, [allTasks]);

  React.useEffect(() => {
    const loadReviewData = async () => {
      try {
        const [statsResult, pendingResult] = await Promise.all([
          api.scheduler.getReviewTaskStats(),
          api.scheduler.getPendingReviewTasks(5),
        ]);
        if (statsResult) setReviewStats(statsResult as ReviewTaskStats);
        if (pendingResult && Array.isArray(pendingResult)) {
          setPendingReviews(pendingResult as PendingReviewTask[]);
        }
      } catch (err) {
        console.error("Failed to load review data:", err);
      }
    };

    const loadRecentKnowledgePoints = async () => {
      try {
        const result = await api.knowledgePoints.list();
        if (result && Array.isArray(result)) {
          const sorted = (result as KnowledgePoint[])
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 5);
          setRecentKnowledgePoints(sorted.map(kp => ({
            ...kp,
            lastStudiedAt: kp.updated_at,
            studyCount: 1,
            masteryLevel: 0.5,
          })));
        }
      } catch (err) {
        console.error("Failed to load knowledge points:", err);
      }
    };

    const loadTodayStats = async () => {
      try {
        const statsResult = await api.scheduler.getStats("day");
        if (statsResult) {
          const stats = statsResult as {
            total_tasks?: number;
            completed_tasks?: number;
            total_duration?: number;
          };
          setTodayStats({
            totalStudyTime: stats.total_duration || 0,
            completedTasks: stats.completed_tasks || 0,
            reviewCompleted: 0,
            streak: 0,
          });
        }
      } catch (err) {
        console.error("Failed to load today stats:", err);
      }
    };

    loadReviewData();
    loadRecentKnowledgePoints();
    loadTodayStats();
  }, []);

  const handleCreateTask = async (data: CreateScheduledTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      frontendEventBus.publish("message_show", { type: "success", content: "任务创建成功" });
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "创建任务失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleUpdateTask = async (data: CreateScheduledTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      frontendEventBus.publish("message_show", { type: "success", content: "任务更新成功" });
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "更新任务失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleDeleteTask = async (task: ScheduledTask) => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已删除" });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "删除任务失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleStartTask = async (task: ScheduledTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已开始" });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "开始任务失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handlePauseTask = async (task: ScheduledTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已暂停" });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "暂停任务失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleCompleteTask = async (task: ScheduledTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: "任务已完成" });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "完成任务失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
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

  const handleLinkKnowledgePoint = async (taskId: string, knowledgePointId: string) => {
    try {
      await api.scheduler.addTaskKnowledgePoint(taskId, {
        knowledge_point_id: knowledgePointId,
      });
      frontendEventBus.publish("message_show", { type: "success", content: "知识点关联成功" });
      setLinkingTaskId(null);
      setKnowledgePointSearch("");
      setSearchResults([]);
      refetchQueues();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "关联知识点失败";
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const searchKnowledgePoints = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const result = await api.knowledgePoints.searchSimilar({ query, limit: 5 });
      if (result && Array.isArray(result)) {
        setSearchResults(result as unknown as KnowledgePoint[]);
      }
    } catch (err) {
      console.error("Failed to search knowledge points:", err);
    }
  }, []);

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return "0分钟";
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const formatDeadline = (date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: "已过期", color: "text-red-500 dark:text-red-400" };
    if (days === 0) return { text: "今天", color: "text-amber-500 dark:text-amber-400" };
    if (days === 1) return { text: "明天", color: "text-yellow-500 dark:text-yellow-400" };
    if (days <= 7) return { text: `${days}天后`, color: "text-primary-500 dark:text-primary-400" };
    return { text: d.toLocaleDateString(), color: "text-slate-500 dark:text-slate-400" };
  };

  const renderTaskCard = (task: ScheduledTask, queueLevel: number) => {
    const queueStyle = QUEUE_COLORS[queueLevel as keyof typeof QUEUE_COLORS] || QUEUE_COLORS[0];
    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const deadlineInfo = formatDeadline(task.deadline);

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`
          group relative rounded-xl border transition-all duration-200
          ${queueStyle.border} hover:shadow-lg
          bg-white dark:bg-slate-900/80 backdrop-blur-sm
          overflow-hidden
        `}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${queueStyle.accent}`} />

        <div className="p-3 pl-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${queueStyle.badge}`}>
              Q{task.queue_level}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            {task.priority >= 3 && (
              <span className="text-red-500 dark:text-red-400 text-xs">★</span>
            )}
          </div>

          <h4 className="font-medium text-slate-900 dark:text-white mb-1 truncate pr-2">
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
            {task.estimated_duration && (
              <div className="flex items-center gap-1">
                <Clock size={12} className={queueStyle.text} />
                <span>{formatDuration(task.estimated_duration)}</span>
              </div>
            )}

            {deadlineInfo && (
              <div className="flex items-center gap-1">
                <Calendar size={12} className={deadlineInfo.color} />
                <span className={deadlineInfo.color}>{deadlineInfo.text}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status === "pending" && (
              <button
                onClick={() => handleStartTask(task)}
                className={`p-1.5 rounded-md transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
                title="开始"
              >
                <Zap size={14} />
              </button>
            )}

            {task.status === "in_progress" && (
              <button
                onClick={() => handlePauseTask(task)}
                className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all hover:scale-110"
                title="暂停"
              >
                <Clock size={14} />
              </button>
            )}

            {(task.status === "pending" || task.status === "in_progress" || task.status === "paused") && (
              <button
                onClick={() => handleCompleteTask(task)}
                className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-110"
                title="完成"
              >
                <CheckCircle2 size={14} />
              </button>
            )}

            <button
              onClick={() => openEditTaskForm(task)}
              className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all hover:scale-110"
              title="编辑"
            >
              <Target size={14} />
            </button>

            <button
              onClick={() => setLinkingTaskId(task.id)}
              className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:scale-110"
              title="关联知识点"
            >
              <Link2 size={14} />
            </button>

            <button
              onClick={() => handleDeleteTask(task)}
              className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110"
              title="删除"
            >
              <AlertCircle size={14} />
            </button>
          </div>
        </div>

        {task.status === "in_progress" && (
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${queueStyle.bg} overflow-hidden`}>
            <motion.div
              className={`h-full ${queueStyle.accent}`}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        )}
      </motion.div>
    );
  };

  const renderQueueColumn = (level: number, title: string, tasks: ScheduledTask[]) => {
    const queueStyle = QUEUE_COLORS[level as keyof typeof QUEUE_COLORS] || QUEUE_COLORS[0];
    const timeSlice = timeSlices[`q${level}` as keyof typeof timeSlices];

    return (
      <div className="flex flex-col h-full">
        <div className={`flex-shrink-0 p-3 rounded-t-xl ${queueStyle.bg} border-b ${queueStyle.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-slate-900 dark:text-white`}>{title}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{tasks.length} 个任务</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Timer size={12} />
              <span>{timeSlice}分钟</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
              <Layers size={24} className="mb-2 opacity-50" />
              <p className="text-xs">暂无任务</p>
            </div>
          ) : (
            tasks.slice(0, 5).map((task) => renderTaskCard(task, level))
          )}
          {tasks.length > 5 && (
            <button
              onClick={() => navigate("/scheduler")}
              className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors flex items-center justify-center gap-1"
            >
              查看更多 {tasks.length - 5} 个任务
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        <div className="flex-shrink-0 p-2 border-t border-slate-200 dark:border-slate-800/50">
          <button
            onClick={() => openAddTaskForm(level)}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${queueStyle.bg} ${queueStyle.text} hover:opacity-80`}
          >
            <Plus size={14} />
            添加任务
          </button>
        </div>
      </div>
    );
  };

  const renderKnowledgePointCard = (kp: KnowledgePointWithStatus) => {
    return (
      <motion.div
        key={kp.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="group p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all cursor-pointer"
        onClick={() => navigate(`/knowledge/${kp.id}`)}
      >
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
            <BookOpen size={14} className="text-primary-500 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {kp.title}
            </h4>
            {kp.content && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                {kp.content}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span>最近学习</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderReviewCard = (review: PendingReviewTask) => {
    const urgencyConfig = URGENCY_CONFIG[review.urgency] || URGENCY_CONFIG.future;

    return (
      <motion.div
        key={review.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="group p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all cursor-pointer"
        onClick={() => navigate("/study")}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${urgencyConfig.bg} ${urgencyConfig.color}`}>
                {urgencyConfig.label}
              </span>
            </div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
              知识点复习
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Brain size={10} />
                <span>间隔: {review.interval_days}天</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp size={10} />
                <span>EF: {review.ease_factor.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
        </div>
      </motion.div>
    );
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
          <div className="px-3 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3"
                >
                  <div className="relative">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30">
                      <Layers size={24} className="text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-500 via-primary-500 to-pink-500 dark:from-primary-400 dark:via-primary-400 dark:to-pink-400 bg-clip-text text-transparent">
                      统一工作台
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      任务调度 · 知识管理 · 学习进度
                    </p>
                  </div>
                </motion.div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/scheduler")}
                  className="p-2.5 sm:flex sm:items-center sm:gap-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  <Zap size={18} />
                  <span className="hidden sm:inline">任务调度器</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openAddTaskForm(2)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">新建任务</span>
                </motion.button>

                <button
                  onClick={() => {
                    refetchQueues();
                  }}
                  disabled={isFetchingQueues}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50 min-h-[44px] min-w-[44px]"
                >
                  <RefreshCw
                    size={18}
                    className={isFetchingQueues ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">待处理</span>
                <span className="text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400">{taskStats.pending}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">进行中</span>
                <span className="text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400">{taskStats.inProgress}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">已完成</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">{taskStats.completed}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Clock size={14} className="text-slate-400" />
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">预计时长</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{formatDuration(taskStats.totalEstimated)}</span>
              </div>
            </div>
          </div>
        </header>

        {queuesError && (
          <div className="flex-shrink-0 p-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400">
              <AlertCircle size={20} />
              <span>加载失败: {(queuesError as Error).message}</span>
              <button
                onClick={() => refetchQueues()}
                className="ml-auto text-sm underline hover:text-red-500 dark:hover:text-red-300"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {activeTask && (
          <div className="flex-shrink-0 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800/50">
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary-500/10 to-primary-500/10 dark:from-primary-500/20 dark:to-primary-500/20 border border-primary-200 dark:border-primary-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-500/20">
                    <Zap size={20} className="text-primary-500 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-xs text-primary-500 dark:text-primary-400 font-medium">当前任务</p>
                    <h3 className="font-bold text-slate-900 dark:text-white">{activeTask.title}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePauseTask(activeTask)}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    暂停
                  </button>
                  <button
                    onClick={() => handleCompleteTask(activeTask)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    完成
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-h-0 flex flex-col p-3 sm:p-6 gap-3 sm:gap-6">
          {queuesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary-500/30 rounded-full animate-spin border-t-primary-500" />
                  <Sparkles
                    size={24}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500 dark:text-primary-400"
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400">加载工作台...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-shrink-0 h-[45%] min-h-[280px]">
                <div className="h-full rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary-500/20">
                          <Target size={16} className="text-primary-500 dark:text-primary-400" />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-white">任务看板</h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400">三层反馈队列</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[calc(100%-52px)] grid grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800">
                    {renderQueueColumn(0, "紧急队列", queues.q0)}
                    {renderQueueColumn(1, "重要队列", queues.q1)}
                    {renderQueueColumn(2, "待办队列", queues.q2)}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
                <div className="min-h-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
                  <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary-500/20">
                          <BookOpen size={16} className="text-primary-500 dark:text-primary-400" />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-white">知识图谱概览</h2>
                      </div>
                      <button
                        onClick={() => navigate("/graphs")}
                        className="text-xs text-primary-500 dark:text-primary-400 hover:underline flex items-center gap-1"
                      >
                        查看全部
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    <div className="mb-3">
                      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <Clock size={12} />
                        最近学习
                      </h3>
                      {recentKnowledgePoints.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                          <BookOpen size={20} className="mb-2 opacity-50" />
                          <p className="text-xs">暂无最近学习的知识点</p>
                        </div>
                      ) : (
                        recentKnowledgePoints.map((kp) => renderKnowledgePointCard(kp))
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <Brain size={12} />
                        待复习知识点
                        {reviewStats && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px]">
                            {reviewStats.overdue + reviewStats.today}
                          </span>
                        )}
                      </h3>
                      {pendingReviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                          <Brain size={20} className="mb-2 opacity-50" />
                          <p className="text-xs">暂无待复习知识点</p>
                        </div>
                      ) : (
                        pendingReviews.map((review) => renderReviewCard(review))
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
                  <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20">
                          <BarChart3 size={16} className="text-emerald-500 dark:text-emerald-400" />
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-white">学习进度</h2>
                      </div>
                      <button
                        onClick={() => navigate("/statistics")}
                        className="text-xs text-emerald-500 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        详细统计
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-500/10 dark:from-primary-500/20 dark:to-primary-500/20 border border-primary-200 dark:border-primary-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Timer size={14} className="text-primary-500 dark:text-primary-400" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">今日学习</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatDuration(todayStats.totalStudyTime)}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-200 dark:border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">完成任务</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {todayStats.completedTasks}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/10 to-pink-500/10 dark:from-primary-500/20 dark:to-pink-500/20 border border-primary-200 dark:border-primary-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain size={14} className="text-primary-500 dark:text-primary-400" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">复习完成</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {todayStats.reviewCompleted}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-200 dark:border-amber-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame size={14} className="text-amber-500 dark:text-amber-400" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">连续天数</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {todayStats.streak} 天
                        </p>
                      </div>
                    </div>

                    {reviewStats && (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                          <TrendingUp size={12} />
                          复习任务进度
                        </h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-red-500 dark:text-red-400">已过期</span>
                            <span className="font-bold text-slate-900 dark:text-white">{reviewStats.overdue}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-amber-500 dark:text-amber-400">今日待复习</span>
                            <span className="font-bold text-slate-900 dark:text-white">{reviewStats.today}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-primary-500 dark:text-primary-400">即将到期</span>
                            <span className="font-bold text-slate-900 dark:text-white">{reviewStats.upcoming}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-emerald-500 dark:text-emerald-400">计划中</span>
                            <span className="font-bold text-slate-900 dark:text-white">{reviewStats.future}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/80 dark:bg-slate-900/30 backdrop-blur-sm px-3 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span>点击任务卡片可查看详情和关联知识点</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">|</span>
              <span className="hidden sm:inline">支持快速创建任务和关联知识点</span>
            </div>
            <div className="flex items-center gap-2">
              <span>总任务: {taskStats.total}</span>
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

      <AnimatePresence>
        {linkingTaskId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => {
              setLinkingTaskId(null);
              setKnowledgePointSearch("");
              setSearchResults([]);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 size={18} className="text-primary-500 dark:text-primary-400" />
                    <h3 className="font-bold text-slate-900 dark:text-white">关联知识点</h3>
                  </div>
                  <button
                    onClick={() => {
                      setLinkingTaskId(null);
                      setKnowledgePointSearch("");
                      setSearchResults([]);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="relative">
                  <input
                    type="text"
                    value={knowledgePointSearch}
                    onChange={(e) => {
                      setKnowledgePointSearch(e.target.value);
                      searchKnowledgePoints(e.target.value);
                    }}
                    placeholder="搜索知识点..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <BookOpen size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="mt-4 max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                  {searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                      <BookOpen size={24} className="mb-2 opacity-50" />
                      <p className="text-sm">输入关键词搜索知识点</p>
                    </div>
                  ) : (
                    searchResults.map((kp) => (
                      <button
                        key={kp.id}
                        onClick={() => handleLinkKnowledgePoint(linkingTaskId, kp.id)}
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all text-left"
                      >
                        <h4 className="font-medium text-slate-900 dark:text-white">{kp.title}</h4>
                        {kp.content && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {kp.content}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
