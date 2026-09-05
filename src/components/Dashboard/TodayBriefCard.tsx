import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Repeat,
} from "lucide-react";
import { useTheme } from "../../hooks";
import { useSchedulerOrchestrator } from "../../hooks/scheduler/useSchedulerOrchestrator";

/**
 * 今日卡片（P4 统一计划体系）：今天该学什么。
 * 聚合今日排期、全局日容量使用、到期复习、大循环决策与跨图路径滞后窗口提示。
 */
export const TodayBriefCard: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { todayBrief } = useSchedulerOrchestrator();

  const brief = todayBrief.data;
  const boxClass = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-gray-200";
  const mutedText = "text-slate-500 dark:text-slate-400";
  const borderColor = isDark ? "border-slate-700" : "border-gray-200";

  const goToStudy = (knowledgePointId: string | null) => {
    if (!knowledgePointId) return;
    navigate(`/study?node_id=${encodeURIComponent(knowledgePointId)}`);
  };

  if (todayBrief.isLoading) {
    return (
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <div className="p-5 animate-pulse">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
        </div>
      </section>
    );
  }

  if (!brief) return null;

  const { capacity, reviews, schedule, laggingWindows, bigLoop } = brief;
  const totalScheduled = capacity.scheduledMinutes + capacity.completedMinutes;
  const usagePercent =
    capacity.dailyCapacityMinutes > 0
      ? Math.min(
          100,
          Math.round((totalScheduled / capacity.dailyCapacityMinutes) * 100),
        )
      : 0;

  return (
    <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
      <div className={`px-5 py-4 flex items-center gap-2 border-b ${borderColor}`}>
        <CalendarCheck size={18} className="text-primary-500" />
        <span className="font-medium">{t("scheduler.todayBrief.title")}</span>
        {reviews.overdue > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} />
            {t("scheduler.todayBrief.overdueBadge", { count: reviews.overdue })}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* 大循环决策摘要 */}
        {bigLoop && (
          <div className="flex items-start gap-2.5">
            <Repeat size={16} className="text-primary-500 mt-0.5 shrink-0" />
            <p className="text-sm">
              {bigLoop.type === "review"
                ? t("scheduler.todayBrief.bigLoopReview", { count: bigLoop.overdueReviewCount })
                : bigLoop.type === "graph" && bigLoop.graphTask
                  ? t("scheduler.todayBrief.bigLoopGraph", {
                      graph: bigLoop.graphTask.taskTitle,
                    })
                  : t("scheduler.todayBrief.bigLoopEmpty")}
            </p>
          </div>
        )}

        {/* 今日排期列表 */}
        {schedule.length === 0 ? (
          <p className={`text-sm ${mutedText}`}>
            {t("scheduler.todayBrief.noSchedule")}
          </p>
        ) : (
          <ul className="space-y-2">
            {schedule.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goToStudy(item.knowledgePointId)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                    item.status === "completed"
                      ? "opacity-60"
                      : "hover:border-primary-400"
                  } ${borderColor}`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium truncate ${
                        item.status === "completed" ? "line-through" : ""
                      }`}
                    >
                      {item.title || t("scheduler.todayBrief.untitledNode")}
                    </span>
                    {item.pathTitle && (
                      <span className={`block text-xs ${mutedText} truncate`}>
                        {item.pathTitle}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs ${mutedText}`}>
                      {t("scheduler.todayBrief.minutes", {
                        count: item.estimatedTime,
                      })}
                    </span>
                    {item.status === "completed" ? (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ✓
                      </span>
                    ) : (
                      <ArrowRight size={14} className={mutedText} />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 全局日容量使用 */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className={mutedText}>{t("scheduler.todayBrief.capacityLabel")}</span>
            <span className={mutedText}>
              {t("scheduler.todayBrief.capacityValue", {
                scheduled: totalScheduled,
                capacity: capacity.dailyCapacityMinutes,
                completed: capacity.completedMinutes,
              })}
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        {/* 跨图路径滞后窗口提示（P2 两级排课） */}
        {laggingWindows.length > 0 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
              <AlertTriangle size={14} />
              {t("scheduler.todayBrief.laggingTitle", {
                count: laggingWindows.length,
              })}
            </div>
            <ul className="mt-1.5 space-y-1">
              {laggingWindows.slice(0, 3).map((w) => (
                <li
                  key={w.id ?? w.graphNodeId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <BookOpen size={12} className="shrink-0" />
                    <span className="truncate">
                      {w.pathTitle ?? w.title ?? w.graphId}
                    </span>
                  </span>
                  <span className={mutedText}>{w.weekEndDate}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

export default TodayBriefCard;
