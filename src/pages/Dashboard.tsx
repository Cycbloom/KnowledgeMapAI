import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home,
  ListOrdered,
  BrainCog,
  GraduationCap,
  ArrowRight,
  Sparkles,
  Inbox,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useSchedulerOrchestrator } from "../hooks/scheduler/useSchedulerOrchestrator";
import { orchestratorApi } from "../services/api/modules/scheduler/orchestrator";
import { useSchedulerQueues } from "../hooks/scheduler/useScheduler";
import { useTheme, useIsMobile } from "../hooks";
import { TodayReview } from "../components/capture/TodayReview";
import { EmptyState } from "../components/common";
import type { QueueData } from "@shared/types";

/**
 * 首页（调度大展板）
 *
 * 首页从「图谱列表页」调整为「调度主入口」：顶置一条「下一步」调度决策大卡
 * （来自 getNextStep），下方是待办队列；今日回顾与快捷入口收进右侧栏，
 * 尽量让首屏在桌面端走左右双栏结构，减少整页纵向滚动。
 * 原 /scheduler 调度器页保留，这里只展示调度结果。
 */
export const Dashboard = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const { nextStep } = useSchedulerOrchestrator();
  const [actionLoading, setActionLoading] = useState(false);

  const decision = nextStep.data;
  const decisionLoading = nextStep.isLoading;

  /** 执行「下一步」：复习跳学习中心；进度经 getNextActionForTask 取直达地址 */
  const handleGoNext = async () => {
    if (!decision) return;
    if (decision.type === "review" && decision.review) {
      const { knowledgePointId, graphId } = decision.review;
      const params = new URLSearchParams({ node_id: knowledgePointId });
      if (graphId) params.set("graph_id", graphId);
      navigate(`/study?${params.toString()}`);
      return;
    }
    if (decision.type === "progress" && decision.progress) {
      setActionLoading(true);
      try {
        const result = await orchestratorApi.getNextActionForTask(
          decision.progress.taskId,
        );
        const url = result?.action?.url;
        if (url) {
          navigate(url);
          return;
        }
      } catch {
        /* 失败落到调度器 */
      } finally {
        setActionLoading(false);
      }
      navigate("/scheduler");
    }
  };

  const boxClass = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-gray-200";

  // 待办队列：始终反映紧急/重要/常规队列里的活跃任务，避免调度决策为空时首页无内容
  const { data: queueData } = useSchedulerQueues();
  const queueTasks = useMemo(() => {
    const d = queueData as QueueData | undefined;
    const list = [...(d?.q0 ?? []), ...(d?.q1 ?? []), ...(d?.q2 ?? [])];
    return list.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled",
    );
  }, [queueData]);

  const qLabel = (level: number) =>
    level === 0
      ? t("scheduler.home.queueQ0")
      : level === 1
        ? t("scheduler.home.queueQ1")
        : t("scheduler.home.queueQ2");

  const qBadgeClass = (level: number) =>
    level === 0
      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      : level === 1
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  // 下一步进度的「已完成百分比」（subtaskProgress 带 total/completed 时展示进度条）
  const progressPct = useMemo(() => {
    const p = decision?.type === "progress" ? decision.progress : undefined;
    const sp = p?.subtaskProgress;
    if (!sp || !sp.total) return undefined;
    return Math.min(100, Math.round((sp.completed / sp.total) * 100));
  }, [decision]);

  return (
    <div
      className={`h-full overflow-y-auto custom-scrollbar transition-colors ${
        isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="sr-only">{t("scheduler.home.title")}</h1>

        {/* ── 顶部标题区 ── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <Home size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t("scheduler.home.title")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("scheduler.home.homeHint")}
            </p>
          </div>
        </div>

        {/* ── 桌面端左右双栏：左 2/3 = 下一步 + 待办队列；右 1/3 = 快捷入口 + 今日回顾 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* 下一步调度大卡 */}
            <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
              <div
                className={`px-5 py-4 flex items-center gap-2 border-b ${
                  isDark ? "border-slate-700" : "border-gray-200"
                }`}
              >
                <BrainCog size={18} className="text-primary-500" />
                <span className="font-medium">{t("scheduler.home.nextStepTitle")}</span>
              </div>

              {decisionLoading ? (
                <div className="p-6 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              ) : decision && decision.type === "review" && decision.review ? (
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <p className="font-medium">{t("scheduler.home.reviewCount", { count: decision.overdueReviewCount })}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {decision.reason}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoNext}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
                  >
                    {t("scheduler.home.goReview")}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : decision && decision.type === "progress" && decision.progress ? (
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                      <GraduationCap size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {t("scheduler.home.continueGraph", { title: decision.progress.taskTitle })}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {decision.reason}
                      </p>
                      {/* 学习进度条 + 当前学到哪个知识点 */}
                      {progressPct !== undefined ? (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span className="truncate">
                              {decision.progress.nextSubtask?.title
                                ? t("scheduler.home.nextSubtask", { title: decision.progress.nextSubtask.title })
                                : t("scheduler.home.subtaskProgressLabel", {
                                    completed: decision.progress.subtaskProgress?.completed ?? 0,
                                    total: decision.progress.subtaskProgress?.total ?? 0,
                                  })}
                            </span>
                            <span className="shrink-0 ml-2 font-medium tabular-nums">{progressPct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-primary-500 transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleGoNext(); }}
                    disabled={actionLoading}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                  >
                    {actionLoading ? t("scheduler.home.loading") : t("scheduler.home.startLearning")}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : nextStep.isError ? (
                <div className="p-6 flex flex-col items-center gap-3 text-center">
                  <AlertCircle size={28} className="text-red-500" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("scheduler.home.loadError")}
                  </p>
                  <button
                    type="button"
                    onClick={() => nextStep.refetch()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw size={14} />
                    {t("scheduler.home.retry")}
                  </button>
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={<ListOrdered size={28} />}
                    title={t("scheduler.home.emptyTitle")}
                    description={t("scheduler.home.emptyDesc")}
                  />
                </div>
              )}
            </section>

            {/* 待办队列（紧急/重要/常规） */}
            <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
              <div
                className={`px-5 py-3 flex items-center justify-between border-b ${
                  isDark ? "border-slate-700" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Inbox size={16} className="text-primary-500" />
                  <span className="font-medium text-sm">{t("scheduler.home.queueTitle")}</span>
                  <span className="text-xs text-slate-400">{queueTasks.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/scheduler")}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t("scheduler.home.viewScheduler")}
                  <ArrowRight size={12} />
                </button>
              </div>
              {queueTasks.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {t("scheduler.home.queueEmpty")}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {queueTasks.slice(0, 8).map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/scheduler/task/${task.id}`)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${qBadgeClass(task.queue_level)}`}>
                          {qLabel(task.queue_level)}
                        </span>
                        <span className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200 truncate">
                          {task.title}
                        </span>
                        {task.status === "in_progress" ? (
                          <span className="text-[10px] text-primary-500 shrink-0">
                            {t("scheduler.home.statusInProgress")}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* 右侧栏：快捷入口 + 今日回顾 */}
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3">
              <QuickEntry
                isDark={isDark}
                icon={<Inbox size={18} />}
                label={t("scheduler.home.viewGraphs")}
                onClick={() => navigate("/graphs")}
              />
              <QuickEntry
                isDark={isDark}
                icon={<ListOrdered size={18} />}
                label={t("scheduler.home.viewScheduler")}
                onClick={() => navigate("/scheduler")}
              />
              {!isMobile ? (
                <QuickEntry
                  isDark={isDark}
                  icon={<BrainCog size={18} />}
                  label={t("scheduler.home.gotoStudy")}
                  onClick={() => navigate("/study")}
                />
              ) : null}
            </section>

            {/* 今日回顾 / 捕获箱 */}
            <TodayReview />
          </div>
        </div>
      </div>
    </div>
  );
};

function QuickEntry({
  isDark,
  icon,
  label,
  onClick,
}: {
  isDark: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all hover:shadow-md ${
        isDark
          ? "bg-slate-800 border-slate-700 hover:border-primary-500/50"
          : "bg-white border-gray-200 hover:border-primary-400"
      }`}
    >
      <span className="text-primary-500">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default Dashboard;