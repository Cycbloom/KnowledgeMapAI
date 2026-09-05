import React, { useState, useMemo, useEffect } from "react";
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
  Route,
} from "lucide-react";
import { useSchedulerOrchestrator } from "../hooks/scheduler/useSchedulerOrchestrator";
import { useSchedulerQueues } from "../hooks/scheduler/useScheduler";
import { useTheme, useIsMobile } from "../hooks";
import {
  useLearningPaths,
  useLearningPath,
} from "../hooks/queries/useLearningPathQueries";
import { TodayReview } from "../components/capture/TodayReview";
import { EmptyState } from "../components/common";
import { TodayBriefCard } from "../components/Dashboard/TodayBriefCard";
import { MobileTodayHome } from "../components/Dashboard/MobileTodayHome";
import { learningPathsApi, type LearningPathResponse } from "../services/api/learningPaths";
import { message } from "../utils/messageHelper";
import { getErrorMessage } from "../utils/errors";
import type { QueueData, UserTask } from "@shared/types";

/** 首页学习路径切换器选择记忆 key */
const HOME_SELECTED_PATH_KEY = "km-home-selected-path";

/** 将队列任务按所选学习路径的节点顺序（图级）排序；未匹配任务归入 others */
function orderTasksByPath(
  tasks: UserTask[],
  nodes?: Array<{ graph_id?: string; order_index?: number }>,
): { orderedTasks: UserTask[]; otherTasks: UserTask[] } {
  const firstIndex = new Map<string, number>();
  for (const n of nodes ?? []) {
    const g = n?.graph_id;
    const cur = firstIndex.get(g ?? "");
    if (g && (cur === undefined || (n.order_index ?? 0) < cur)) {
      firstIndex.set(g, n.order_index ?? 0);
    }
  }
  const orderedTasks = tasks
    .filter((t) => t.graph_id && firstIndex.has(t.graph_id))
    .map((t) => {
      const g = t.graph_id as string;
      return { t, order: firstIndex.get(g) as number };
    })
    .sort((a, b) => a.order - b.order)
    .map((x) => x.t);
  const otherTasks = tasks.filter(
    (t) => !t.graph_id || !firstIndex.has(t.graph_id),
  );
  return { orderedTasks, otherTasks };
}

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

  const decision = nextStep.data;
  const decisionLoading = nextStep.isLoading;

  /** 执行「下一步」：复习跳学习中心；进度跳任务详情并自动开始任务 */
  const handleGoNext = () => {
    if (!decision) return;
    if (decision.type === "review" && decision.review) {
      const { knowledgePointId, graphId } = decision.review;
      const params = new URLSearchParams({ node_id: knowledgePointId });
      if (graphId) params.set("graph_id", graphId);
      navigate(`/study?${params.toString()}`);
      return;
    }
    if (decision.type === "progress" && decision.progress) {
      // 直达任务详情，传入 autoStartTask 状态让 TaskWorkbench 自动「开始任务」
      navigate(`/scheduler/task/${decision.progress.taskId}`, {
        state: { autoStartTask: true },
      });
    }
  };

  const boxClass = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-gray-200";

  // —— 学习路径切换器：多条 active 路径 + 选择记忆 ——
  const { data: activePaths } = useLearningPaths("active");
  const activeList = useMemo(
    () =>
      Array.isArray(activePaths) ? (activePaths as LearningPathResponse[]) : [],
    [activePaths],
  );
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(HOME_SELECTED_PATH_KEY);
    return stored && stored.length > 0 ? stored : null;
  });

  // 有效选中：记忆的仍在列表则用之，否则回退跨图谱→第一条 active
  const effectivePathId = useMemo(() => {
    if (activeList.some((p) => p?.id === selectedId)) return selectedId;
    return (
      activeList.find((p) => p?.path_type === "cross_graph")?.id ??
      activeList[0]?.id ??
      null
    );
  }, [activeList, selectedId]);

  // storedId 失效时回退默认并清理记忆
  useEffect(() => {
    if (selectedId !== effectivePathId) {
      setSelectedIdState(effectivePathId);
    }
  }, [selectedId, effectivePathId]);

  const selectPath = (id: string) => {
    setSelectedIdState(id);
    try {
      localStorage.setItem(HOME_SELECTED_PATH_KEY, id);
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
  };

  // 所选路径节点（nodes 已按 order_index 排序，含 graph_id），用于队列排序
  const { data: selectedPathDetail } = useLearningPath(effectivePathId ?? "");

  /** 生成跨图谱学习路径（大调度），生成后跳转路径详情 */
  const handleGenerateCrossGraph = async () => {
    try {
      const result = await learningPathsApi.generateCrossGraph();
      const data = result.data;
      message.success(
        t("dashboard.crossGraph.generated", { count: data.totalGraphs }),
      );
      navigate(`/learning-paths/${data.pathId}`);
    } catch (error: unknown) {
      const errMsg =
        getErrorMessage(error) || t("dashboard.crossGraph.generateFailed");
      message.error(errMsg);
    }
  };

  // 待办队列：始终反映紧急/重要/常规队列里的活跃任务，避免调度决策为空时首页无内容
  const { data: queueData } = useSchedulerQueues();
  const queueTasks = useMemo(() => {
    const d = queueData as QueueData | undefined;
    const list = [...(d?.q0 ?? []), ...(d?.q1 ?? []), ...(d?.q2 ?? [])];
    return list.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled",
    );
  }, [queueData]);

  // 无选中路径 → 直接展示完整队列；否则按路径节点顺序排列 + 归集「其他」
  const { orderedTasks, otherTasks } = useMemo(
    () =>
      effectivePathId
        ? orderTasksByPath(queueTasks, selectedPathDetail?.nodes)
        : { orderedTasks: queueTasks, otherTasks: [] },
    [queueTasks, effectivePathId, selectedPathDetail],
  );

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

  /** 待办队列单行：点击进详情；右侧「开始学习」按钮由用户手动选择该图谱开始学习 */
  const renderTaskRow = (task: UserTask) => (
    <li
      key={task.id}
      className="flex items-center gap-2 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
    >
      <button
        type="button"
        onClick={() => navigate(`/scheduler/task/${task.id}`)}
        className="flex-1 min-w-0 flex items-center gap-3 text-left"
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
      <button
        type="button"
        onClick={() =>
          navigate(`/scheduler/task/${task.id}`, {
            state: { autoStartTask: true },
          })
        }
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
      >
        <GraduationCap size={13} />
        {t("scheduler.home.startLearning")}
      </button>
    </li>
  );

  // 移动端首屏：以「今日该学什么」为主线的单列精简视图
  if (isMobile) {
    return <MobileTodayHome />;
  }

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
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                  >
                    {t("scheduler.home.startLearning")}
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

            {/* 今日卡片（P4）：今日排期 + 容量使用 + 到期复习 + 滞后窗口 */}
            <TodayBriefCard />

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
                  {orderedTasks.slice(0, 8).map((task) => renderTaskRow(task))}
                  {otherTasks.length > 0 ? (
                    <>
                      <li className="px-5 py-2 text-xs text-slate-400 dark:text-slate-500">
                        {t("dashboard.learningPathSwitcher.others")}
                      </li>
                      {otherTasks.slice(0, 8).map((task) => renderTaskRow(task))}
                    </>
                  ) : null}
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

            {/* 学习路径切换器（多条 active 路径） */}
            <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
              <div
                className={`px-5 py-3 flex items-center gap-2 border-b ${
                  isDark ? "border-slate-700" : "border-gray-200"
                }`}
              >
                <Route size={16} className="text-primary-500" />
                <span className="font-medium text-sm">
                  {t("dashboard.learningPathSwitcher.title")}
                </span>
              </div>
              <div className="p-3 space-y-2">
                {activeList.length === 0 ? (
                  <div className="p-2">
                    <EmptyState
                      icon={<Route size={24} />}
                      title={t("dashboard.crossGraph.emptyTitle")}
                      description={t("dashboard.crossGraph.emptyDesc")}
                    />
                  </div>
                ) : (
                  activeList.map((path) => {
                    const isSelected = path.id === effectivePathId;
                    const total = path.nodes_count ?? 0;
                    const completed = path.completed_nodes_count ?? 0;
                    const pct =
                      total > 0 ? Math.round((completed / total) * 100) : 0;
                    const remaining = Math.max(total - completed, 0);
                    return (
                      <button
                        key={path.id}
                        type="button"
                        onClick={() => selectPath(path.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-primary-50 dark:bg-primary-900/30 border-primary-400 dark:border-primary-500/60 ring-1 ring-primary-400/40"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary-400"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                            {path.title}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                            {t("dashboard.learningPathSwitcher.progress", {
                              completed,
                              total,
                            })}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-600">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {remaining > 0
                            ? t("dashboard.learningPathSwitcher.remaining", {
                                count: remaining,
                              })
                            : t("dashboard.learningPathSwitcher.allDone")}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="px-3 pb-3 space-y-2">
                {effectivePathId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/learning-paths/${effectivePathId}`)}
                    className="w-full px-3 py-2 rounded-lg border text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    {t("dashboard.crossGraph.viewPath")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void handleGenerateCrossGraph();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
                >
                  {t("dashboard.crossGraph.generate")}
                  <ArrowRight size={14} />
                </button>
              </div>
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