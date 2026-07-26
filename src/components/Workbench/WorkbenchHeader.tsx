import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Plus,
  RefreshCw,
  Clock,
  Zap,
  Layers,
} from "lucide-react";

interface TaskStatsDisplay {
  pending: number;
  inProgress: number;
  completed: number;
  totalEstimated: number;
}

interface WorkbenchHeaderProps {
  taskStats: TaskStatsDisplay;
  isFetchingQueues: boolean;
  formatDuration: (minutes: number) => string;
  onNavigateScheduler: () => void;
  onAddTask: () => void;
  onRefetch: () => void;
}

export const WorkbenchHeader: React.FC<WorkbenchHeaderProps> = ({
  taskStats,
  isFetchingQueues,
  formatDuration,
  onNavigateScheduler,
  onAddTask,
  onRefetch,
}) => {
  const { t } = useTranslation();

  return (
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
                  <Layers size={24} className="text-white" aria-hidden="true" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-500 via-primary-500 to-pink-500 dark:from-primary-400 dark:via-primary-400 dark:to-pink-400 bg-clip-text text-transparent">
                  {t("unifiedWorkbench.title")}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t("unifiedWorkbench.subtitle")}
                </p>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNavigateScheduler}
              aria-label={t("unifiedWorkbench.actions.scheduler")}
              className="p-2.5 sm:flex sm:items-center sm:gap-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <Zap aria-hidden="true" size={18} />
              <span className="hidden sm:inline">{t("unifiedWorkbench.actions.scheduler")}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddTask}
              aria-label={t("unifiedWorkbench.actions.createNewTask")}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all"
            >
              <Plus aria-hidden="true" size={18} />
              <span className="hidden sm:inline">{t("unifiedWorkbench.actions.createNewTask")}</span>
            </motion.button>

            <button
              onClick={onRefetch}
              disabled={isFetchingQueues}
              aria-label={t('common.aria.refresh')}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50 min-h-[44px] min-w-[44px]"
            >
              <RefreshCw
                aria-hidden="true"
                size={18}
                className={isFetchingQueues ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
            <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.status.pending")}</span>
            <span className="text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400">{taskStats.pending}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
            <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.status.inProgress")}</span>
            <span className="text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400">{taskStats.inProgress}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.status.completed")}</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">{taskStats.completed}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
            <Clock size={14} className="text-slate-400" aria-hidden="true" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.estimatedDuration")}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{formatDuration(taskStats.totalEstimated)}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
