import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Zap,
  Sparkles,
  BookOpen,
  Target,
  Brain,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  useSchedulerQueues,
  useSchedulerSettings,
  useTaskActions,
} from "../hooks";
import { TaskForm } from "../components/Scheduler/TaskForm";
import {
  QueueColumn,
  KnowledgePointCard,
  ReviewCard,
  KnowledgePointLinkModal,
  StudyProgressPanel,
  WorkbenchHeader,
} from "../components/Workbench";
import type { KnowledgePointWithStatus } from "../components/Workbench/KnowledgePointCard";
import { api } from "../services/api";
import { formatDate } from "@/utils/formatters";
import type {
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

interface TodayStats {
  totalStudyTime: number;
  completedTasks: number;
  reviewCompleted: number;
  streak: number;
}

export const UnifiedWorkbench: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getStatusLabel = useCallback((status: string): string => {
    switch (status) {
      case "pending":
        return t("unifiedWorkbench.status.pending");
      case "in_progress":
        return t("unifiedWorkbench.status.inProgress");
      case "paused":
        return t("unifiedWorkbench.status.paused");
      case "completed":
        return t("unifiedWorkbench.status.completed");
      case "cancelled":
        return t("unifiedWorkbench.status.cancelled");
      default:
        return t("unifiedWorkbench.status.pending");
    }
  }, [t]);

  const getUrgencyLabel = useCallback((urgency: string): string => {
    switch (urgency) {
      case "overdue":
        return t("unifiedWorkbench.status.overdue");
      case "today":
        return t("unifiedWorkbench.status.today");
      case "upcoming":
        return t("unifiedWorkbench.status.upcoming");
      case "future":
        return t("unifiedWorkbench.status.planned");
      default:
        return t("unifiedWorkbench.status.planned");
    }
  }, [t]);

  const {
    data: queuesData,
    isLoading: queuesLoading,
    error: queuesError,
    refetch: refetchQueues,
    isFetching: isFetchingQueues,
  } = useSchedulerQueues();
  const { data: settings } = useSchedulerSettings();

  const taskActions = useTaskActions(refetchQueues);

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

  const allTasks = useMemo(() => [...queues.q0, ...queues.q1, ...queues.q2], [queues]);

  const taskStats = useMemo(() => {
    const pending = allTasks.filter((t) => t.status === "pending").length;
    const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const totalEstimated = allTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    return { total: allTasks.length, pending, inProgress, completed, totalEstimated };
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
          const stats = statsResult as { total_tasks?: number; completed_tasks?: number; total_duration?: number };
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

  const formatDuration = useCallback((minutes: number) => {
    if (minutes === 0) return t("unifiedWorkbench.durations.zeroMinutes");
    if (minutes < 60) return t("unifiedWorkbench.durations.minutesWithValue", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0
      ? t("unifiedWorkbench.durations.hoursAndMinutes", { hours, minutes: mins })
      : t("unifiedWorkbench.durations.hoursOnly", { count: hours });
  }, [t]);

  const formatDeadline = useCallback((date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: t("unifiedWorkbench.status.overdue"), color: "text-red-500 dark:text-red-400" };
    if (days === 0) return { text: t("unifiedWorkbench.status.today"), color: "text-amber-500 dark:text-amber-400" };
    if (days === 1) return { text: t("unifiedWorkbench.status.tomorrow"), color: "text-yellow-500 dark:text-yellow-400" };
    if (days <= 7) return { text: t("unifiedWorkbench.status.daysLater", { count: days }), color: "text-primary-500 dark:text-primary-400" };
    return { text: formatDate(d, 'short'), color: "text-slate-500 dark:text-slate-400" };
  }, [t]);

  const handleKnowledgePointSearchChange = useCallback((value: string) => {
    taskActions.setKnowledgePointSearch(value);
    taskActions.searchKnowledgePoints(value);
  }, [taskActions]);

  const closeLinkModal = useCallback(() => {
    taskActions.setLinkingTaskId(null);
    taskActions.setKnowledgePointSearch("");
    taskActions.setSearchResults([]);
  }, [taskActions]);

  const queueColumnProps = {
    getStatusLabel,
    formatDuration,
    formatDeadline,
    onStartTask: taskActions.handleStartTask,
    onPauseTask: taskActions.handlePauseTask,
    onCompleteTask: taskActions.handleCompleteTask,
    onEditTask: taskActions.openEditTaskForm,
    onDeleteTask: taskActions.handleDeleteTask,
    onLinkKnowledgePoint: taskActions.setLinkingTaskId,
    onAddTask: taskActions.openAddTaskForm,
    onViewMore: () => navigate("/scheduler"),
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
        <WorkbenchHeader
          taskStats={taskStats}
          isFetchingQueues={isFetchingQueues}
          formatDuration={formatDuration}
          onNavigateScheduler={() => navigate("/scheduler")}
          onAddTask={() => taskActions.openAddTaskForm(2)}
          onRefetch={refetchQueues}
        />

        {queuesError && (
          <div className="flex-shrink-0 p-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400">
              <AlertCircle size={20} />
              <span>{t("unifiedWorkbench.messages.loadFailed", { message: (queuesError as Error).message })}</span>
              <button
                onClick={() => refetchQueues()}
                className="ml-auto text-sm underline hover:text-red-500 dark:hover:text-red-300"
              >
                {t("unifiedWorkbench.actions.retry")}
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
                    <p className="text-xs text-primary-500 dark:text-primary-400 font-medium">{t("unifiedWorkbench.labels.currentTask")}</p>
                    <h3 className="font-bold text-slate-900 dark:text-white">{activeTask.title}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => taskActions.handlePauseTask(activeTask)}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    {t("unifiedWorkbench.actions.pause")}
                  </button>
                  <button
                    onClick={() => taskActions.handleCompleteTask(activeTask)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    {t("unifiedWorkbench.actions.complete")}
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
                <p className="text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.messages.loadingWorkbench")}</p>
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
                        <h2 className="font-bold text-slate-900 dark:text-white">{t("unifiedWorkbench.labels.taskBoard")}</h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.feedbackQueue")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[calc(100%-52px)] grid grid-cols-3 gap-px bg-slate-200 dark:bg-slate-800">
                    <QueueColumn level={0} title={t("unifiedWorkbench.labels.urgentQueue")} tasks={queues.q0} timeSlice={timeSlices.q0} {...queueColumnProps} />
                    <QueueColumn level={1} title={t("unifiedWorkbench.labels.importantQueue")} tasks={queues.q1} timeSlice={timeSlices.q1} {...queueColumnProps} />
                    <QueueColumn level={2} title={t("unifiedWorkbench.labels.todoQueue")} tasks={queues.q2} timeSlice={timeSlices.q2} {...queueColumnProps} />
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
                        <h2 className="font-bold text-slate-900 dark:text-white">{t("unifiedWorkbench.labels.knowledgeOverview")}</h2>
                      </div>
                      <button
                        onClick={() => navigate("/graphs")}
                        className="text-xs text-primary-500 dark:text-primary-400 hover:underline flex items-center gap-1"
                      >
                        {t("unifiedWorkbench.actions.viewAll")}
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    <div className="mb-3">
                      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <Clock size={12} />
                        {t("unifiedWorkbench.labels.recentStudy")}
                      </h3>
                      {recentKnowledgePoints.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                          <BookOpen size={20} className="mb-2 opacity-50" />
                          <p className="text-xs">{t("unifiedWorkbench.tips.noRecentKnowledge")}</p>
                        </div>
                      ) : (
                        recentKnowledgePoints.map((kp) => (
                          <KnowledgePointCard key={kp.id} kp={kp} onClick={(id) => navigate(`/knowledge/${id}`)} />
                        ))
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <Brain size={12} />
                        {t("unifiedWorkbench.labels.toReviewKnowledge")}
                        {reviewStats && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px]">
                            {reviewStats.overdue + reviewStats.today}
                          </span>
                        )}
                      </h3>
                      {pendingReviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500">
                          <Brain size={20} className="mb-2 opacity-50" />
                          <p className="text-xs">{t("unifiedWorkbench.tips.noToReviewKnowledge")}</p>
                        </div>
                      ) : (
                        pendingReviews.map((review) => (
                          <ReviewCard key={review.id} review={review} getUrgencyLabel={getUrgencyLabel} onClick={() => navigate("/study")} />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <StudyProgressPanel
                  todayStats={todayStats}
                  reviewStats={reviewStats}
                  formatDuration={formatDuration}
                  onViewStats={() => navigate("/statistics")}
                />
              </div>
            </>
          )}
        </main>

        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/80 dark:bg-slate-900/30 backdrop-blur-sm px-3 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span>{t("unifiedWorkbench.tips.clickTaskHint")}</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">|</span>
              <span className="hidden sm:inline">{t("unifiedWorkbench.tips.quickCreateHint")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{t("unifiedWorkbench.labels.totalTasksValue", { count: taskStats.total })}</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {taskActions.showTaskForm && (
          <TaskForm
            task={taskActions.editingTask || undefined}
            onSubmit={taskActions.editingTask ? taskActions.handleUpdateTask : taskActions.handleCreateTask}
            onCancel={() => {
              taskActions.setShowTaskForm(false);
              taskActions.setEditingTask(null);
            }}
            defaultQueueLevel={taskActions.defaultQueueLevel}
          />
        )}
      </AnimatePresence>

      <KnowledgePointLinkModal
        linkingTaskId={taskActions.linkingTaskId}
        knowledgePointSearch={taskActions.knowledgePointSearch}
        searchResults={taskActions.searchResults}
        onSearchChange={handleKnowledgePointSearchChange}
        onLink={taskActions.handleLinkKnowledgePoint}
        onClose={closeLinkModal}
      />
    </div>
  );
};
