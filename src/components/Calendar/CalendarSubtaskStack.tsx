import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, CheckCircle, Loader2, Circle } from "lucide-react";
import { TaskSubtask } from "@shared/types";
import { LearningStateBadge } from "../Scheduler/LearningStateBadge";
import { MasteryProgressBar } from "../Scheduler/MasteryProgressBar";
import { useTheme } from "../../hooks";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";

interface CalendarSubtaskStackProps {
  subtasks: TaskSubtask[];
  maxVisible?: number;
  onSubtaskClick?: (subtask: TaskSubtask) => void;
  showProgress?: boolean;
  compact?: boolean;
}

export const CalendarSubtaskStack: React.FC<CalendarSubtaskStackProps> = ({
  subtasks,
  maxVisible = 3,
  onSubtaskClick,
  showProgress = true,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const visibleSubtasks = isExpanded ? subtasks : subtasks.slice(0, maxVisible);
  const hiddenCount = subtasks.length - maxVisible;
  const hasHidden = hiddenCount > 0 && !isExpanded;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "border-green-400 dark:border-green-500";
      case "in_progress":
        return "border-blue-400 dark:border-blue-500";
      default:
        return "border-gray-300 dark:border-gray-600";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-50 dark:bg-green-500/10";
      case "in_progress":
        return "bg-blue-50 dark:bg-blue-500/10";
      default:
        return isDark ? "bg-slate-700/50" : "bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-3 h-3" aria-hidden="true" />;
      case "in_progress":
        return <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />;
      default:
        return <Circle className="w-3 h-3" aria-hidden="true" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return t("calendar.subtask.statusCompleted");
      case "in_progress":
        return t("calendar.subtask.statusInProgress");
      default:
        return t("calendar.subtask.statusPending");
    }
  };

  if (compact) {
    return (
      <div className="mt-1 space-y-0.5">
        {subtasks.slice(0, 2).map((subtask) => (
          <div
            key={subtask.id}
            onClick={(e) => {
              e.stopPropagation();
              onSubtaskClick?.(subtask);
            }}
            className={`
              flex items-center gap-1 px-1 py-0.5 rounded text-[10px]
              border-l-2 ${getStatusColor(subtask.status)} ${getStatusBg(subtask.status)}
              cursor-pointer hover:opacity-80 transition-opacity
            `}
          >
            <span
              className={`inline-flex items-center justify-center ${
                subtask.status === "completed"
                  ? "text-green-500"
                  : subtask.status === "in_progress"
                    ? "text-blue-500"
                    : isDark
                      ? "text-slate-400"
                      : "text-gray-400"
              }`}
            >
              {getStatusIcon(subtask.status)}
            </span>
            <span className="sr-only">{getStatusText(subtask.status)}</span>
            <LearningStateBadge
              state={subtask.learning_state}
              size="sm"
              showIcon={false}
            />
            <span
              className={`truncate flex-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}
            >
              {subtask.title}
            </span>
            <span
              className={`font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {subtask.mastery_level}%
            </span>
          </div>
        ))}
        {subtasks.length > 2 && (
          <div
            className={`text-[10px] ${isDark ? "text-slate-500" : "text-gray-400"} pl-1`}
          >
            {t("calendar.subtask.more", { count: subtasks.length - 2 })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <AnimatePresence initial={false}>
        {visibleSubtasks.map((subtask, index) => (
          <motion.div
            key={subtask.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto", marginBottom: 4 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
            transition={transitionOverride ?? { duration: 0.2, delay: index * 0.05 }}
            onClick={(e) => {
              e.stopPropagation();
              onSubtaskClick?.(subtask);
            }}
            className={`
              border-l-2 rounded-r cursor-pointer
              transition-all hover:shadow-sm
              ${getStatusColor(subtask.status)} ${getStatusBg(subtask.status)}
            `}
          >
            <div className="p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <LearningStateBadge
                    state={subtask.learning_state}
                    size="sm"
                    showIcon={true}
                  />
                  <span
                    className={`text-xs font-medium truncate ${
                      isDark ? "text-slate-200" : "text-gray-800"
                    }`}
                    title={subtask.title}
                  >
                    {subtask.title}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs flex-shrink-0 ${
                    subtask.status === "completed"
                      ? "text-green-500"
                      : subtask.status === "in_progress"
                        ? "text-blue-500"
                        : isDark
                          ? "text-slate-400"
                          : "text-gray-500"
                  }`}
                >
                  {getStatusIcon(subtask.status)}
                  <span>{getStatusText(subtask.status)}</span>
                </span>
              </div>

              {showProgress && (
                <MasteryProgressBar
                  masteryLevel={subtask.mastery_level}
                  size="sm"
                  showLabel={true}
                  animated={true}
                />
              )}

              {subtask.estimated_duration && (
                <div
                  className={`text-[10px] mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                >
                  {t("calendar.subtask.estimatedDuration", { minutes: subtask.estimated_duration })}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {hasHidden && (
        <motion.button
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitionOverride}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className={`
            w-full flex items-center justify-center gap-1 py-1.5 rounded
            text-xs font-medium transition-colors
            ${
              isDark
                ? "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }
          `}
        >
          <ChevronDown size={12} />
          <span>{t("calendar.subtask.hiddenCount", { count: hiddenCount })}</span>
        </motion.button>
      )}

      {isExpanded && subtasks.length > maxVisible && (
        <motion.button
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitionOverride}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className={`
            w-full flex items-center justify-center gap-1 py-1.5 rounded
            text-xs font-medium transition-colors mt-1
            ${
              isDark
                ? "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            }
          `}
        >
          <ChevronUp size={12} />
          <span>{t("calendar.subtask.collapse")}</span>
        </motion.button>
      )}
    </div>
  );
};
