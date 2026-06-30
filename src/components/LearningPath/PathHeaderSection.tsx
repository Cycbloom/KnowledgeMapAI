import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Route,
  BookOpen,
  Calendar,
  Play,
  Pause,
  Archive,
  Trash2,
  CalendarClock,
  MoreVertical,
  ArrowLeft,
} from "lucide-react";
import { formatDurationMinutes, formatDate as formatDateUtil } from "../../utils/formatters";
import type { LearningPathDetail } from "./types";

interface PathHeaderSectionProps {
  pathDetail: LearningPathDetail;
  progressPercentage: number;
  showActions: string | null;
  onShowActionsChange: (value: string | null) => void;
  onAutoSchedule: () => void;
  onUpdatePathStatus: (status: "active" | "paused" | "archived") => void;
  onDeletePath: () => void;
}

const PathHeaderSection: React.FC<PathHeaderSectionProps> = ({
  pathDetail,
  progressPercentage,
  showActions,
  onShowActionsChange,
  onAutoSchedule,
  onUpdatePathStatus,
  onDeletePath,
}) => {
  const navigate = useNavigate();
  const formatDate = (dateStr: string) => formatDateUtil(dateStr);

  return (
    <div className="mb-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-500 rounded-xl">
              <Route className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {pathDetail.title}
              </h1>
              {pathDetail.description && (
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  {pathDetail.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {pathDetail.graph_title && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    {pathDetail.graph_title}
                  </span>
                )}
                {pathDetail.target_completion_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    目标：{formatDate(pathDetail.target_completion_date)}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    pathDetail.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : pathDetail.status === "paused"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : pathDetail.status === "completed"
                          ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {pathDetail.status === "active"
                    ? "进行中"
                    : pathDetail.status === "paused"
                      ? "已暂停"
                      : pathDetail.status === "completed"
                        ? "已完成"
                        : "已归档"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() =>
                  onShowActionsChange(showActions === "main" ? null : "main")
                }
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {showActions === "main" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-lg border dark:border-slate-600 py-1 z-10"
                  >
                    {pathDetail.graph_id && (
                      <button
                        onClick={() => {
                          onShowActionsChange(null);
                          navigate(`/graphs/${pathDetail.graph_id}`);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        查看知识图谱
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onShowActionsChange(null);
                        onAutoSchedule();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                    >
                      <CalendarClock className="w-4 h-4" />
                      自动排程
                    </button>
                    <button
                      onClick={() => {
                        onShowActionsChange(null);
                        onUpdatePathStatus(
                          pathDetail.status === "active"
                            ? "paused"
                            : "active",
                        );
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                    >
                      {pathDetail.status === "active" ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {pathDetail.status === "active"
                        ? "暂停学习"
                        : "继续学习"}
                    </button>
                    <button
                      onClick={() => {
                        onShowActionsChange(null);
                        onUpdatePathStatus("archived");
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                    >
                      <Archive className="w-4 h-4" />
                      归档
                    </button>
                    <hr className="my-1 dark:border-slate-600" />
                    <button
                      onClick={() => {
                        onShowActionsChange(null);
                        onDeletePath();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              学习进度
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pathDetail.progress.completed_nodes} /{" "}
              {pathDetail.progress.total_nodes} 节点
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary-500 to-primary-500"
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              预计时间：
              {formatDurationMinutes(pathDetail.progress.estimated_total_time, { emptyText: '0分钟' })}
            </span>
            <span>
              已学习：
              {formatDurationMinutes(
                Math.round(pathDetail.progress.total_time_spent / 60),
                { emptyText: '0分钟' },
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathHeaderSection;
