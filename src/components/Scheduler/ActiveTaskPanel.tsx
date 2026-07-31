import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Check,
  Clock,
  Zap,
  Target,
  ListTodo,
  Square,
} from "lucide-react";
import { UserTask, TaskSubtask } from "@shared/types";
import { api } from "../../services/api";
import { useTimerStore } from "../../store/useTimerStore";
import { useFocusStore } from "../../store/useFocusStore";
import { formatTimeFromSeconds } from "../../utils/formatters";

interface ActiveTaskPanelProps {
  task: UserTask;
  timeSlice: number;
  activeSubtaskId?: string | null;
  setActiveSubtaskId?: (id: string | null) => void;
  onViewDetail?: () => void;
  /** 终止当前任务调度，返回智能推荐界面 */
  onStop?: () => void;
}

const QUEUE_CONFIG = {
  0: {
    icon: Zap,
    gradient: "from-primary-500 to-primary-500",
    border: "border-primary-400",
    glow: "shadow-primary-500/20",
    bg: "bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-500/10 dark:to-primary-500/10",
    accentColor: "text-primary-600 dark:text-primary-400",
    ringColor: "ring-primary-500/30",
  },
  1: {
    icon: Target,
    gradient: "from-emerald-500 to-teal-500",
    border: "border-emerald-400",
    glow: "shadow-emerald-500/20",
    bg: "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    ringColor: "ring-emerald-500/30",
  },
  2: {
    icon: ListTodo,
    gradient: "from-amber-500 to-orange-500",
    border: "border-amber-400",
    glow: "shadow-amber-500/20",
    bg: "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10",
    accentColor: "text-amber-600 dark:text-amber-400",
    ringColor: "ring-amber-500/30",
  },
};

