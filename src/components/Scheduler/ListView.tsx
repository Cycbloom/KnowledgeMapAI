import React, {
  useState,
  useMemo,
  useId,
  useRef,
  useCallback,
  useEffect,
  memo,
  forwardRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Clock,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Play,
  Pause,
  Check,
  Edit2,
  Trash2,
  BookOpen,
  Circle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserTask, TaskSubtask, LearningState } from "@shared/types";
import { QUEUE_COLORS, STATUS_CONFIG, type QueueLevel } from "@/constants/scheduler";
import { api } from "../../services/api";
import { LearningStateBadge } from "./LearningStateBadge";
import { MasteryProgressBar } from "./MasteryProgressBar";
import { formatDate as formatDateUtil } from "../../utils/formatters";
import { useDebouncedSearch } from "../../hooks/common/useDebouncedSearch";
import { useReducedMotionOrPreference } from "../../hooks/common/useReducedMotionOrPreference";

interface ListViewProps {
  tasks: UserTask[];
  onTaskClick?: (task: UserTask) => void;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onSubtaskUpdate?: () => void;
}

type SortField =
  | "title"
  | "status"
  | "queue_level"
  | "priority"
  | "deadline"
  | "created_at"
  | "estimated_duration";
type SortDirection = "asc" | "desc";

const SUBTASK_TYPE_COLORS: Record<LearningState, { bg: string; text: string }> =
  {
    learning: {
      bg: "bg-blue-100 dark:bg-blue-500/20",
      text: "text-blue-600 dark:text-blue-400",
    },
    review: {
      bg: "bg-green-100 dark:bg-green-500/20",
      text: "text-green-600 dark:text-green-400",
    },
    practice: {
      bg: "bg-orange-100 dark:bg-orange-500/20",
      text: "text-orange-600 dark:text-orange-400",
    },
    quiz: {
      bg: "bg-purple-100 dark:bg-purple-500/20",
      text: "text-purple-600 dark:text-purple-400",
    },
  };

// ─── 虚拟化常量 ──────────────────────────────────────────────────────────────
const DEFAULT_ROW_HEIGHT = 64;
const DEFAULT_CARD_HEIGHT = 130;
const DESKTOP_OVERSCAN = 8;
const MOBILE_OVERSCAN = 5;

function getSubtaskTypeStats(
  subtasks: TaskSubtask[],
): Record<LearningState, number> {
  const stats: Record<LearningState, number> = {
    learning: 0,
    review: 0,
    practice: 0,
    quiz: 0,
  };
  subtasks.forEach((st) => {
    stats[st.learning_state]++;
  });
  return stats;
}

function getAverageMastery(subtasks: TaskSubtask[]): number {
  if (subtasks.length === 0) return 0;
  const total = subtasks.reduce((sum, st) => sum + st.mastery_level, 0);
  return Math.round(total / subtasks.length);
}

