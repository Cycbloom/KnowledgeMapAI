import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BrainCog,
  CalendarClock,
  GraduationCap,
  Layers,
  Upload,
  WifiOff,
} from "lucide-react";
import { useTheme } from "../../hooks";
import { EmptyState } from "../common";
import { getAll } from "../../services/offline/offlineDb";
import {
  countPendingOps,
  syncOfflineRecords,
} from "../../services/offline/offlineSync";
import { message } from "../../utils/messageHelper";
import type { StudyCard } from "@shared/types/common";
import type { OfflineKnowledgePointRow } from "@shared/types";
import { resolveLocalizedText } from "@shared/utils/localization";

interface TodayKpItem {
  knowledgePointId: string;
  title: string;
  dueCount: number;
}

interface OfflineTodayData {
  totalCards: number;
  dueCount: number;
  newCount: number;
  reviewCount: number;
  kpItems: TodayKpItem[];
}

async function loadTodayData(): Promise<OfflineTodayData> {
  const [cards, points] = await Promise.all([
    getAll<StudyCard>("study_cards"),
    getAll<OfflineKnowledgePointRow>("knowledge_points"),
  ]);

  const now = new Date();
  const dueCards = cards.filter(
    (c) => c.next_review && new Date(c.next_review) <= now,
  );

  const pointTitleById = new Map(
    points.map((p) => [
      p.id,
      resolveLocalizedText(
        p.title as string | Record<string, string> | null | undefined,
      ),
    ]),
  );

  const kpMap = new Map<string, TodayKpItem>();
  for (const card of dueCards) {
    const kpId = card.knowledge_point_id;
    if (!kpId) continue;
    const item = kpMap.get(kpId) ?? {
      knowledgePointId: kpId,
      title: pointTitleById.get(kpId) ?? card.knowledgePointTitle ?? "",
      dueCount: 0,
    };
    item.dueCount += 1;
    kpMap.set(kpId, item);
  }
  const kpItems = Array.from(kpMap.values()).sort((a, b) => {
    if (!a.title) return 1;
    if (!b.title) return -1;
    return a.title.localeCompare(b.title, "zh-CN");
  });

  let newCount = 0;
  let reviewCount = 0;
  for (const card of cards) {
    const state = card.fsrs_state ?? "New";
    if (state === "New") newCount++;
    else reviewCount++;
  }

  return {
    totalCards: cards.length,
    dueCount: dueCards.length,
    newCount,
    reviewCount,
    kpItems,
  };
}

/**
 * 离线版「今日」首屏：完全本地数据（IndexedDB），不依赖任何网络服务。
 * - 顶部今日概览（到期/新卡/复习/总量）
 * - 今日到期知识点列表，点卡片直接进入该知识点做题
 * - 底部「开始学习」进入学习中心
 */
export const OfflineTodayHome: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["offline-today"],
    queryFn: loadTodayData,
    staleTime: 0,
  });

  const summaryItems = useMemo(
    () => [
      { label: t("study.stats.due"), value: data?.dueCount ?? 0, tone: "amber" },
      { label: t("study.questionBank.fsrsStates.new"), value: data?.newCount ?? 0, tone: "primary" },
      { label: t("study.questionBank.fsrsStates.review"), value: data?.reviewCount ?? 0, tone: "emerald" },
      { label: t("study.stats.totalCards"), value: data?.totalCards ?? 0, tone: "slate" },
    ],
    [data, t],
  );

  const toneClass: Record<string, string> = {
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    primary: "text-primary-600 dark:text-primary-400 bg-primary-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    slate: "text-slate-600 dark:text-slate-400 bg-slate-500/10",
  };

  const boxClass = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-white border-gray-200";

  const goNode = (kpId: string) => {
    navigate(`/study?${new URLSearchParams({ node_id: kpId }).toString()}`);
  };

  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void countPendingOps().then(setPendingCount).catch(() => setPendingCount(0));
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncOfflineRecords();
      const pending = await countPendingOps();
      setPendingCount(pending);
      if (result.authRequired) {
        message.info(t("scheduler.mobileToday.syncNeedLogin"));
        navigate("/login");
      } else if (result.synced > 0) {
        message.success(t("scheduler.mobileToday.syncDone", { count: result.synced }));
      } else if (result.failed === 0) {
        message.success(t("scheduler.mobileToday.syncAllSynced"));
      } else {
        message.error(t("scheduler.mobileToday.syncFailed"));
      }
    } catch {
      message.error(t("scheduler.mobileToday.syncFailed"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4">
      <header className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center">
          <CalendarClock size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            {t("scheduler.mobileToday.title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("scheduler.home.homeHint")}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/40">
          <WifiOff size={11} />
          {t("common.syncStatus.offline")}
        </span>
      </header>

      {/* 今日概览 */}
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <div
          className={`px-4 py-3 flex items-center gap-2 border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <Layers size={16} className="text-primary-500" />
          <span className="font-medium text-sm">
            {t("statistics.title")}
          </span>
        </div>
        {isLoading ? (
          <div className="p-5 animate-pulse">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-slate-200 dark:bg-slate-700"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-4 gap-2">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-xl p-3 ${toneClass[item.tone] ?? toneClass.slate}`}
              >
                <p className="text-lg font-semibold tabular-nums">{item.value}</p>
                <p className="text-[10px] leading-tight mt-0.5 opacity-80 line-clamp-2">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 今日知识点列表 */}
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
          <span className="ml-auto text-xs text-slate-400">
            {data?.kpItems.length ?? 0}
          </span>
        </div>
        {!isLoading && data && data.kpItems.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<CalendarClock size={24} />}
              title={t("scheduler.mobileToday.knowledgePointsTitle")}
              description={t("scheduler.mobileToday.kpEmpty")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {(data?.kpItems ?? []).map((item) => (
              <li key={item.knowledgePointId}>
                <button
                  type="button"
                  onClick={() => goNode(item.knowledgePointId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    {t("scheduler.mobileToday.tagReview")}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200 truncate">
                    {item.title || item.knowledgePointId}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                    {item.dueCount}
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

      {/* 同步离线记录 */}
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <div className="w-full flex items-center gap-3 px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Upload size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {t("scheduler.mobileToday.sync")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {pendingCount > 0
                ? t("scheduler.mobileToday.syncPending", { count: pendingCount })
                : t("scheduler.mobileToday.syncAllSynced")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            {syncing ? t("scheduler.mobileToday.syncing") : t("scheduler.mobileToday.sync")}
          </button>
        </div>
      </section>

      {/* 开始学习 */}
      <section className={`rounded-2xl border shadow-sm overflow-hidden ${boxClass}`}>
        <button
          type="button"
          onClick={() => navigate("/study")}
          className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <BrainCog size={20} />
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200">
            {t("scheduler.home.startLearning")}
          </span>
          <ArrowRight size={16} className="shrink-0 text-slate-400" />
        </button>
      </section>
    </div>
  );
};

export default OfflineTodayHome;
