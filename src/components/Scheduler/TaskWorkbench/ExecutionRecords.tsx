import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle,
  PauseCircle,
  Timer,
  ChevronDown,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { api } from "../../../services/api";
import { formatDuration } from "../../../utils/formatters";
import { TaskExecution } from "../../../types";

interface ExecutionRecordsProps {
  taskId: string;
  className?: string;
}

interface GroupedExecutions {
  [date: string]: TaskExecution[];
}

export const ExecutionRecords: React.FC<ExecutionRecordsProps> = ({
  taskId,
  className = "",
}) => {
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExecutions();
  }, [taskId]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const response = await api.scheduler.getTaskExecutions(taskId);
      if (response.success) {
        setExecutions(response.data || []);
      }
    } catch (error) {
      console.error("Failed to load executions:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupByDate = (execs: TaskExecution[]): GroupedExecutions => {
    const grouped: GroupedExecutions = {};
    execs.forEach((exec) => {
      const date = new Date(exec.started_at).toLocaleDateString("zh-CN");
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(exec);
    });
    return grouped;
  };

  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "今日";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "昨日";
    }
    return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  };

  const formatTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "interrupted":
        return <PauseCircle className="w-4 h-4 text-yellow-500" />;
      case "time_slice_ended":
        return <Timer className="w-4 h-4 text-primary-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "completed":
        return "已完成";
      case "interrupted":
        return "中断";
      case "time_slice_ended":
        return "时间片结束";
      default:
        return "未知";
    }
  };

  const toggleGroup = (date: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedGroups(newExpanded);
  };

  const groupedExecutions = groupByDate(executions);
  const totalDuration = executions.reduce(
    (sum, e) => sum + (e.duration || 0),
    0,
  );
  const completedCount = executions.filter(
    (e) => e.status === "completed",
  ).length;

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-200 dark:bg-slate-700 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          执行记录
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          共 {executions.length} 次执行
        </span>
      </div>

      {/* 统计摘要 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatDuration(totalDuration, { emptyText: "未知", round: true })}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">总时长</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {executions.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">执行次数</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-500">
            {executions.length > 0
              ? Math.round((completedCount / executions.length) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">完成率</p>
        </div>
      </div>

      {/* 按日期分组的执行记录 */}
      {Object.keys(groupedExecutions).length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无执行记录</p>
          <p className="text-sm mt-1">开始任务后将自动记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedExecutions).map(([date, execs]) => (
            <div
              key={date}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(date)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDateLabel(date)}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    ({execs.length}次)
                  </span>
                </div>
                {expandedGroups.has(date) ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {expandedGroups.has(date) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="border-t border-slate-200 dark:border-slate-700">
                      {execs.map((exec, index) => (
                        <div
                          key={exec.id}
                          className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                            index > 0
                              ? "border-t border-slate-100 dark:border-slate-700/50"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(exec.status)}
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {formatTime(exec.started_at)} -{" "}
                                {exec.ended_at
                                  ? formatTime(exec.ended_at)
                                  : "进行中"}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Q{exec.queue_level} ·{" "}
                                {getStatusLabel(exec.status)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {formatDuration(exec.duration, { emptyText: "未知", round: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