// ─── 桌面表格行（memo 化）────────────────────────────────────────────────────
interface TaskRowProps {
  task: UserTask;
  index: number;
  isExpanded: boolean;
  hasSubtasks: boolean;
  subtasks: TaskSubtask[];
  isLoadingSubtasks: boolean;
  columnCount: number;
  statusLabel: string;
  statusColor: string;
  queueBg: string;
  queueText: string;
  deadlineText: string;
  deadlineColor: string;
  durationText: string;
  createdText: string;
  onToggleExpand: (taskId: string, hasSubtasks: boolean) => void;
  onToggleSubtask: (task: UserTask, subtask: TaskSubtask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
}

const TaskRow = memo(
  forwardRef<HTMLTableRowElement, TaskRowProps>(function TaskRow(props, ref) {
    const { t } = useTranslation();
    const { transitionOverride } = useReducedMotionOrPreference();
    const {
      task,
      index,
      isExpanded,
      hasSubtasks,
      subtasks,
      isLoadingSubtasks,
      columnCount,
      statusLabel,
      statusColor,
      queueBg,
      queueText,
      deadlineText,
      deadlineColor,
      durationText,
      createdText,
      onToggleExpand,
      onToggleSubtask,
      onStartTask,
      onPauseTask,
      onCompleteTask,
      onEditTask,
      onDeleteTask,
    } = props;

    const subtaskProgress =
      hasSubtasks && task.subtask_count
        ? Math.round(
            ((task.subtask_completed || 0) / task.subtask_count) * 100,
          )
        : 0;
    const subtaskTypeStats = getSubtaskTypeStats(subtasks);
    const avgMastery = getAverageMastery(subtasks);

    return (
      <>
        <motion.tr
          ref={ref}
          data-index={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionOverride ?? { duration: 0.2 }}
          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              {hasSubtasks && (
                <button
                  onClick={() => onToggleExpand(task.id, hasSubtasks)}
                  aria-expanded={isExpanded}
                  aria-controls={`row-${task.id}-detail`}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {isExpanded ? (
                    <ChevronDown
                      size={14}
                      className="text-slate-400 dark:text-slate-500"
                    />
                  ) : (
                    <ChevronRight
                      size={14}
                      className="text-slate-400 dark:text-slate-500"
                    />
                  )}
                </button>
              )}
              {!hasSubtasks && <div className="w-6" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800 dark:text-white truncate">
                  {task.title}
                </div>
                {hasSubtasks && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden max-w-[120px]">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${subtaskProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {task.subtask_completed || 0}/{task.subtask_count}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
          </td>
          <td className="px-4 py-3">
            <span
              className={`px-2 py-1 rounded text-xs font-bold ${queueBg} ${queueText}`}
            >
              Q{task.queue_level}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              {task.priority >= 3 && (
                <span className="text-red-500 dark:text-red-400">★</span>
              )}
              <span className="text-slate-700 dark:text-slate-300">
                {task.priority || 0}
              </span>
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm">
              <Clock size={12} />
              <span>{durationText}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <div
              className={`flex items-center gap-1 text-sm ${deadlineColor}`}
            >
              <Calendar size={12} />
              <span>{deadlineText}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {task.tags?.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
                >
                  {tag}
                </span>
              ))}
              {task.tags && task.tags.length > 2 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  +{task.tags.length - 2}
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            {createdText}
          </td>
          <td className="px-4 py-3">
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {task.status === "pending" && onStartTask && (
                <button
                  onClick={() => onStartTask(task)}
                  className="flex items-center justify-center p-2.5 rounded-lg min-h-[36px] min-w-[36px] bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-500/30 transition-all"
                  title={t('common.aria.start')}
                  aria-label={t('common.aria.start')}
                >
                  <Play size={14} />
                </button>
              )}
              {task.status === "in_progress" && onPauseTask && (
                <button
                  onClick={() => onPauseTask(task)}
                  className="flex items-center justify-center p-2.5 rounded-lg min-h-[36px] min-w-[36px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-all"
                  title={t('common.aria.pause')}
                  aria-label={t('common.aria.pause')}
                >
                  <Pause size={14} />
                </button>
              )}
              {(task.status === "pending" ||
                task.status === "in_progress" ||
                task.status === "paused") &&
                onCompleteTask && (
                  <button
                    onClick={() => onCompleteTask(task)}
                    className="flex items-center justify-center p-2.5 rounded-lg min-h-[36px] min-w-[36px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                    title={t('common.aria.complete')}
                    aria-label={t('common.aria.complete')}
                  >
                    <Check size={14} />
                  </button>
                )}
              {onEditTask && (
                <button
                  onClick={() => onEditTask(task)}
                  className="flex items-center justify-center p-2.5 rounded-lg min-h-[36px] min-w-[36px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all"
                  title={t('common.aria.edit')}
                  aria-label={t('common.aria.edit')}
                >
                  <Edit2 size={14} />
                </button>
              )}
              {onDeleteTask && (
                <button
                  onClick={() => onDeleteTask(task)}
                  className="flex items-center justify-center p-2.5 rounded-lg min-h-[36px] min-w-[36px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  title={t('common.aria.delete')}
                  aria-label={t('common.aria.delete')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </td>
        </motion.tr>

        <AnimatePresence>
          {isExpanded && hasSubtasks && (
            <motion.tr
              id={`row-${task.id}-detail`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-50/50 dark:bg-slate-800/30"
            >
              <td colSpan={columnCount} className="px-4 py-0">
                <motion.div
                  initial={{ y: -10 }}
                  animate={{ y: 0 }}
                  exit={{ y: -10 }}
                  className="py-3"
                >
                  {isLoadingSubtasks ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mb-3 px-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <BookOpen size={12} />
                          <span>
                            {t(
                              "scheduler.subtasks.knowledgePoints",
                              { count: subtasks.length },
                            )}
                          </span>
                        </div>
                        {subtasks.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {t("scheduler.subtasks.avgMastery")}:
                            </span>
                            <div className="w-24">
                              <MasteryProgressBar
                                masteryLevel={avgMastery}
                                size="sm"
                                showLabel={false}
                              />
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              {avgMastery}%
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {subtaskTypeStats.learning > 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SUBTASK_TYPE_COLORS.learning.bg} ${SUBTASK_TYPE_COLORS.learning.text}`}
                            >
                              {t("scheduler.subtasks.learning")}{" "}
                              {subtaskTypeStats.learning}
                            </span>
                          )}
                          {subtaskTypeStats.review > 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SUBTASK_TYPE_COLORS.review.bg} ${SUBTASK_TYPE_COLORS.review.text}`}
                            >
                              {t("scheduler.subtasks.review")}{" "}
                              {subtaskTypeStats.review}
                            </span>
                          )}
                          {subtaskTypeStats.practice > 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SUBTASK_TYPE_COLORS.practice.bg} ${SUBTASK_TYPE_COLORS.practice.text}`}
                            >
                              {t("scheduler.subtasks.practice")}{" "}
                              {subtaskTypeStats.practice}
                            </span>
                          )}
                          {subtaskTypeStats.quiz > 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SUBTASK_TYPE_COLORS.quiz.bg} ${SUBTASK_TYPE_COLORS.quiz.text}`}
                            >
                              {t("scheduler.subtasks.quiz")}{" "}
                              {subtaskTypeStats.quiz}
                            </span>
                          )}
                        </div>
                      </div>

                      {subtasks.length > 0 ? (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className={`
                                flex items-center gap-3 p-2.5 rounded-lg border transition-all
                                ${
                                  subtask.status === "completed"
                                    ? "bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                                    : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-500/50"
                                }
                              `}
                            >
                              <button
                                onClick={() =>
                                  onToggleSubtask(task, subtask)
                                }
                                className="flex-shrink-0 hover:scale-110 transition-transform p-1"
                              >
                                {subtask.status === "completed" ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-primary-500" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium truncate ${subtask.status === "completed" ? "text-emerald-700 dark:text-emerald-400 line-through" : "text-slate-700 dark:text-slate-200"}`}
                                  >
                                    {subtask.title}
                                  </span>
                                  <LearningStateBadge
                                    state={subtask.learning_state}
                                    size="sm"
                                  />
                                </div>
                                <div className="mt-1.5">
                                  <MasteryProgressBar
                                    masteryLevel={subtask.mastery_level}
                                    size="sm"
                                    className="max-w-[200px]"
                                  />
                                </div>
                              </div>

                              {subtask.estimated_duration && (
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Clock size={10} />
                                  <span>
                                    {subtask.estimated_duration}m
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-sm">
                          {t("scheduler.subtasks.noSubtasks")}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </td>
            </motion.tr>
          )}
        </AnimatePresence>
      </>
    );
  }),
);

// ─── 移动卡片（memo 化）──────────────────────────────────────────────────────
interface TaskCardProps {
  task: UserTask;
  index: number;
  statusLabel: string;
  statusColor: string;
  queueBg: string;
  queueText: string;
  deadlineText: string;
  deadlineColor: string;
  durationText: string;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
}

const TaskCard = memo(
  forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(props, ref) {
    const { transitionOverride } = useReducedMotionOrPreference();
    const {
      task,
      index,
      statusLabel,
      statusColor,
      queueBg,
      queueText,
      deadlineText,
      deadlineColor,
      durationText,
      onStartTask,
      onPauseTask,
      onCompleteTask,
      onEditTask,
      onDeleteTask,
    } = props;

    return (
      <motion.div
        ref={ref}
        data-index={index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionOverride ?? { duration: 0.2 }}
        className="p-3 rounded-xl border border-slate-200 dark:border-slate-500/50 bg-white dark:bg-slate-800/60 mb-3"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-800 dark:text-white truncate">
              {task.title}
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span className={`px-1.5 py-0.5 rounded font-bold ${queueBg} ${queueText}`}>
            Q{task.queue_level}
          </span>
          <span className="flex items-center gap-1">
            {task.priority >= 3 && <span className="text-red-500">★</span>}
            {task.priority || 0}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {durationText}
          </span>
          <span className={`flex items-center gap-1 ${deadlineColor}`}>
            <Calendar size={12} />
            {deadlineText}
          </span>
        </div>
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-500/50">
          {task.status === "pending" && onStartTask && (
            <button onClick={() => onStartTask(task)} className="flex items-center justify-center p-2 rounded-lg min-h-[36px] min-w-[36px] bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400">
              <Play size={14} />
            </button>
          )}
          {task.status === "in_progress" && onPauseTask && (
            <button onClick={() => onPauseTask(task)} className="flex items-center justify-center p-2 rounded-lg min-h-[36px] min-w-[36px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Pause size={14} />
            </button>
          )}
          {(task.status === "pending" || task.status === "in_progress" || task.status === "paused") && onCompleteTask && (
            <button onClick={() => onCompleteTask(task)} className="flex items-center justify-center p-2 rounded-lg min-h-[36px] min-w-[36px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Check size={14} />
            </button>
          )}
          {onEditTask && (
            <button onClick={() => onEditTask(task)} className="flex items-center justify-center p-2 rounded-lg min-h-[36px] min-w-[36px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              <Edit2 size={14} />
            </button>
          )}
          {onDeleteTask && (
            <button onClick={() => onDeleteTask(task)} className="flex items-center justify-center p-2 rounded-lg min-h-[36px] min-w-[36px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </motion.div>
    );
  }),
);

export const ListView: React.FC<ListViewProps> = ({
  tasks,
  onTaskClick: _onTaskClick,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onSubtaskUpdate,
}) => {
  const { t } = useTranslation();

  const I18N_STATUS_CONFIG = {
    pending: {
      label: t("scheduler.pending"),
      color: STATUS_CONFIG.pending.color,
    },
    in_progress: {
      label: t("scheduler.inProgress"),
      color: STATUS_CONFIG.in_progress.color,
    },
    paused: {
      label: t("scheduler.kanban.paused"),
      color: STATUS_CONFIG.paused.color,
    },
    completed: {
      label: t("scheduler.completed"),
      color: STATUS_CONFIG.completed.color,
    },
    cancelled: {
      label: t("scheduler.kanban.cancelled"),
      color: STATUS_CONFIG.cancelled.color,
    },
  };

  const COLUMNS = [
    { id: "title", label: t("scheduler.listView.title"), width: "w-64" },
    { id: "status", label: t("scheduler.listView.status"), width: "w-24" },
    { id: "queue_level", label: t("scheduler.listView.queue"), width: "w-16" },
    { id: "priority", label: t("scheduler.listView.priority"), width: "w-20" },
    {
      id: "estimated_duration",
      label: t("scheduler.estimatedDuration"),
      width: "w-24",
    },
    { id: "deadline", label: t("scheduler.listView.deadline"), width: "w-28" },
    { id: "tags", label: t("scheduler.listView.tags"), width: "w-32" },
    {
      id: "created_at",
      label: t("scheduler.listView.createdAt"),
      width: "w-28",
    },
    { id: "actions", label: t("scheduler.listView.actions"), width: "w-32" },
  ];

  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterQueue, setFilterQueue] = useState<number | null>(null);
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [showFilters, setShowFilters] = useState(false);
  const filterPanelId = useId();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [subtasksMap, setSubtasksMap] = useState<Map<string, TaskSubtask[]>>(
    new Map(),
  );
  const [loadingSubtasks, setLoadingSubtasks] = useState<Set<string>>(
    new Set(),
  );

  const filteredAndSortedTasks = useMemo(() => {
    // 单趟过滤所有条件，替代链式 filter 的多次中间数组分配（原为 O(k*tasks) 扫描）
    const query = debouncedSearchQuery ? debouncedSearchQuery.toLowerCase() : '';
    const result: UserTask[] = [];
    for (const task of tasks) {
      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = task.description
          ? task.description.toLowerCase().includes(query)
          : false;
        const tagsMatch = task.tags
          ? task.tags.some((tag) => tag.toLowerCase().includes(query))
          : false;
        if (!titleMatch && !descMatch && !tagsMatch) continue;
      }
      if (filterStatus && task.status !== filterStatus) continue;
      if (filterQueue !== null && task.queue_level !== filterQueue) continue;
      result.push(task);
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "queue_level":
          comparison = a.queue_level - b.queue_level;
          break;
        case "priority":
          comparison = (b.priority || 0) - (a.priority || 0);
          break;
        case "deadline":
          if (!a.deadline && !b.deadline) comparison = 0;
          else if (!a.deadline) comparison = 1;
          else if (!b.deadline) comparison = -1;
          else
            {comparison =
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime();}
          break;
        case "created_at":
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "estimated_duration":
          comparison =
            (a.estimated_duration || 0) - (b.estimated_duration || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [tasks, sortField, sortDirection, filterStatus, filterQueue, debouncedSearchQuery]);

  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);

  const subtasksMapRef = useRef(subtasksMap);
  useEffect(() => {
    subtasksMapRef.current = subtasksMap;
  }, [subtasksMap]);

  const desktopVirtualizer = useVirtualizer({
    count: filteredAndSortedTasks.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    overscan: DESKTOP_OVERSCAN,
    getItemKey: (index) => filteredAndSortedTasks[index]?.id ?? index,
  });

  const mobileVirtualizer = useVirtualizer({
    count: filteredAndSortedTasks.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => DEFAULT_CARD_HEIGHT,
    overscan: MOBILE_OVERSCAN,
    getItemKey: (index) => filteredAndSortedTasks[index]?.id ?? index,
  });

  // 展开/收起或子任务数据变化时校正虚拟化测量，避免滚动跳动
  useEffect(() => {
    desktopVirtualizer.measure();
    mobileVirtualizer.measure();
  }, [expandedTasks, subtasksMap, desktopVirtualizer, mobileVirtualizer]);

  const desktopVirtualItems = desktopVirtualizer.getVirtualItems();
  const desktopStartOffset =
    desktopVirtualItems.length > 0 ? (desktopVirtualItems[0]?.start ?? 0) : 0;
  const desktopEndOffset =
    desktopVirtualItems.length > 0
      ? desktopVirtualItems[desktopVirtualItems.length - 1]?.end ?? 0
      : 0;
  const mobileVirtualItems = mobileVirtualizer.getVirtualItems();
  const mobileStartOffset =
    mobileVirtualItems.length > 0 ? (mobileVirtualItems[0]?.start ?? 0) : 0;
  const mobileEndOffset =
    mobileVirtualItems.length > 0
      ? mobileVirtualItems[mobileVirtualItems.length - 1]?.end ?? 0
      : 0;

  const loadSubtasks = useCallback(async (taskId: string) => {
    if (subtasksMapRef.current.has(taskId)) return;

    setLoadingSubtasks((prev) => new Set(prev).add(taskId));
    try {
      const data = await api.scheduler.getSubtasks(taskId);
      setSubtasksMap((prev) => new Map(prev).set(taskId, data ?? []));
    } catch (error) {
      console.error("Failed to load subtasks:", error);
    } finally {
      setLoadingSubtasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, []);

  const toggleTaskExpand = useCallback(
    (taskId: string, hasSubtasks: boolean) => {
      setExpandedTasks((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(taskId)) {
          newExpanded.delete(taskId);
        } else if (hasSubtasks) {
          newExpanded.add(taskId);
          loadSubtasks(taskId);
        }
        return newExpanded;
      });
    },
    [loadSubtasks],
  );

  const handleToggleSubtask = useCallback(
    async (task: UserTask, subtask: TaskSubtask) => {
      const newStatus =
        subtask.status === "completed" ? "pending" : "completed";
      try {
        const updated = await api.scheduler.updateSubtask(task.id, subtask.id, {
          status: newStatus,
        });
        setSubtasksMap((prev) => {
          const next = new Map(prev);
          const subtasks = next.get(task.id);
          if (subtasks) {
            next.set(
              task.id,
              subtasks.map((st) => (st.id === subtask.id ? updated : st)),
            );
          }
          return next;
        });
        onSubtaskUpdate?.();
      } catch (error) {
        console.error("Failed to update subtask:", error);
      }
    },
    [onSubtaskUpdate],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // 保留本地实现：分钟部分使用 i18n，小时部分使用紧凑格式，混合格式无法直接复用 @/utils/formatters
  const formatDuration = (minutes?: number) => {
    if (!minutes) return "--";
    if (minutes < 60) return t("scheduler.minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDate = (date?: string) => {
    if (!date) return "--";
    return formatDateUtil(date, 'short');
  };

  const formatDeadline = (date?: string) => {
    if (!date)
      {return { text: "--", color: "text-slate-400 dark:text-slate-500" };}
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0)
      {return {
        text: t("scheduler.timeline.overdue"),
        color: "text-red-500 dark:text-red-400",
      };}
    if (days === 0)
      {return {
        text: t("scheduler.timeline.today"),
        color: "text-amber-500 dark:text-amber-400",
      };}
    if (days === 1)
      {return {
        text: t("scheduler.timeline.tomorrow"),
        color: "text-yellow-500 dark:text-yellow-400",
      };}
    if (days <= 7)
      {return {
        text: t("scheduler.review.daysLater", { count: days }),
        color: "text-primary-500 dark:text-primary-400",
      };}
    return {
      text: formatDateUtil(d, 'short'),
      color: "text-slate-500 dark:text-slate-400",
    };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown size={14} className="text-slate-400 dark:text-slate-500" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={14} className="text-primary-500 dark:text-primary-400" />
    ) : (
      <ArrowDown size={14} className="text-primary-500 dark:text-primary-400" />
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              placeholder={t("scheduler.listView.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500/50 text-slate-800 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500/50"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls={filterPanelId}
            className={`
              flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all min-h-[44px]
              ${
                showFilters
                  ? "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-500/30"
                  : "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-500/50 hover:text-slate-800 dark:hover:text-white"
              }
            `}
          >
            <Filter size={16} />
            {t("scheduler.listView.filter")}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t("scheduler.listView.totalTasks", {
            count: filteredAndSortedTasks.length,
          })}
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            id={filterPanelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-500/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("scheduler.listView.status")}:
                </span>
                <div className="flex gap-1">
                  {Object.entries(I18N_STATUS_CONFIG).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() =>
                        setFilterStatus(filterStatus === status ? null : status)
                      }
                      className={`
                        px-2 py-1 rounded text-xs font-medium transition-all
                        ${
                          filterStatus === status
                            ? config.color
                            : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }
                      `}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("scheduler.listView.queue")}:
                </span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((level) => (
                    <button
                      key={level}
                      onClick={() =>
                        setFilterQueue(filterQueue === level ? null : level)
                      }
                      className={`
                        px-2 py-1 rounded text-xs font-medium transition-all
                        ${
                          filterQueue === level
                            ? `${QUEUE_COLORS[level as QueueLevel]
                                .bg 
                              } ${ 
                              QUEUE_COLORS[level as QueueLevel]
                                .text}`
                            : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }
                      `}
                    >
                      Q{level}
                    </button>
                  ))}
                </div>
              </div>

              {(filterStatus || filterQueue !== null) && (
                <button
                  onClick={() => {
                    setFilterStatus(null);
                    setFilterQueue(null);
                  }}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {t("scheduler.listView.clearFilter")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-500/50 bg-white dark:bg-slate-900/60 backdrop-blur-sm">
        {/* Desktop: table view */}
        <div
          ref={desktopScrollRef}
          role="button"
          aria-label={t('scheduler.listView.tableRegion')}
          tabIndex={0}
          className="hidden md:block h-full overflow-x-auto overflow-y-auto custom-scrollbar"
        >
          <table
            className="w-full min-w-[900px]"
            aria-label={t("scheduler.listView.tableAriaLabel", { defaultValue: "任务列表" })}
          >
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-800/80">
                {COLUMNS.map((column) => {
                  const isSortable = column.id !== "actions" && column.id !== "tags";
                  const ariaSort = isSortable
                    ? sortField === (column.id as SortField)
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined;
                  return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={ariaSort}
                    tabIndex={isSortable ? 0 : undefined}
                    onKeyDown={
                      isSortable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSort(column.id as SortField);
                            }
                          }
                        : undefined
                    }
                    className={`
                      px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider
                      ${isSortable ? "cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" : ""}
                      border-b border-slate-200 dark:border-slate-500/50
                    `}
                    onClick={() => {
                      if (isSortable) {
                        handleSort(column.id as SortField);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {isSortable && (
                        <SortIcon field={column.id as SortField} />
                      )}
                    </div>
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
              {filteredAndSortedTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-12 text-center text-slate-400 dark:text-slate-500"
                  >
                    {t("scheduler.listView.noTasks")}
                  </td>
                </tr>
              ) : (
                <>
                  {desktopStartOffset > 0 && (
                    <tr style={{ height: desktopStartOffset }} aria-hidden="true">
                      <td colSpan={COLUMNS.length} />
                    </tr>
                  )}
                  {desktopVirtualItems.map((virtualItem) => {
                    const task = filteredAndSortedTasks[virtualItem.index];
                    if (!task) return null;
                    const queueStyle =
                      QUEUE_COLORS[
                        task.queue_level as QueueLevel
                      ] || QUEUE_COLORS[2];
                    const statusConfig =
                      I18N_STATUS_CONFIG[task.status] ||
                      I18N_STATUS_CONFIG.pending;
                    const deadlineInfo = formatDeadline(task.deadline);
                    return (
                      <TaskRow
                        key={virtualItem.key}
                        ref={desktopVirtualizer.measureElement}
                        index={virtualItem.index}
                        task={task}
                        isExpanded={expandedTasks.has(task.id)}
                        hasSubtasks={Boolean(
                          task.has_subtasks ||
                            (task.subtask_count && task.subtask_count > 0),
                        )}
                        subtasks={subtasksMap.get(task.id) || []}
                        isLoadingSubtasks={loadingSubtasks.has(task.id)}
                        columnCount={COLUMNS.length}
                        statusLabel={statusConfig.label}
                        statusColor={statusConfig.color}
                        queueBg={queueStyle.bg}
                        queueText={queueStyle.text}
                        deadlineText={deadlineInfo.text}
                        deadlineColor={deadlineInfo.color}
                        durationText={formatDuration(task.estimated_duration)}
                        createdText={formatDate(task.created_at)}
                        onToggleExpand={toggleTaskExpand}
                        onToggleSubtask={handleToggleSubtask}
                        onStartTask={onStartTask}
                        onPauseTask={onPauseTask}
                        onCompleteTask={onCompleteTask}
                        onEditTask={onEditTask}
                        onDeleteTask={onDeleteTask}
                      />
                    );
                  })}
                  {desktopEndOffset < desktopVirtualizer.getTotalSize() && (
                    <tr
                      style={{
                        height:
                          desktopVirtualizer.getTotalSize() - desktopEndOffset,
                      }}
                      aria-hidden="true"
                    >
                      <td colSpan={COLUMNS.length} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile: card view */}
        <div
          ref={mobileScrollRef}
          className="md:hidden h-full overflow-y-auto custom-scrollbar p-3"
        >
          {filteredAndSortedTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              {t("scheduler.listView.noTasks")}
            </div>
          ) : (
            <>
              {mobileStartOffset > 0 && (
                <div style={{ height: mobileStartOffset }} aria-hidden="true" />
              )}
              {mobileVirtualItems.map((virtualItem) => {
                const task = filteredAndSortedTasks[virtualItem.index];
                if (!task) return null;
                const queueStyle =
                  QUEUE_COLORS[task.queue_level as QueueLevel] || QUEUE_COLORS[2];
                const statusConfig =
                  I18N_STATUS_CONFIG[task.status] || I18N_STATUS_CONFIG.pending;
                const deadlineInfo = formatDeadline(task.deadline);
                return (
                  <TaskCard
                    key={virtualItem.key}
                    ref={mobileVirtualizer.measureElement}
                    index={virtualItem.index}
                    task={task}
                    statusLabel={statusConfig.label}
                    statusColor={statusConfig.color}
                    queueBg={queueStyle.bg}
                    queueText={queueStyle.text}
                    deadlineText={deadlineInfo.text}
                    deadlineColor={deadlineInfo.color}
                    durationText={formatDuration(task.estimated_duration)}
                    onStartTask={onStartTask}
                    onPauseTask={onPauseTask}
                    onCompleteTask={onCompleteTask}
                    onEditTask={onEditTask}
                    onDeleteTask={onDeleteTask}
                  />
                );
              })}
              {mobileEndOffset < mobileVirtualizer.getTotalSize() && (
                <div
                  style={{
                    height: mobileVirtualizer.getTotalSize() - mobileEndOffset,
                  }}
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
