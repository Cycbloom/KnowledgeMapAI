import React from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ChevronRight,
  Timer,
  CheckCircle2,
  Brain,
  Flame,
  TrendingUp,
} from "lucide-react";
import type { ReviewTaskStats } from "@shared/types";

interface TodayStats {
  totalStudyTime: number;
  completedTasks: number;
  reviewCompleted: number;
  streak: number;
}

interface StudyProgressPanelProps {
  todayStats: TodayStats;
  reviewStats: ReviewTaskStats | null;
  formatDuration: (minutes: number) => string;
  onViewStats: () => void;
}

export const StudyProgressPanel: React.FC<StudyProgressPanelProps> = ({
  todayStats,
  reviewStats,
  formatDuration,
  onViewStats,
}) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
      <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20">
              <BarChart3 size={16} className="text-emerald-500 dark:text-emerald-400" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-white">{t("unifiedWorkbench.labels.studyProgress")}</h2>
          </div>
          <button
            onClick={onViewStats}
            className="text-xs text-emerald-500 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            {t("unifiedWorkbench.actions.detailedStats")}
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-500/10 dark:from-primary-500/20 dark:to-primary-500/20 border border-primary-200 dark:border-primary-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Timer size={14} className="text-primary-500 dark:text-primary-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.todayStudy")}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatDuration(todayStats.totalStudyTime)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-200 dark:border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.completedTasks")}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {todayStats.completedTasks}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/10 to-pink-500/10 dark:from-primary-500/20 dark:to-pink-500/20 border border-primary-200 dark:border-primary-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={14} className="text-primary-500 dark:text-primary-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.reviewCompleted")}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {todayStats.reviewCompleted}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-200 dark:border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Flame size={14} className="text-amber-500 dark:text-amber-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.streakDays")}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {t("unifiedWorkbench.labels.streakDaysValue", { count: todayStats.streak })}
            </p>
          </div>
        </div>

        {reviewStats && (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
              <TrendingUp size={12} />
              {t("unifiedWorkbench.labels.reviewProgress")}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-500 dark:text-red-400">{t("unifiedWorkbench.status.overdue")}</span>
                <span className="font-bold text-slate-900 dark:text-white">{reviewStats.overdue}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-500 dark:text-amber-400">{t("unifiedWorkbench.status.todayToReview")}</span>
                <span className="font-bold text-slate-900 dark:text-white">{reviewStats.today}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-primary-500 dark:text-primary-400">{t("unifiedWorkbench.status.upcoming")}</span>
                <span className="font-bold text-slate-900 dark:text-white">{reviewStats.upcoming}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-500 dark:text-emerald-400">{t("unifiedWorkbench.status.planned")}</span>
                <span className="font-bold text-slate-900 dark:text-white">{reviewStats.future}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
