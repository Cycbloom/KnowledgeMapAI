import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BrainCog,
  GraduationCap,
  Sparkles,
  Timer,
  Inbox,
  CalendarClock,
  ListChecks,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useSchedulerOrchestrator } from "../../hooks/scheduler/useSchedulerOrchestrator";
import { useSchedulerQueues } from "../../hooks/scheduler/useScheduler";
import { useTheme } from "../../hooks";
import { api } from "../../services/api";
import { startFocusTimerForTask } from "../../utils/focusTimerLink";
import { EmptyState } from "../common";
import { TodayBriefCard } from "./TodayBriefCard";
import type { QueueData, UserTask } from "@shared/types";

type KpTag = "scheduled" | "review";

interface KpItem {
  key: string;
  knowledgePointId: string;
  title: string;
  tags: KpTag[];
  date?: string;
}

/**
 * 移动端「今日」首屏：以「今日该学什么」为主线，单列卡片流。
 * - 顶部「下一步」调度决策大卡（复习 → 学习中心；进度 → 任务详情，可立即开启番茄钟）
 * - 今日知识点列表（排期命中 + 到期复习聚合），点卡片直接进入该知识点做题
 * - 待办队列精简 + 今日概览
 */
export const MobileTodayHome: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { nextStep } = useSchedulerOrchestrator();

  const decision = nextStep.data;
  const decisionLoading = nextStep.isLoading;

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // 今日排期命中的知识点（学习路径 path_schedule）
  const { data: scheduleEvents } = useQuery({
    queryKey: ["mobile-today", "schedule", today],
    queryFn: () => api.scheduler.getScheduleEvents(today, today),
    staleTime: 30_000,
  });
  // 今天到期的复习知识点（FSRS next_review 投影）
  const { data: reviewEvents } = useQuery({
    queryKey: ["mobile-today", "review", today],
    queryFn: () => api.scheduler.getReviewProjections(today, today),
    staleTime: 30_000,
  });

  // 依知识点评聚合，排期优先
  const kpItems = useMemo<KpItem[]>(() => {
    const map = new Map<string, KpItem>();
    const ensure = (id: string): KpItem => {
      const cur = map.get(id);
      if (cur) return cur;
      const item: KpItem = {
        key: id,
        knowledgePointId: id,
        title: "",
        tags: [],
      };
      map.set(id, item);
      return item;
    };
    for (const e of scheduleEvents ?? []) {
      if (!e?.knowledgePointId) continue;
      const item = ensure(e.knowledgePointId);
      item.title = e.title || item.title;
      item.date = e.scheduledDate ?? item.date;
      if (!item.tags.includes("scheduled")) item.tags.push("scheduled");
    }
    for (const e of reviewEvents ?? []) {
      if (!e?.knowledgePointId) continue;
      const item = ensure(e.knowledgePointId);
      item.title = e.title || item.title;
      item.date = e.scheduledDate ?? item.date;
      if (!item.tags.includes("review")) item.tags.push("review");
    }
    const rank = (item: KpItem) => (item.tags.includes("scheduled") ? 0 : 1);
    return Array.from(map.values()).sort((a, b) => rank(a) - rank(b));
  }, [scheduleEvents, reviewEvents]);

  // 待办队列（紧急/重要/常规）
  const { data: queueData } = useSchedulerQueues();
  const queueTasks = useMemo(() => {
    const d = queueData as QueueData | undefined;
    return [...(d?.q0 ?? []), ...(d?.q1 ?? []), ...(d?.q2 ?? [])].filter(
      (t) => t.status !== "completed" && t.status !== "cancelled",
    );
  }, [queueData]);

  // 执行「下一步」：复习跳学习中心；进度跳任务详情并自动开始任务
  const goNext = () => {
    if (!decision) return;
    if (decision.type === "review" && decision.review) {
      const params = new URLSearchParams({
        node_id: decision.review.knowledgePointId,
      });
      if (decision.review.graphId) params.set("graph_id", decision.review.graphId);
      navigate(`/study?${params.toString()}`);
      return;
    }
    if (decision.type === "progress" && decision.progress) {
      navigate(`/scheduler/task/${decision.progress.taskId}`, {
        state: { autoStartTask: true },
      });
    }
  };

  // 番茄钟入口：进度任务可直接开启；否则进入学习中心（进入做题自动启动）
  const startFocus = () => {
    if (decision?.type === "progress" && decision.progress) {
      startFocusTimerForTask(decision.progress.taskId);
      return;
    }
    navigate("/study");
  };

  const progressPct = useMemo(() => {
    const p = decision?.type === "progress" ? decision.progress : undefined;
    const sp = p?.subtaskProgress;
    if (!sp || !sp.total) return undefined;
    return Math.min(100, Math.round((sp.completed / sp.total) * 100));
  }, [decision]);

  const tagText = (tags: KpTag[]) => {
    if (tags.includes("scheduled") && tags.includes("review")) {
      return t("scheduler.mobileToday.tagBoth");
    }
    return tags.includes("scheduled")
      ? t("scheduler.mobileToday.tagScheduled")
      : t("scheduler.mobileToday.tagReview");
  };
  const tagClass = (tags: KpTag[]) =>
    tags.includes("scheduled")
      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";

  const goNode = (kpId: string) => {
    navigate(`/study?${new URLSearchParams({ node_id: kpId }).toString()}`);
  };
  const goTask = (task: UserTask, autoStart: boolean) => {
    navigate(`/scheduler/task/${task.id}`, {
      state: autoStart ? { autoStartTask: true } : undefined,
    });
  };

  const boxClass = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-gray-200";

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4">
      {/* 顶部标题 */}
      <header className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center">
          <CalendarClock size={22} />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            {t("scheduler.mobileToday.title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("scheduler.home.homeHint")}
          </p>
        </div>
      </header>

      {/* 下一步调度决策大卡 */}
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <div
          className={`px-4 py-3 flex items-center gap-2 border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <BrainCog size={18} className="text-primary-500" />
          <span className="font-medium">{t("scheduler.home.nextStepTitle")}</span>
        </div>

        {decisionLoading ? (
          <div className="p-5 animate-pulse">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ) : decision && decision.type === "review" && decision.review ? (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {t("scheduler.home.reviewCount", {
                    count: decision.overdueReviewCount,
                  })}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {decision.reason}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
            >
              {t("scheduler.home.goReview")}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : decision && decision.type === "progress" && decision.progress ? (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {t("scheduler.home.continueGraph", {
                    title: decision.progress.taskTitle,
                  })}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {decision.reason}
                </p>
                {progressPct !== undefined ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span className="truncate">
                        {decision.progress.nextSubtask?.title
                          ? t("scheduler.home.nextSubtask", {
                              title: decision.progress.nextSubtask.title,
                            })
                          : t("scheduler.home.subtaskProgressLabel", {
                              completed:
                                decision.progress.subtaskProgress?.completed ?? 0,
                              total: decision.progress.subtaskProgress?.total ?? 0,
                            })}
                      </span>
                      <span className="shrink-0 ml-2 font-medium tabular-nums">
                        {progressPct}%
                      </span>
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={startFocus}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
              >
                <Timer size={15} />
                {t("scheduler.mobileToday.startFocus")}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
              >
                {t("scheduler.home.startLearning")}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : nextStep.isError ? (
          <div className="p-5 flex flex-col items-center gap-3 text-center">
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
          <div className="p-5">
            <EmptyState
              icon={<ListChecks size={28} />}
              title={t("scheduler.home.emptyTitle")}
              description={t("scheduler.home.emptyDesc")}
            />
          </div>
        )}
      </section>

      {/* 今日知识点列表（核心） */}
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <div
          className={`px-4 py-3 flex items-center gap-2 border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <GraduationCap size={16} className="text-primary-500" />
          <span className="font-medium text-sm">
            {t("scheduler.mobileToday.knowledgePointsTitle")}
          </span>
        </div>
        {kpItems.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<CalendarClock size={24} />}
              title={t("scheduler.mobileToday.knowledgePointsTitle")}
              description={t("scheduler.mobileToday.kpEmpty")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {kpItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => goNode(item.knowledgePointId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${tagClass(
                      item.tags,
                    )}`}
                  >
                    {tagText(item.tags)}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200 truncate">
                    {item.title}
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 今日概览（排期 + 容量 + 到期复习 + 滞后窗口） */}
      <TodayBriefCard />

      {/* 待办队列（精简） */}
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <div
          className={`px-4 py-3 flex items-center justify-between border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Inbox size={16} className="text-primary-500" />
            <span className="font-medium text-sm">
              {t("scheduler.home.queueTitle")}
            </span>
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
          <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            {t("scheduler.home.queueEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {queueTasks.slice(0, 5).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => goTask(task, false)}
                  className="flex-1 min-w-0 text-left text-sm text-slate-800 dark:text-slate-200 truncate"
                >
                  {task.title}
                </button>
                <button
                  type="button"
                  onClick={() => goTask(task, true)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                >
                  <GraduationCap size={13} />
                  {t("scheduler.home.startLearning")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default MobileTodayHome;