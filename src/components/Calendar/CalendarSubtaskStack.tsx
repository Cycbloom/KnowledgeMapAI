import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TaskSubtask } from "@shared/types";
import { LearningStateBadge } from "../Scheduler/LearningStateBadge";
import { MasteryProgressBar } from "../Scheduler/MasteryProgressBar";
import { useTheme } from "../../hooks";

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
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const visibleSubtasks = isExpanded
    ? subtasks
    : subtasks.slice(0, maxVisible);
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
        return isDark
          ? "bg-slate-700/50"
          : "bg-gray-50";
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
            <LearningStateBadge
              state={subtask.learning_state}
              size="sm"
              showIcon={false}
            />
            <span className={`truncate flex-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>
              {subtask.title}
            </span>
            <span className={`font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              {subtask.mastery_level}%
            </span>
          </div>
        ))}
        {subtasks.length > 2 && (
          <div className={`text-[10px] ${isDark ? "text-slate-500" : "text-gray-400"} pl-1`}>
            +{subtasks.length - 2} 更多
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
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 4 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
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
                {subtask.status === "completed" && (
                  <span className="text-green-500 text-xs">✓</span>
                )}
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
                  预计 {subtask.estimated_duration} 分钟
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {hasHidden && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
          <span>+{hiddenCount} 个子任务</span>
        </motion.button>
      )}

      {isExpanded && subtasks.length > maxVisible && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
          <span>收起</span>
        </motion.button>
      )}
    </div>
  );
};
