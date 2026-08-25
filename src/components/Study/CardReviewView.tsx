import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { StatsOverview } from "../Statistics/StatsOverview";
import { WeakPointAnalysis, type WeakPoint, type Prediction } from "./WeakPointAnalysis";
import type { ReviewForecast } from "../../hooks/queries/useStudyQueries";
import {
  Trophy,
  Clock,
  Brain,
  Play,
  LayoutGrid,
  Flame,
  Activity,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";

interface Stats {
  total: number;
  mastered: number;
  due: number;
  distribution: {
    new: number;
    learning: number;
    review: number;
    relearning: number;
  };
}

interface CardReviewViewProps {
  isDark: boolean;
  isMobile: boolean;
  allCards: StudyCard[];
  dueCards: StudyCard[];
  stats: Stats;
  streakDays: number;
  weeklyStudyTime: number;
  weakPoints: WeakPoint[];
  predictions: Prediction[];
  forecast?: ReviewForecast;
  onStartQuiz: (mode: "all" | "due", knowledgePointId?: string) => void;
}

export const CardReviewView = ({
  isDark,
  isMobile,
  allCards,
  dueCards,
  stats,
  streakDays,
  weeklyStudyTime,
  weakPoints,
  predictions,
  forecast,
  onStartQuiz,
}: CardReviewViewProps) => {
  const { t } = useTranslation();

  // 顶部操作卡片的复习范围：指定知识点（"__all__" 表示全部）
  const [actionKpId, setActionKpId] = useState<string>("__all__");

  const pieData = [
    {
      name: t("study.cardTypes.new"),
      value: stats.distribution.new,
      color: "#94a3b8",
    },
    {
      name: t("study.cardTypes.learning"),
      value: stats.distribution.learning,
      color: "#60a5fa",
    },
    {
      name: t("study.cardTypes.review"),
      value: stats.distribution.review,
      color: "#34d399",
    },
    {
      name: t("study.cardTypes.relearning"),
      value: stats.distribution.relearning,
      color: "#fbbf24",
    },
  ].filter((d) => d.value > 0);

  // 前置计算每日最大复习数，避免在 forecast.daily.map 内对每个元素重复 Math.max（原为 O(n²)）
  const forecastMaxCount = useMemo(
    () => Math.max(...(forecast?.daily ?? []), 1),
    [forecast?.daily],
  );

  // 顶部操作卡片可选的知识点范围（含卡片数/到期数，便于选择）
  const actionKnowledgePoints = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; total: number; due: number }
    >();
    const ensure = (id: string, title: string) => {
      const entry = map.get(id);
      if (entry) return entry;
      const created = { id, title, total: 0, due: 0 };
      map.set(id, created);
      return created;
    };
    for (const card of allCards) {
      const id = card.knowledge_point_id || "unknown";
      const entry = ensure(id, card.knowledgePointTitle || t("study.cardList.unknownPoint"));
      entry.total += 1;
    }
    for (const card of dueCards) {
      const id = card.knowledge_point_id || "unknown";
      const entry = ensure(id, card.knowledgePointTitle || t("study.cardList.unknownPoint"));
      entry.due += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [allCards, dueCards, t]);

  // 当前复习范围下的卡片集合（供顶部操作卡片计数/禁用与回调使用）
  const scopedAllCards = useMemo(() => {
    if (actionKpId === "__all__") return allCards;
    return allCards.filter(
      (c) => (c.knowledge_point_id || "unknown") === actionKpId,
    );
  }, [allCards, actionKpId]);
  const scopedDueCards = useMemo(() => {
    if (actionKpId === "__all__") return dueCards;
    return dueCards.filter(
      (c) => (c.knowledge_point_id || "unknown") === actionKpId,
    );
  }, [dueCards, actionKpId]);

  return (
    <>
      {/* Stats Cards & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div
            className={`grid ${isMobile ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-5"} gap-2 md:gap-3`}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-primary-900/40 text-primary-400" : "bg-primary-50 text-primary-600"}`}
              >
                <LayoutGrid size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.totalCards")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {stats.total}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}
              >
                <Trophy size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.mastered")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {stats.mastered}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-amber-900/40 text-amber-400" : "bg-amber-50 text-amber-600"}`}
              >
                <Clock size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.due")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black text-amber-500`}
                >
                  {stats.due}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${isMobile ? "hidden sm:flex" : ""} ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-orange-900/40 text-orange-400" : "bg-orange-50 text-orange-600"}`}
              >
                <Flame size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.streak")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {streakDays}
                  {t("study.stats.days")}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${isMobile ? "hidden sm:flex" : ""} ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-primary-900/40 text-primary-400" : "bg-primary-50 text-primary-600"}`}
              >
                <Activity size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.weeklyStudy")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {Math.round(weeklyStudyTime / 60)}h
                </p>
              </div>
            </motion.div>
          </div>

          {/* 复习范围：可选择指定知识点（仅当存在多个知识点时显示） */}
          {actionKnowledgePoints.length > 1 && (
            <div className="flex items-center justify-end gap-2">
              <label
                htmlFor="study-action-kp"
                className={`text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-gray-500"
                }`}
              >
                {t("study.cardList.reviewScope")}
              </label>
              <select
                id="study-action-kp"
                value={actionKpId}
                onChange={(e) => setActionKpId(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-sm border focus:ring-2 focus:ring-primary-500 outline-none transition-all ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-white border-gray-200 text-gray-900 shadow-sm"
                }`}
              >
                <option value="__all__">{t("study.cardList.allPoints")}</option>
                {actionKnowledgePoints.map((kp) => (
                  <option key={kp.id} value={kp.id}>
                    {kp.title} ({kp.total})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Cards */}
          <div
            className={`grid grid-cols-1 ${isMobile ? "" : "md:grid-cols-2"} gap-4 md:gap-6`}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() =>
                onStartQuiz(
                  "due",
                  actionKpId === "__all__" ? undefined : actionKpId,
                )
              }
              disabled={scopedDueCards.length === 0}
              className={`flex flex-col items-center text-center ${isMobile ? "p-5 rounded-2xl" : "p-8 rounded-[2.5rem]"} border-2 transition-all group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                scopedDueCards.length > 0
                  ? isDark
                    ? "bg-primary-900/20 border-primary-800/50 hover:border-primary-500 shadow-lg shadow-primary-900/20"
                    : "bg-primary-50 border-primary-100 hover:border-primary-400 shadow-xl shadow-primary-100/50"
                  : isDark
                    ? "bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed"
                    : "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
              }`}
            >
              {scopedDueCards.length > 0 && (
                <div className="absolute top-4 right-4 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                </div>
              )}
              <div
                className={`${isMobile ? "p-4 rounded-xl" : "p-6 rounded-[2rem]"} mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-500 ${
                  isDark
                    ? "bg-primary-900/40 text-primary-400"
                    : "bg-white text-primary-600 shadow-md"
                }`}
              >
                <Brain size={isMobile ? 36 : 48} />
              </div>
              <h3
                className={`${isMobile ? "text-xl" : "text-2xl"} font-black mb-1 md:mb-2 ${isDark ? "text-primary-300" : "text-primary-900"}`}
              >
                {t("study.todayDue")}
              </h3>
              <p
                className={`mb-4 md:mb-8 max-w-[280px] ${isMobile ? "text-xs" : "text-sm"} font-medium ${isDark ? "text-primary-400/80" : "text-primary-700/70"}`}
              >
                {t("study.fsrsDescription")}
              </p>
              <div
                className={`${isMobile ? "px-5 py-2" : "px-8 py-3"} rounded-2xl font-black ${isMobile ? "text-base" : "text-lg"} transition-all ${
                  scopedDueCards.length > 0
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-300 group-hover:bg-primary-700 group-hover:-translate-y-1"
                    : "bg-gray-300 text-gray-500"
                }`}
              >
                {scopedDueCards.length > 0
                  ? t("study.startNow", { count: scopedDueCards.length })
                  : t("study.noReviewTasks")}
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() =>
                onStartQuiz(
                  "all",
                  actionKpId === "__all__" ? undefined : actionKpId,
                )
              }
              disabled={scopedAllCards.length === 0}
              className={`flex flex-col items-center text-center ${isMobile ? "p-5 rounded-2xl" : "p-8 rounded-[2.5rem]"} border-2 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                scopedAllCards.length > 0
                  ? isDark
                    ? "bg-slate-800 border-slate-700 hover:border-primary-500 shadow-lg"
                    : "bg-white border-gray-100 hover:border-primary-400 shadow-xl shadow-gray-100/50"
                  : isDark
                    ? "bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed"
                    : "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
              }`}
            >
              <div
                className={`${isMobile ? "p-4 rounded-xl" : "p-6 rounded-[2rem]"} mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-500 ${
                  isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-gray-50 text-gray-600"
                }`}
              >
                <Play size={isMobile ? 36 : 48} />
              </div>
              <h3
                className={`${isMobile ? "text-xl" : "text-2xl"} font-black mb-1 md:mb-2`}
              >
                {t("study.freePractice")}
              </h3>
              <p
                className={`mb-4 md:mb-8 max-w-[280px] ${isMobile ? "text-xs" : "text-sm"} font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {t("study.freePracticeDescription")}
              </p>
              <div
                className={`${isMobile ? "px-5 py-2" : "px-8 py-3"} rounded-2xl font-black ${isMobile ? "text-base" : "text-lg"} transition-all ${
                  scopedAllCards.length > 0
                    ? isDark
                      ? "bg-slate-700 text-white border border-slate-600 group-hover:bg-slate-600 group-hover:-translate-y-1"
                      : "bg-white text-gray-700 border-2 border-gray-100 shadow-sm group-hover:border-primary-200 group-hover:-translate-y-1"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {scopedAllCards.length > 0
                  ? t("study.startSelfTest", { count: scopedAllCards.length })
                  : t("study.noCards")}
              </div>
            </motion.button>
          </div>

          {/* Review Forecast */}
          {forecast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className={`p-4 md:p-5 rounded-2xl border ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar
                  size={isMobile ? 16 : 18}
                  className={
                    isDark ? "text-primary-400" : "text-primary-600"
                  }
                />
                <h3
                  className={`text-sm md:text-base font-bold ${
                    isDark ? "text-slate-200" : "text-gray-800"
                  }`}
                >
                  {t("study.forecast.title")}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs md:text-sm ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    {t("study.forecast.tomorrow")}
                  </span>
                  <span
                    className={`text-lg md:text-xl font-black ${
                      forecast.tomorrow > 0
                        ? isDark
                          ? "text-amber-400"
                          : "text-amber-600"
                        : isDark
                          ? "text-slate-500"
                          : "text-gray-400"
                    }`}
                  >
                    {forecast.tomorrow}
                  </span>
                  <span
                    className={`text-xs ${
                      isDark ? "text-slate-500" : "text-gray-400"
                    }`}
                  >
                    {t("study.forecast.cards")}
                  </span>
                </div>
                <div
                  className={`h-6 w-px ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                />
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs md:text-sm ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    {t("study.forecast.thisWeek")}
                  </span>
                  <span
                    className={`text-lg md:text-xl font-black ${
                      isDark ? "text-primary-400" : "text-primary-600"
                    }`}
                  >
                    {forecast.thisWeek}
                  </span>
                  <span
                    className={`text-xs ${
                      isDark ? "text-slate-500" : "text-gray-400"
                    }`}
                  >
                    {t("study.forecast.cards")}
                  </span>
                </div>
              </div>
              {/* 7-day bar summary */}
              {forecast.thisWeek > 0 && (
                <div className="flex items-end gap-1 mt-3 h-12">
                  {forecast.daily.map((count, idx) => {
                    const maxCount = forecastMaxCount;
                    const heightPct = Math.max(
                      (count / maxCount) * 100,
                      count > 0 ? 8 : 2,
                    );
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1"
                        title={t("study.forecast.dayTooltip", {
                          day: idx + 1,
                          count,
                        })}
                      >
                        <div
                          className={`w-full rounded-t transition-all ${
                            count > 0
                              ? isDark
                                ? "bg-primary-500"
                                : "bg-primary-400"
                              : isDark
                                ? "bg-slate-700"
                                : "bg-gray-100"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span
                          className={`text-[9px] md:text-[10px] ${
                            isDark ? "text-slate-500" : "text-gray-400"
                          }`}
                        >
                          {count > 0 ? count : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Chart */}
        <div
          className={`lg:col-span-1 ${isMobile ? "hidden lg:block" : ""}`}
        >
          <StatsOverview data={pieData} />
        </div>
      </div>

      {/* Health Insights */}
      <WeakPointAnalysis
        isDark={isDark}
        weakPoints={weakPoints}
        predictions={predictions}
      />
    </>
  );
};
