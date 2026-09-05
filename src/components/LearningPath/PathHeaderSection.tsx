import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigateBack } from "../../hooks/common/useNavigateBack";
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
import { useTranslation } from "react-i18next";
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
  const { goBack } = useNavigateBack();
  const { t } = useTranslation();
  const formatDate = (dateStr: string) => formatDateUtil(dateStr);

  const statusLabel = useMemo(() => {
    switch (pathDetail.status) {
      case "active":
        return t('learningPath.pathHeader.statusActive');
      case "paused":
        return t('learningPath.pathHeader.statusPaused');
      case "completed":
        return t('learningPath.pathHeader.statusCompleted');
      default:
        return t('learningPath.pathHeader.statusArchived');
    }
  }, [pathDetail.status, t]);

  return (
    <div className="mb-6">
      <button
        onClick={() => goBack()}
        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('learningPath.pathHeader.back')}
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
                    {t('learningPath.pathHeader.target', { date: formatDate(pathDetail.target_completion_date) })}
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
                  {statusLabel}
                </span>
                {pathDetail.path_type === "cross_graph" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {t('learningPaths.pathType.crossGraph')}
                  </span>
                )}
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
                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-lg border dark:border-slate-500 py-1 z-10"
                  >
                    {pathDetail.graph_id && (
                      <button
                        onClick={() => {
                          onShowActionsChange(null);
                          navigate(`/graph/${pathDetail.graph_id}`);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        {t('learningPath.pathHeader.viewKnowledgeGraph')}
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
                      {pathDetail.path_type === "cross_graph"
                        ? t('learningPath.pathHeader.replanStageWindows')
                        : t('learningPath.pathHeader.autoSchedule')}
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
                        ? t('learningPath.pathHeader.pauseLearning')
                        : t('learningPath.pathHeader.continueLearning')}
                    </button>
                    <button
                      onClick={() => {
                        onShowActionsChange(null);
                        onUpdatePathStatus("archived");
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 flex items-center gap-2"
                    >
                      <Archive className="w-4 h-4" />
                      {t('learningPath.pathHeader.archive')}
                    </button>
                    <hr className="my-1 dark:border-slate-500" />
                    <button
                      onClick={() => {
                        onShowActionsChange(null);
                        onDeletePath();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('learningPath.pathHeader.delete')}
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
              {t('learningPath.pathHeader.learningProgress')}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('learningPath.pathHeader.nodesCount', { completed: pathDetail.progress.completed_nodes, total: pathDetail.progress.total_nodes })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progressPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('common.aria.progress')}
            className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary-500 to-primary-500"
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {t('learningPath.pathHeader.estimatedTime')}
              {formatDurationMinutes(pathDetail.progress.estimated_total_time, { emptyText: t('learningPath.pathNodeList.estimatedMinutes', { count: 0 }) })}
            </span>
            <span>
              {t('learningPath.pathHeader.learnedTime')}
              {formatDurationMinutes(
                Math.round(pathDetail.progress.total_time_spent / 60),
                { emptyText: t('learningPath.pathNodeList.estimatedMinutes', { count: 0 }) },
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathHeaderSection;
