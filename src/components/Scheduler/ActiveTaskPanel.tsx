import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Check, Clock, Zap, Target, ListTodo } from "lucide-react";
import { UserTask } from "@shared/types";
import { api } from "../../services/api";
import { useTimerStore } from "../../store/useTimerStore";
import { useFocusStore } from "../../store/useFocusStore";

interface ActiveTaskPanelProps {
  task: UserTask;
  onPause: () => void;
  timeSlice: number;
  activeSubtaskId?: string | null;
  onSubtaskComplete?: (subtaskId: string) => void;
  onViewDetail?: () => void;
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
  onPause,
  timeSlice: _timeSlice,
  activeSubtaskId,
  onSubtaskComplete,
  onViewDetail,
}) => {
  const config =
    QUEUE_CONFIG[task.queue_level as keyof typeof QUEUE_CONFIG] ||
    QUEUE_CONFIG[2];
  const IconComponent = config.icon;

  const timeLeft = useTimerStore((s) => s.timeLeft);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const completedSessions = useTimerStore((s) => s.completedSessions);
  const progress = useTimerStore((s) => s.progress);
  const mode = useTimerStore((s) => s.mode);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);

  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  useEffect(() => {
    if (task.id) {
      api.scheduler
        .getSubtasks(task.id)
        .then((res: any) => {
          if (res.data) setSubtasks(res.data);
        })
        .catch(() => {});
    }
  }, [task.id]);

  const currentActiveSubtask = subtasks.find((s) => s.id === activeSubtaskId);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePauseResume = () => {
    if (isActive) {
      pause();
    } else {
      resume();
    }
    onPause();
  };

  const handleComplete = async () => {
    // timerService.complete() 现在会：
    // 1. 保存 focus_session
    // 2. 递增 completedSessions
    // 3. 自动切换到下一模式（focus→break 或 break→focus）
    // 4. 保留 taskId
    await useTimerStore.getState().complete();

    // 如果有活跃子任务，同时完成子任务
    if (activeSubtaskId && currentActiveSubtask && onSubtaskComplete) {
      onSubtaskComplete(currentActiveSubtask.id);
    }
  };

  // 番茄钟联动：任务总时长 → 预计番茄数
  const { focusDuration } = useFocusStore();
  const estimatedMinutes = task.estimated_duration || 0;
  const totalPomodoros =
    estimatedMinutes > 0
      ? Math.max(1, Math.ceil(estimatedMinutes / focusDuration))
      : null;
  const currentPomodoro = completedSessions + (isActive && !isPaused ? 1 : 0);

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
                  {task.title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.accentColor} bg-white/50 dark:bg-slate-800/50`}
                >
                  Q{task.queue_level}
                </span>
              </div>
              {task.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {task.description}
                </p>
              )}
              {/* 子任务进度概览 - 始终显示 */}
              {subtasks.length > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  子任务：
                  <span className={config.accentColor}>
                    {subtasks.filter((s) => s.status === "completed").length}
                  </span>
                  /{subtasks.length}
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
                  {formatTime(timeLeft)}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isActive
                  ? mode === "focus"
                    ? "专注中..."
                    : "休息中..."
                  : timeLeft > 0
                    ? "已暂停"
                    : "准备开始"}
                {totalPomodoros && (
                  <span className="ml-1.5">
                    · 第{" "}
                    <span className={config.accentColor}>
                      {currentPomodoro}
                    </span>
                    /{totalPomodoros} 番茄
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
                    isActive
                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30"
                      : "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-500/30"
                  }
                `}
                title={isActive ? "暂停" : "继续"}
              >
                {isActive ? <Pause size={20} /> : <Play size={20} />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleComplete}
                className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                title={activeSubtaskId ? "完成此子任务" : "完成番茄"}
              >
                <Check size={20} />
              </motion.button>
            </div>
          </div>
        </div>

        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 overflow-hidden"
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
          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
            {/* 当前活跃子任务 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  当前：{currentActiveSubtask.title}
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
                  {(
                    {
                      learning: "学习",
                      review: "复习",
                      practice: "练习",
                      quiz: "测验",
                    } as Record<string, string>
                  )[currentActiveSubtask.learning_state] ||
                    currentActiveSubtask.learning_state}
                </span>
              </div>
              <button
                onClick={() => {
                  if (onSubtaskComplete)
                    onSubtaskComplete(currentActiveSubtask.id);
                }}
                className="shrink-0 px-3 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
              >
                完成此子任务
              </button>
            </div>

            {/* 掌握度 */}
            {currentActiveSubtask.mastery_level !== undefined && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 dark:text-slate-500">
                    掌握度
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {Math.round(
                      (currentActiveSubtask.mastery_level || 0) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round((currentActiveSubtask.mastery_level || 0) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 可折叠的子任务列表 */}
            <button
              onClick={() => setSubtasksExpanded(!subtasksExpanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span>
                全部子任务 (
                {subtasks.filter((s) => s.status === "completed").length}/
                {subtasks.length})
              </span>
              <svg
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
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      st.id === activeSubtaskId
                        ? "bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300"
                        : st.status === "completed"
                          ? "text-slate-400 line-through"
                          : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {st.status === "completed" ? (
                      <svg
                        className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          st.id === activeSubtaskId
                            ? "bg-primary-500 animate-pulse"
                            : "bg-slate-300"
                        }`}
                      />
                    )}
                    <span className="truncate">{st.title}</span>
                    <span className="ml-auto shrink-0 opacity-60">
                      {(
                        {
                          learning: "学",
                          review: "复",
                          practice: "练",
                          quiz: "测",
                        } as Record<string, string>
                      )[st.learning_state] || ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