export const ActiveTaskPanel: React.FC<ActiveTaskPanelProps> = ({
  task,
  timeSlice: _timeSlice,
  activeSubtaskId,
  setActiveSubtaskId,
  onViewDetail,
  onStop,
}) => {
  const { t } = useTranslation();
  const config =
    QUEUE_CONFIG[task.queue_level as keyof typeof QUEUE_CONFIG] ||
    QUEUE_CONFIG[2];
  const IconComponent = config.icon;

  const timeLeft = useTimerStore((s) => s.timeLeft);
  const totalTime = useTimerStore((s) => s.totalTime);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const completedSessions = useTimerStore((s) => s.completedSessions);
  const progress = useTimerStore((s) => s.progress);
  const mode = useTimerStore((s) => s.mode);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);

  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [autoActivated, setAutoActivated] = useState(false);

  // 用 ref 保存最新 subtasks，避免回调闭包捕获旧值
  const subtasksRef = useRef(subtasks);
  useEffect(() => {
    subtasksRef.current = subtasks;
  }, [subtasks]);

  useEffect(() => {
    if (task.id) {
      api.scheduler
        .getSubtasks(task.id)
        .then((subtaskList: TaskSubtask[]) => {
          setSubtasks(subtaskList);
          // 如果还没有激活子任务，自动激活第一个 pending/in_progress 的
          if (!activeSubtaskId && !autoActivated && subtaskList.length > 0) {
            const first = subtaskList.find(
              (s: TaskSubtask) =>
                s.status === "pending" || s.status === "in_progress",
            );
            if (first) {
              setAutoActivated(true);
              setActiveSubtaskId?.(first.id);
              useTimerStore.getState().setSubtask(first.id);
              // 如果是 pending 状态，更新为 in_progress
              if (first.status === "pending") {
                api.scheduler
                  .updateSubtask(task.id, first.id, { status: "in_progress" })
                  .catch((err) => { console.error(err); });
              }
            }
          }
        })
        .catch((err) => { console.error(err); });
    }
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 注册 focus 番茄完成回调：自动保存当前子任务的 actual_duration
  useEffect(() => {
    useTimerStore.getState().setOnFocusSessionComplete((elapsedSeconds) => {
      if (!activeSubtaskId) return;
      const elapsedMinutes = Math.round(elapsedSeconds / 60);
      if (elapsedMinutes <= 0) return;

      // 从 ref 读最新数据（避免闭包旧值）
      const currentSt = subtasksRef.current.find(
        (s: TaskSubtask) => s.id === activeSubtaskId,
      );
      const prevDuration = currentSt?.actual_duration || 0;
      const newDuration = prevDuration + elapsedMinutes;

      // 更新本地 state
      setSubtasks((prev) =>
        prev.map((s) =>
          s.id === activeSubtaskId ? { ...s, actual_duration: newDuration } : s,
        ),
      );

      // 持久化到数据库
      api.scheduler
        .updateSubtask(task.id, activeSubtaskId, {
          actual_duration: newDuration,
        })
        .catch((err) => { console.error(err); });
    });

    return () => {
      useTimerStore.getState().setOnFocusSessionComplete(undefined);
    };
  }, [task.id, activeSubtaskId]);  

  const currentActiveSubtask = subtasks.find((s) => s.id === activeSubtaskId);
  const currentSubtaskIndex = activeSubtaskId
    ? subtasks.findIndex((s) => s.id === activeSubtaskId)
    : -1;
  const totalSubtasks = subtasks.length;

  const handlePauseResume = () => {
    if (isActive && !isPaused) {
      // 运行中 → 暂停
      pause();
    } else if (isActive && isPaused) {
      // 已暂停 → 恢复
      resume();
    } else {
      // 未启动（如 force reload 后）→ 用当前任务的 focusDuration 重新启动
      useTimerStore.getState().start(task.id, focusDuration, task.queue_level);
    }
  };

  const handleCompleteSubtask = async () => {
    if (!activeSubtaskId || !currentActiveSubtask) return;

    // 0. 先读取当前计时器状态（complete() 会重置它）
    const { timeLeft: tl, totalTime: tt } = useTimerStore.getState();
    const elapsedThisSession = Math.round((tt - tl) / 60);
    // 确保数值安全：从 DB 可能返回字符串或 null
    const prevDuration = Number(currentActiveSubtask.actual_duration || 0);
    const totalActualDuration = prevDuration + elapsedThisSession;

    // 1. 保存当前番茄的 focus_session
    await useTimerStore.getState().complete();

    // 2. 更新当前子任务 status + actual_duration
    try {
      await api.scheduler.updateSubtask(task.id, activeSubtaskId, {
        status: "completed",
        actual_duration: totalActualDuration,
      });
    } catch (err) {
      console.warn("Failed to complete subtask:", err);
    }

    // 3. 找下一个 pending 子任务
    let nextSubtask: TaskSubtask | null = null;
    try {
      const subtaskList = await api.scheduler.getSubtasks(task.id);
      nextSubtask = subtaskList.find((s) => s.status === "pending") ?? null;
    } catch (err) {
      console.warn("Failed to fetch subtasks:", err);
    }

    // 4. 如果有下一个子任务 → 激活它，等 break 结束后切换
    if (nextSubtask) {
      try {
        await api.scheduler.updateSubtask(task.id, nextSubtask.id, {
          status: "in_progress",
        });
      } catch (err) {
        console.warn("Failed to activate next subtask:", err);
      }
      setActiveSubtaskId?.(nextSubtask.id);
      useTimerStore.getState().setSubtask(nextSubtask.id);
    } else {
      // 5. 全部完成 → 标记大任务完成
      try {
        await api.scheduler.updateProgressPlanEntry(task.id, { percentage: 100 });
      } catch (err) {
        console.warn("Failed to mark task completed:", err);
      }
      setActiveSubtaskId?.(null);
      useTimerStore.getState().setSubtask(null);
      onStop?.(); // 触发面板消失
    }
  };

  // 番茄钟联动：任务总时长 → 预计番茄数
  const focusDuration = useFocusStore((s) => s.focusDuration);
  const estimatedMinutes = task.estimated_duration || 0;
  const totalPomodoros =
    estimatedMinutes > 0
      ? Math.max(1, Math.ceil(estimatedMinutes / focusDuration))
      : null;
  const currentPomodoro = completedSessions + 1;

  const learningStateLabels = useMemo(
    () =>
      ({
        learning: t("scheduler.activeTaskPanel.states.learning"),
        review: t("scheduler.activeTaskPanel.states.review"),
        practice: t("scheduler.activeTaskPanel.states.practice"),
        quiz: t("scheduler.activeTaskPanel.states.quiz"),
      }) as Record<string, string>,
    [t],
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`
          relative overflow-hidden rounded-2xl border-2 ${config.border} ${config.bg}
          shadow-lg ${config.glow} ring-2 ${config.ringColor}
          p-4 mb-4
        `}
      >
        <div
          className={`absolute top-0 left-0 h-1 bg-gradient-to-r ${config.gradient}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />

        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-4 ${onViewDetail ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
            onClick={(e) => {
              if (onViewDetail) {
                e.stopPropagation();
                onViewDetail();
              }
            }}
          >
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}
            >
              <IconComponent size={24} className="text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {currentActiveSubtask?.title || task.title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.accentColor} bg-white/50 dark:bg-slate-800/50`}
                >
                  Q{task.queue_level}
                </span>
              </div>
              {/* 副标题：大任务名 + 子任务进度 */}
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                {totalSubtasks > 0
                  ? t("scheduler.activeTaskPanel.subtitle", {
                      taskTitle: task.title,
                      subtaskProgress: `${currentSubtaskIndex >= 0 ? currentSubtaskIndex + 1 : "-"}/${totalSubtasks}`,
                    })
                  : task.title}
              </p>
              {/* 第三行信息：番茄数 + 预计时间 + 已做时间 */}
              {currentActiveSubtask && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {t("scheduler.activeTaskPanel.focusedOn", {
                    pomodoro: completedSessions + 1,
                  })}{" "}
                  {t("scheduler.activeTaskPanel.pomodoroUnit")} ·{" "}
                  {t("scheduler.activeTaskPanel.estimated", {
                    duration: currentActiveSubtask.estimated_duration || "-",
                  })}{" · "}
                  {t("scheduler.activeTaskPanel.done", {
                    duration:
                      (currentActiveSubtask.actual_duration || 0) +
                      (isActive && !isPaused && mode === "focus"
                        ? Math.round((totalTime - timeLeft) / 60)
                        : 0),
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className={config.accentColor} />
                <span
                  className={`text-2xl font-mono font-bold ${config.accentColor}`}
                >
                  {formatTimeFromSeconds(timeLeft)}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isActive && !isPaused
                  ? mode === "focus"
                    ? t("scheduler.activeTaskPanel.statusFocusing")
                    : t("scheduler.activeTaskPanel.statusBreak")
                  : timeLeft > 0
                    ? t("scheduler.activeTaskPanel.statusPaused")
                    : t("scheduler.activeTaskPanel.statusReady")}
                {totalPomodoros && (
                  <span className="ml-1.5">
                    {t("scheduler.activeTaskPanel.pomodoroIndex", {
                      current: currentPomodoro,
                      total: totalPomodoros,
                    })}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePauseResume}
                className={`
                  p-3 rounded-xl transition-all
                  ${
                    isActive && !isPaused
                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30"
                      : "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-500/30"
                  }
                `}
                title={
                  isActive && !isPaused
                    ? t("scheduler.activeTaskPanel.togglePause")
                    : t("scheduler.activeTaskPanel.toggleResume")
                }
              >
                {isActive && !isPaused ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  // 保存当前子任务的累计运行时长
                  if (activeSubtaskId && currentActiveSubtask) {
                    const { timeLeft: tl, totalTime: tt } =
                      useTimerStore.getState();
                    const elapsedMinutes = Math.round((tt - tl) / 60);
                    const totalActual =
                      (currentActiveSubtask.actual_duration || 0) +
                      elapsedMinutes;
                    if (totalActual > 0) {
                      api.scheduler
                        .updateSubtask(task.id, activeSubtaskId, {
                          actual_duration: totalActual,
                        })
                        .catch((err) => { console.error(err); });
                    }
                    // 同时更新大任务级别
                    if (elapsedMinutes > 0) {
                      api.scheduler
                        .tickExecution(task.id, elapsedMinutes)
                        .catch((err) => { console.error(err); });
                    }
                  }
                  useTimerStore.getState().reset();
                  onStop?.();
                }}
                className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                title={t('scheduler.activeTask.stopSchedule')}
                aria-label={t('scheduler.activeTask.stopSchedule')}
              >
                <Square size={16} fill="currentColor" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCompleteSubtask}
                className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                title={t('scheduler.activeTask.completeSubtask')}
                aria-label={t('scheduler.activeTask.completeSubtask')}
              >
                <Check size={20} />
              </motion.button>
            </div>
          </div>
        </div>

        {isActive && !isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 overflow-hidden"
            role="progressbar"
            aria-label={t('common.aria.taskProgress')}
            aria-valuenow={Math.min(Math.round(progress), 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className={`h-full bg-gradient-to-r ${config.gradient}`}
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        )}

        {/* 子任务区域 */}
        {activeSubtaskId && currentActiveSubtask && (
          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-500/60">
            {/* 当前活跃子任务 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {t("scheduler.activeTaskPanel.currentLabel", {
                    title: currentActiveSubtask.title,
                  })}
                </span>
                <span
                  className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    currentActiveSubtask.learning_state === "learning"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                      : currentActiveSubtask.learning_state === "review"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"
                        : currentActiveSubtask.learning_state === "practice"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
                          : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                  }`}
                >
                  {learningStateLabels[currentActiveSubtask.learning_state] ||
                    String(currentActiveSubtask.learning_state)}
                </span>
              </div>
              <button
                onClick={handleCompleteSubtask}
                className="shrink-0 px-3 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
              >
                {t("scheduler.activeTaskPanel.completeSubtask")}
              </button>
            </div>

            {/* 掌握度 — 基于实际已用时间/预计时间实时计算 */}
            {currentActiveSubtask && (
              <div className="mb-3">
                {(() => {
                  const estSec =
                    (currentActiveSubtask.estimated_duration || 0) * 60;
                  let actSec = (currentActiveSubtask.actual_duration || 0) * 60;
                  // 只在 focus 模式下累计当前番茄时间，休息不计入
                  if (isActive && !isPaused && mode === "focus") {
                    actSec += totalTime - timeLeft;
                  }
                  const rawPct = estSec > 0 ? (actSec / estSec) * 100 : 0;
                  const isOver = rawPct > 100;
                  const displayPct = Math.round(rawPct);
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400 dark:text-slate-500">
                          {t("scheduler.activeTaskPanel.mastery")}
                        </span>
                        <span
                          className={
                            isOver
                              ? "text-amber-500 dark:text-amber-400 font-medium"
                              : "text-slate-500 dark:text-slate-400"
                          }
                        >
                          {displayPct}%{isOver && ` ${t("scheduler.activeTaskPanel.overtime")}`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                        {/* 基础进度条（最多100%） */}
                        <div
                          className="h-full absolute inset-y-0 left-0 bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(rawPct, 100)}%` }}
                        />
                        {/* 超出部分（琥珀色） */}
                        {isOver && (
                          <div
                            className="h-full absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-r-full transition-all duration-1000"
                            style={{
                              width: `${rawPct}%`,
                              clipPath: `inset(0 ${100 - rawPct}% 0 0)`,
                            }}
                          />
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* 可折叠的子任务列表 */}
            <button
              onClick={() => setSubtasksExpanded(!subtasksExpanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span>
                {t("scheduler.activeTaskPanel.allSubtasks", {
                  completed: subtasks.filter((s) => s.status === "completed")
                    .length,
                  total: subtasks.length,
                })}
              </span>
              <svg aria-hidden="true"
                className={`w-3 h-3 transition-transform ${subtasksExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {subtasksExpanded && (
              <div className="mt-2.5 space-y-0.5 max-h-40 overflow-y-auto rounded-lg bg-white/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-500/50 p-1.5">
                {subtasks.map((st) => {
                  const isCurrent = st.id === activeSubtaskId;
                  const isCompleted = st.status === "completed";
                  let actualMin = st.actual_duration || 0;
                  if (isCurrent && isActive && !isPaused && mode === "focus") {
                    actualMin += Math.round((totalTime - timeLeft) / 60);
                  }
                  const estimatedMin = st.estimated_duration || 0;

                  return (
                    <div
                      key={st.id}
                      className={`group flex items-center gap-2.5 px-2 py-2 rounded-md text-xs transition-all ${
                        isCurrent
                          ? "bg-primary-50/80 dark:bg-primary-500/10 shadow-sm ring-1 ring-primary-200/60 dark:ring-primary-500/20"
                          : isCompleted
                            ? "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      {/* 状态指示器 */}
                      <span className="shrink-0">
                        {isCompleted ? (
                          <svg aria-hidden="true"
                            className="w-4 h-4 text-emerald-500"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <circle cx="8" cy="8" r="7" fill="currentColor" />
                            <path
                              d="M5 8l2 2 4-4"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : isCurrent ? (
                          <span className="relative flex h-4 w-4 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-40" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-slate-900" />
                          </span>
                        ) : (
                          <svg aria-hidden="true"
                            className="w-4 h-4 text-slate-300 dark:text-slate-600"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeDasharray="2.5 2"
                            />
                          </svg>
                        )}
                      </span>

                      {/* 标题 */}
                      <span
                        className={`truncate flex-1 min-w-0 font-medium ${
                          isCompleted ? "line-through" : ""
                        } ${isCurrent ? "text-primary-700 dark:text-primary-300" : ""}`}
                      >
                        {st.title}
                      </span>

                      {/* 进行中标记 — 仅 focus 模式显示 */}
                      {isCurrent &&
                        isActive &&
                        !isPaused &&
                        mode === "focus" && (
                          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-primary-500">
                            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                            {t("scheduler.activeTaskPanel.inProgress")}
                          </span>
                        )}

                      {/* 学习状态标签 */}
                      {typeof st.learning_state === "string" && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            st.learning_state === "learning"
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                              : st.learning_state === "review"
                                ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                                : st.learning_state === "practice"
                                  ? "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400"
                                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                          }`}
                        >
                          {learningStateLabels[st.learning_state] ||
                            String(st.learning_state)}
                        </span>
                      )}

                      {/* 时间信息 */}
                      <span className="shrink-0 tabular-nums text-[11px] opacity-60">
                        {actualMin > 0 ? `${actualMin}m` : "-"}
                        <span className="mx-0.5 opacity-40">/</span>
                        {estimatedMin > 0 ? `${estimatedMin}m` : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
